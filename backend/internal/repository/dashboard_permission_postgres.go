package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mitsume/backend/internal/models"
)

type PostgresDashboardPermissionRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresDashboardPermissionRepository(pool *pgxpool.Pool) *PostgresDashboardPermissionRepository {
	return &PostgresDashboardPermissionRepository{pool: pool}
}

// GetUserPermissionLevel returns the permission level for a user on a dashboard
func (r *PostgresDashboardPermissionRepository) GetUserPermissionLevel(ctx context.Context, dashboardID, userID uuid.UUID) (models.PermissionLevel, error) {
	// Check if user is owner
	var ownerID uuid.UUID
	err := r.pool.QueryRow(ctx,
		`SELECT user_id FROM dashboards WHERE id = $1`,
		dashboardID,
	).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.PermissionNone, ErrNotFound
		}
		return models.PermissionNone, err
	}

	if ownerID == userID {
		return models.PermissionOwner, nil
	}

	// Check if dashboard is public
	var isPublic bool
	err = r.pool.QueryRow(ctx,
		`SELECT COALESCE(is_public, false) FROM dashboards WHERE id = $1`,
		dashboardID,
	).Scan(&isPublic)
	if err != nil {
		return models.PermissionNone, err
	}

	// Check explicit user permission
	var userPermLevel string
	err = r.pool.QueryRow(ctx,
		`SELECT permission_level FROM dashboard_permissions
		 WHERE dashboard_id = $1 AND user_id = $2`,
		dashboardID, userID,
	).Scan(&userPermLevel)
	if err == nil {
		return models.PermissionLevel(userPermLevel), nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return models.PermissionNone, err
	}

	// Check role-based permission (get highest permission level from user's roles)
	var rolePermLevel string
	err = r.pool.QueryRow(ctx,
		`SELECT dp.permission_level FROM dashboard_permissions dp
		 INNER JOIN user_roles ur ON dp.role_id = ur.role_id
		 WHERE dp.dashboard_id = $1 AND ur.user_id = $2
		 ORDER BY CASE dp.permission_level WHEN 'edit' THEN 1 WHEN 'view' THEN 2 END
		 LIMIT 1`,
		dashboardID, userID,
	).Scan(&rolePermLevel)
	if err == nil {
		return models.PermissionLevel(rolePermLevel), nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return models.PermissionNone, err
	}

	// If public, return view permission
	if isPublic {
		return models.PermissionView, nil
	}

	return models.PermissionNone, nil
}

// GetAccessibleDashboards returns all dashboards accessible to a user
func (r *PostgresDashboardPermissionRepository) GetAccessibleDashboards(ctx context.Context, userID uuid.UUID) ([]models.Dashboard, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT DISTINCT d.id, d.user_id, d.name, d.description, d.layout, COALESCE(d.is_public, false), COALESCE(d.parameters, '[]'), d.created_at, d.updated_at,
		        CASE
		            WHEN d.user_id = $1 THEN 'owner'
		            WHEN dp_user.permission_level IS NOT NULL THEN dp_user.permission_level
		            WHEN dp_role.permission_level IS NOT NULL THEN dp_role.permission_level
		            WHEN COALESCE(d.is_public, false) = true THEN 'view'
		            ELSE ''
		        END as my_permission
		 FROM dashboards d
		 LEFT JOIN dashboard_permissions dp_user ON d.id = dp_user.dashboard_id AND dp_user.user_id = $1
		 LEFT JOIN (
		     SELECT dp.dashboard_id, MAX(CASE dp.permission_level WHEN 'edit' THEN 2 WHEN 'view' THEN 1 ELSE 0 END) as max_level,
		            CASE MAX(CASE dp.permission_level WHEN 'edit' THEN 2 WHEN 'view' THEN 1 ELSE 0 END) WHEN 2 THEN 'edit' WHEN 1 THEN 'view' ELSE '' END as permission_level
		     FROM dashboard_permissions dp
		     INNER JOIN user_roles ur ON dp.role_id = ur.role_id
		     WHERE ur.user_id = $1
		     GROUP BY dp.dashboard_id
		 ) dp_role ON d.id = dp_role.dashboard_id
		 WHERE d.user_id = $1
		    OR dp_user.id IS NOT NULL
		    OR dp_role.dashboard_id IS NOT NULL
		    OR COALESCE(d.is_public, false) = true
		 ORDER BY d.updated_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dashboards []models.Dashboard
	for rows.Next() {
		var d models.Dashboard
		var myPermission string
		if err := rows.Scan(&d.ID, &d.UserID, &d.Name, &d.Description, &d.Layout, &d.IsPublic, &d.Parameters, &d.CreatedAt, &d.UpdatedAt, &myPermission); err != nil {
			return nil, err
		}
		d.MyPermission = models.PermissionLevel(myPermission)
		dashboards = append(dashboards, d)
	}

	return dashboards, nil
}

// GetDashboardByIDWithPermission returns a dashboard if user has at least view permission
func (r *PostgresDashboardPermissionRepository) GetDashboardByIDWithPermission(ctx context.Context, dashboardID, userID uuid.UUID) (*models.Dashboard, error) {
	permLevel, err := r.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return nil, err
	}

	if !permLevel.CanView() {
		return nil, ErrNotFound
	}

	var d models.Dashboard
	err = r.pool.QueryRow(ctx,
		`SELECT id, user_id, name, description, layout, COALESCE(is_public, false), COALESCE(parameters, '[]'), created_at, updated_at
		 FROM dashboards WHERE id = $1`,
		dashboardID,
	).Scan(&d.ID, &d.UserID, &d.Name, &d.Description, &d.Layout, &d.IsPublic, &d.Parameters, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	d.MyPermission = permLevel
	return &d, nil
}

// GetDashboardPermissions returns all permissions for a dashboard
func (r *PostgresDashboardPermissionRepository) GetDashboardPermissions(ctx context.Context, dashboardID uuid.UUID) ([]models.DashboardPermission, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT dp.id, dp.dashboard_id, dp.user_id, dp.role_id, dp.permission_level, dp.granted_at, dp.granted_by,
		        u.email as user_email, u.name as user_name, r.name as role_name
		 FROM dashboard_permissions dp
		 LEFT JOIN users u ON dp.user_id = u.id
		 LEFT JOIN roles r ON dp.role_id = r.id
		 WHERE dp.dashboard_id = $1
		 ORDER BY dp.granted_at DESC`,
		dashboardID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var permissions []models.DashboardPermission
	for rows.Next() {
		var p models.DashboardPermission
		if err := rows.Scan(&p.ID, &p.DashboardID, &p.UserID, &p.RoleID, &p.PermissionLevel, &p.GrantedAt, &p.GrantedBy,
			&p.UserEmail, &p.UserName, &p.RoleName); err != nil {
			return nil, err
		}
		permissions = append(permissions, p)
	}

	return permissions, nil
}

// GrantPermission grants a permission to a user or role
func (r *PostgresDashboardPermissionRepository) GrantPermission(ctx context.Context, dashboardID uuid.UUID, userID, roleID *uuid.UUID, level models.PermissionLevel, grantedBy uuid.UUID) (*models.DashboardPermission, error) {
	// Validate that exactly one of userID or roleID is provided
	if (userID == nil && roleID == nil) || (userID != nil && roleID != nil) {
		return nil, errors.New("exactly one of user_id or role_id must be provided")
	}

	// Validate permission level
	if level != models.PermissionView && level != models.PermissionEdit {
		return nil, errors.New("permission_level must be 'view' or 'edit'")
	}

	var p models.DashboardPermission

	if userID != nil {
		// Upsert user permission
		err := r.pool.QueryRow(ctx,
			`INSERT INTO dashboard_permissions (dashboard_id, user_id, permission_level, granted_by)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (dashboard_id, user_id) WHERE user_id IS NOT NULL
			 DO UPDATE SET permission_level = $3, granted_at = CURRENT_TIMESTAMP, granted_by = $4
			 RETURNING id, dashboard_id, user_id, role_id, permission_level, granted_at, granted_by`,
			dashboardID, userID, level, grantedBy,
		).Scan(&p.ID, &p.DashboardID, &p.UserID, &p.RoleID, &p.PermissionLevel, &p.GrantedAt, &p.GrantedBy)
		if err != nil {
			return nil, err
		}
	} else {
		// Upsert role permission
		err := r.pool.QueryRow(ctx,
			`INSERT INTO dashboard_permissions (dashboard_id, role_id, permission_level, granted_by)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (dashboard_id, role_id) WHERE role_id IS NOT NULL
			 DO UPDATE SET permission_level = $3, granted_at = CURRENT_TIMESTAMP, granted_by = $4
			 RETURNING id, dashboard_id, user_id, role_id, permission_level, granted_at, granted_by`,
			dashboardID, roleID, level, grantedBy,
		).Scan(&p.ID, &p.DashboardID, &p.UserID, &p.RoleID, &p.PermissionLevel, &p.GrantedAt, &p.GrantedBy)
		if err != nil {
			return nil, err
		}
	}

	return &p, nil
}

// RevokePermission revokes a permission
func (r *PostgresDashboardPermissionRepository) RevokePermission(ctx context.Context, permissionID uuid.UUID) error {
	result, err := r.pool.Exec(ctx,
		`DELETE FROM dashboard_permissions WHERE id = $1`,
		permissionID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// UpdateVisibility updates the is_public flag
func (r *PostgresDashboardPermissionRepository) UpdateVisibility(ctx context.Context, dashboardID uuid.UUID, isPublic bool) error {
	result, err := r.pool.Exec(ctx,
		`UPDATE dashboards SET is_public = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
		dashboardID, isPublic,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// GetDashboardOwner returns the owner user ID of a dashboard
func (r *PostgresDashboardPermissionRepository) GetDashboardOwner(ctx context.Context, dashboardID uuid.UUID) (uuid.UUID, error) {
	var ownerID uuid.UUID
	err := r.pool.QueryRow(ctx,
		`SELECT user_id FROM dashboards WHERE id = $1`,
		dashboardID,
	).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, ErrNotFound
		}
		return uuid.Nil, err
	}

	return ownerID, nil
}
