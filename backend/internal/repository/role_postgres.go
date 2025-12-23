package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mitsume/backend/internal/models"
)

// PostgresRoleRepository implements RoleRepository using PostgreSQL
type PostgresRoleRepository struct {
	pool *pgxpool.Pool
}

// NewPostgresRoleRepository creates a new PostgresRoleRepository
func NewPostgresRoleRepository(pool *pgxpool.Pool) *PostgresRoleRepository {
	return &PostgresRoleRepository{pool: pool}
}

// GetAll returns all roles
func (r *PostgresRoleRepository) GetAll(ctx context.Context) ([]models.Role, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, description, is_system, created_at, updated_at
		 FROM roles ORDER BY is_system DESC, name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []models.Role
	for rows.Next() {
		var role models.Role
		var description *string
		if err := rows.Scan(&role.ID, &role.Name, &description, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt); err != nil {
			return nil, err
		}
		if description != nil {
			role.Description = *description
		}
		roles = append(roles, role)
	}
	return roles, rows.Err()
}

// GetByID returns a role by ID
func (r *PostgresRoleRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Role, error) {
	var role models.Role
	var description *string
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, description, is_system, created_at, updated_at
		 FROM roles WHERE id = $1`,
		id,
	).Scan(&role.ID, &role.Name, &description, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if description != nil {
		role.Description = *description
	}
	return &role, nil
}

// GetByName returns a role by name
func (r *PostgresRoleRepository) GetByName(ctx context.Context, name string) (*models.Role, error) {
	var role models.Role
	var description *string
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, description, is_system, created_at, updated_at
		 FROM roles WHERE name = $1`,
		name,
	).Scan(&role.ID, &role.Name, &description, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if description != nil {
		role.Description = *description
	}
	return &role, nil
}

// Create creates a new role
func (r *PostgresRoleRepository) Create(ctx context.Context, name, description string) (*models.Role, error) {
	var role models.Role
	var desc *string
	err := r.pool.QueryRow(ctx,
		`INSERT INTO roles (name, description)
		 VALUES ($1, $2)
		 RETURNING id, name, description, is_system, created_at, updated_at`,
		name, description,
	).Scan(&role.ID, &role.Name, &desc, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if desc != nil {
		role.Description = *desc
	}
	return &role, nil
}

// Update updates an existing role
func (r *PostgresRoleRepository) Update(ctx context.Context, id uuid.UUID, name, description string) (*models.Role, error) {
	var role models.Role
	var desc *string
	err := r.pool.QueryRow(ctx,
		`UPDATE roles SET name = $2, description = $3, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND is_system = FALSE
		 RETURNING id, name, description, is_system, created_at, updated_at`,
		id, name, description,
	).Scan(&role.ID, &role.Name, &desc, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if desc != nil {
		role.Description = *desc
	}
	return &role, nil
}

// Delete deletes a role (non-system roles only)
func (r *PostgresRoleRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.pool.Exec(ctx,
		`DELETE FROM roles WHERE id = $1 AND is_system = FALSE`,
		id,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetUserRoles returns all roles assigned to a user
func (r *PostgresRoleRepository) GetUserRoles(ctx context.Context, userID uuid.UUID) ([]models.Role, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at
		 FROM roles r
		 INNER JOIN user_roles ur ON r.id = ur.role_id
		 WHERE ur.user_id = $1
		 ORDER BY r.is_system DESC, r.name ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []models.Role
	for rows.Next() {
		var role models.Role
		var description *string
		if err := rows.Scan(&role.ID, &role.Name, &description, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt); err != nil {
			return nil, err
		}
		if description != nil {
			role.Description = *description
		}
		roles = append(roles, role)
	}
	return roles, rows.Err()
}

// GetRoleUsers returns all users with a specific role
func (r *PostgresRoleRepository) GetRoleUsers(ctx context.Context, roleID uuid.UUID) ([]models.User, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT u.id, u.email, u.name, u.auth_provider, u.created_at, u.updated_at
		 FROM users u
		 INNER JOIN user_roles ur ON u.id = ur.user_id
		 WHERE ur.role_id = $1
		 ORDER BY u.name ASC`,
		roleID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		if err := rows.Scan(&user.ID, &user.Email, &user.Name, &user.AuthProvider, &user.CreatedAt, &user.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

// AssignRole assigns a role to a user
func (r *PostgresRoleRepository) AssignRole(ctx context.Context, userID, roleID uuid.UUID, assignedBy *uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO user_roles (user_id, role_id, assigned_by)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, role_id) DO NOTHING`,
		userID, roleID, assignedBy,
	)
	return err
}

// UnassignRole removes a role from a user
func (r *PostgresRoleRepository) UnassignRole(ctx context.Context, userID, roleID uuid.UUID) error {
	result, err := r.pool.Exec(ctx,
		`DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`,
		userID, roleID,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetRoleCatalogs returns all catalog permissions for a role
func (r *PostgresRoleRepository) GetRoleCatalogs(ctx context.Context, roleID uuid.UUID) ([]string, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT catalog_name FROM role_catalog_permissions WHERE role_id = $1 ORDER BY catalog_name`,
		roleID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var catalogs []string
	for rows.Next() {
		var catalog string
		if err := rows.Scan(&catalog); err != nil {
			return nil, err
		}
		catalogs = append(catalogs, catalog)
	}
	return catalogs, rows.Err()
}

// SetRoleCatalogs sets the catalog permissions for a role (replaces existing)
func (r *PostgresRoleRepository) SetRoleCatalogs(ctx context.Context, roleID uuid.UUID, catalogs []string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Delete existing permissions
	_, err = tx.Exec(ctx, `DELETE FROM role_catalog_permissions WHERE role_id = $1`, roleID)
	if err != nil {
		return err
	}

	// Insert new permissions
	for _, catalog := range catalogs {
		_, err = tx.Exec(ctx,
			`INSERT INTO role_catalog_permissions (role_id, catalog_name) VALUES ($1, $2)`,
			roleID, catalog,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// GetUserAllowedCatalogs returns all catalogs a user can access (union of all role permissions)
func (r *PostgresRoleRepository) GetUserAllowedCatalogs(ctx context.Context, userID uuid.UUID) ([]string, error) {
	// Check if user has admin role (admin can access all catalogs)
	isAdmin, err := r.IsUserAdmin(ctx, userID)
	if err != nil {
		return nil, err
	}
	if isAdmin {
		// Return nil to indicate "all catalogs allowed"
		return nil, nil
	}

	rows, err := r.pool.Query(ctx,
		`SELECT DISTINCT rcp.catalog_name
		 FROM role_catalog_permissions rcp
		 INNER JOIN user_roles ur ON rcp.role_id = ur.role_id
		 WHERE ur.user_id = $1
		 ORDER BY rcp.catalog_name`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var catalogs []string
	for rows.Next() {
		var catalog string
		if err := rows.Scan(&catalog); err != nil {
			return nil, err
		}
		catalogs = append(catalogs, catalog)
	}
	return catalogs, rows.Err()
}

// IsUserAdmin checks if a user has the admin role
func (r *PostgresRoleRepository) IsUserAdmin(ctx context.Context, userID uuid.UUID) (bool, error) {
	var isAdmin bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM user_roles ur
			INNER JOIN roles r ON ur.role_id = r.id
			WHERE ur.user_id = $1 AND r.name = 'admin'
		)`,
		userID,
	).Scan(&isAdmin)
	if err != nil {
		return false, err
	}
	return isAdmin, nil
}

// GetAdminRole returns the admin role
func (r *PostgresRoleRepository) GetAdminRole(ctx context.Context) (*models.Role, error) {
	return r.GetByName(ctx, "admin")
}

// CountUsers returns the total number of users
func (r *PostgresRoleRepository) CountUsers(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

// GetAllUsersWithRoles returns all users with their assigned roles
func (r *PostgresRoleRepository) GetAllUsersWithRoles(ctx context.Context) ([]models.UserWithRoles, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT u.id, u.email, u.name, u.auth_provider, u.created_at, u.updated_at
		 FROM users u
		 ORDER BY u.name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.UserWithRoles
	for rows.Next() {
		var user models.UserWithRoles
		if err := rows.Scan(&user.ID, &user.Email, &user.Name, &user.AuthProvider, &user.CreatedAt, &user.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Fetch roles for each user
	for i := range users {
		roles, err := r.GetUserRoles(ctx, users[i].ID)
		if err != nil {
			return nil, err
		}
		users[i].Roles = roles
	}

	return users, nil
}
