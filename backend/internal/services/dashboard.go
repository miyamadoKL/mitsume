package services

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/mitsume/backend/internal/database"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
)

var (
	ErrPermissionDenied = errors.New("permission denied")
	ErrInvalidRequest   = errors.New("invalid request")
)

type DashboardService struct {
	permRepo *repository.PostgresDashboardPermissionRepository
}

func NewDashboardService() *DashboardService {
	pool := database.GetPool()
	return &DashboardService{
		permRepo: repository.NewPostgresDashboardPermissionRepository(pool),
	}
}

// Dashboard CRUD operations with permission checks

// GetDashboards returns all dashboards accessible to the user (owned + shared + public)
func (s *DashboardService) GetDashboards(ctx context.Context, userID uuid.UUID) ([]models.Dashboard, error) {
	return s.permRepo.GetAccessibleDashboards(ctx, userID)
}

// GetDashboard returns a specific dashboard if user has view permission
func (s *DashboardService) GetDashboard(ctx context.Context, id, userID uuid.UUID) (*models.Dashboard, error) {
	dashboard, err := s.permRepo.GetDashboardByIDWithPermission(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	// Get widgets
	widgets, err := s.GetWidgets(ctx, id)
	if err != nil {
		return nil, err
	}
	dashboard.Widgets = widgets

	// Get permissions if user is owner
	if dashboard.MyPermission.IsOwner() {
		permissions, err := s.permRepo.GetDashboardPermissions(ctx, id)
		if err != nil {
			return nil, err
		}
		dashboard.Permissions = permissions
	}

	return dashboard, nil
}

func (s *DashboardService) CreateDashboard(ctx context.Context, userID uuid.UUID, req *models.CreateDashboardRequest) (*models.Dashboard, error) {
	pool := database.GetPool()

	defaultLayout, _ := json.Marshal([]interface{}{})
	defaultParams, _ := json.Marshal([]interface{}{})

	var d models.Dashboard
	err := pool.QueryRow(ctx,
		`INSERT INTO dashboards (user_id, name, description, layout, is_public, parameters)
		 VALUES ($1, $2, $3, $4, false, $5)
		 RETURNING id, user_id, name, description, layout, COALESCE(is_public, false), COALESCE(parameters, '[]'), created_at, updated_at`,
		userID, req.Name, req.Description, defaultLayout, defaultParams,
	).Scan(&d.ID, &d.UserID, &d.Name, &d.Description, &d.Layout, &d.IsPublic, &d.Parameters, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, err
	}

	d.MyPermission = models.PermissionOwner
	return &d, nil
}

func (s *DashboardService) UpdateDashboard(ctx context.Context, id, userID uuid.UUID, req *models.UpdateDashboardRequest) (*models.Dashboard, error) {
	// Check permission
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	if !permLevel.CanEdit() {
		return nil, ErrPermissionDenied
	}

	pool := database.GetPool()

	var d models.Dashboard
	err = pool.QueryRow(ctx,
		`UPDATE dashboards
		 SET name = COALESCE(NULLIF($2, ''), name),
		     description = COALESCE($3, description),
		     layout = COALESCE($4, layout),
		     parameters = COALESCE($5, parameters),
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1
		 RETURNING id, user_id, name, description, layout, COALESCE(is_public, false), COALESCE(parameters, '[]'), created_at, updated_at`,
		id, req.Name, req.Description, req.Layout, req.Parameters,
	).Scan(&d.ID, &d.UserID, &d.Name, &d.Description, &d.Layout, &d.IsPublic, &d.Parameters, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	d.MyPermission = permLevel

	// Populate widgets/permissions to match GetDashboard response shape.
	widgets, err := s.GetWidgets(ctx, id)
	if err != nil {
		return nil, err
	}
	d.Widgets = widgets

	if permLevel.IsOwner() {
		permissions, err := s.permRepo.GetDashboardPermissions(ctx, id)
		if err != nil {
			return nil, err
		}
		d.Permissions = permissions
	}
	return &d, nil
}

func (s *DashboardService) DeleteDashboard(ctx context.Context, id, userID uuid.UUID) error {
	// Only owner can delete
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, id, userID)
	if err != nil {
		return err
	}

	if !permLevel.IsOwner() {
		return ErrPermissionDenied
	}

	pool := database.GetPool()

	result, err := pool.Exec(ctx, `DELETE FROM dashboards WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// GetDashboardParameters returns the dashboard parameters JSON without loading widgets.
// Permission checks must be performed by the caller.
func (s *DashboardService) GetDashboardParameters(ctx context.Context, dashboardID uuid.UUID) (json.RawMessage, error) {
	pool := database.GetPool()

	var params json.RawMessage
	err := pool.QueryRow(ctx, `SELECT COALESCE(parameters, '[]') FROM dashboards WHERE id = $1`, dashboardID).Scan(&params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return params, nil
}

// Widget CRUD operations

func (s *DashboardService) GetWidgets(ctx context.Context, dashboardID uuid.UUID) ([]models.Widget, error) {
	pool := database.GetPool()

	rows, err := pool.Query(ctx,
		`SELECT id, dashboard_id, name, query_id, chart_type, chart_config, position, responsive_positions, created_at, updated_at
		 FROM dashboard_widgets WHERE dashboard_id = $1`,
		dashboardID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var widgets []models.Widget
	for rows.Next() {
		var w models.Widget
		if err := rows.Scan(&w.ID, &w.DashboardID, &w.Name, &w.QueryID, &w.ChartType, &w.ChartConfig, &w.Position, &w.ResponsivePositions, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		widgets = append(widgets, w)
	}

	return widgets, nil
}

// GetWidget returns a single widget by ID (optimized for single widget fetch)
func (s *DashboardService) GetWidget(ctx context.Context, dashboardID, widgetID uuid.UUID) (*models.Widget, error) {
	pool := database.GetPool()

	var w models.Widget
	err := pool.QueryRow(ctx,
		`SELECT id, dashboard_id, name, query_id, chart_type, chart_config, position, responsive_positions, created_at, updated_at
		 FROM dashboard_widgets WHERE dashboard_id = $1 AND id = $2`,
		dashboardID, widgetID,
	).Scan(&w.ID, &w.DashboardID, &w.Name, &w.QueryID, &w.ChartType, &w.ChartConfig, &w.Position, &w.ResponsivePositions, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &w, nil
}

func (s *DashboardService) CreateWidget(ctx context.Context, dashboardID, userID uuid.UUID, req *models.CreateWidgetRequest) (*models.Widget, error) {
	// Check edit permission
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return nil, err
	}

	if !permLevel.CanEdit() {
		return nil, ErrPermissionDenied
	}

	// For owner, also check query ownership if query is specified
	if permLevel.IsOwner() && req.QueryID != nil {
		if err := s.ensureSavedQueryOwned(ctx, *req.QueryID, userID); err != nil {
			return nil, err
		}
	}

	pool := database.GetPool()

	var w models.Widget
	err = pool.QueryRow(ctx,
		`INSERT INTO dashboard_widgets (dashboard_id, name, query_id, chart_type, chart_config, position, responsive_positions)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, dashboard_id, name, query_id, chart_type, chart_config, position, responsive_positions, created_at, updated_at`,
		dashboardID, req.Name, req.QueryID, req.ChartType, req.ChartConfig, req.Position, req.ResponsivePositions,
	).Scan(&w.ID, &w.DashboardID, &w.Name, &w.QueryID, &w.ChartType, &w.ChartConfig, &w.Position, &w.ResponsivePositions, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &w, nil
}

func (s *DashboardService) UpdateWidget(ctx context.Context, id, dashboardID, userID uuid.UUID, req *models.UpdateWidgetRequest) (*models.Widget, error) {
	// Check edit permission
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return nil, err
	}

	if !permLevel.CanEdit() {
		return nil, ErrPermissionDenied
	}

	// For owner, also check query ownership if query is specified
	if permLevel.IsOwner() && req.QueryID != nil {
		if err := s.ensureSavedQueryOwned(ctx, *req.QueryID, userID); err != nil {
			return nil, err
		}
	}

	pool := database.GetPool()

	var w models.Widget
	err = pool.QueryRow(ctx,
		`UPDATE dashboard_widgets
		 SET name = COALESCE(NULLIF($3, ''), name),
		     query_id = COALESCE($4, query_id),
		     chart_type = COALESCE(NULLIF($5, ''), chart_type),
		     chart_config = COALESCE($6, chart_config),
		     position = COALESCE($7, position),
		     responsive_positions = COALESCE($8, responsive_positions),
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND dashboard_id = $2
		 RETURNING id, dashboard_id, name, query_id, chart_type, chart_config, position, responsive_positions, created_at, updated_at`,
		id, dashboardID, req.Name, req.QueryID, req.ChartType, req.ChartConfig, req.Position, req.ResponsivePositions,
	).Scan(&w.ID, &w.DashboardID, &w.Name, &w.QueryID, &w.ChartType, &w.ChartConfig, &w.Position, &w.ResponsivePositions, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &w, nil
}

func (s *DashboardService) DeleteWidget(ctx context.Context, id, dashboardID, userID uuid.UUID) error {
	// Check edit permission
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return err
	}

	if !permLevel.CanEdit() {
		return ErrPermissionDenied
	}

	pool := database.GetPool()

	result, err := pool.Exec(ctx,
		`DELETE FROM dashboard_widgets WHERE id = $1 AND dashboard_id = $2`,
		id, dashboardID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// BatchUpdateWidgets performs atomic create/update/delete operations within a transaction
func (s *DashboardService) BatchUpdateWidgets(ctx context.Context, dashboardID, userID uuid.UUID, req *models.BatchWidgetUpdateRequest) (*models.BatchWidgetUpdateResponse, error) {
	// Check edit permission
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return nil, err
	}

	if !permLevel.CanEdit() {
		return nil, ErrPermissionDenied
	}

	pool := database.GetPool()

	// Start transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	response := &models.BatchWidgetUpdateResponse{
		Created: []models.Widget{},
		Updated: []models.Widget{},
		Deleted: []string{},
	}

	// 1. Delete widgets first (within transaction)
	for _, widgetID := range req.Delete {
		id, err := uuid.Parse(widgetID)
		if err != nil {
			return nil, ErrInvalidRequest
		}

		result, err := tx.Exec(ctx,
			`DELETE FROM dashboard_widgets WHERE id = $1 AND dashboard_id = $2`,
			id, dashboardID,
		)
		if err != nil {
			return nil, err
		}

		if result.RowsAffected() > 0 {
			response.Deleted = append(response.Deleted, widgetID)
		}
	}

	// 2. Create new widgets (within transaction)
	for _, createReq := range req.Create {
		var w models.Widget
		err := tx.QueryRow(ctx,
			`INSERT INTO dashboard_widgets (dashboard_id, name, query_id, chart_type, chart_config, position, responsive_positions)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 RETURNING id, dashboard_id, name, query_id, chart_type, chart_config, position, responsive_positions, created_at, updated_at`,
			dashboardID, createReq.Name, createReq.QueryID, createReq.ChartType, createReq.ChartConfig, createReq.Position, createReq.ResponsivePositions,
		).Scan(&w.ID, &w.DashboardID, &w.Name, &w.QueryID, &w.ChartType, &w.ChartConfig, &w.Position, &w.ResponsivePositions, &w.CreatedAt, &w.UpdatedAt)
		if err != nil {
			return nil, err
		}
		response.Created = append(response.Created, w)
	}

	// 3. Update existing widgets (within transaction)
	for widgetID, updateReq := range req.Update {
		id, err := uuid.Parse(widgetID)
		if err != nil {
			return nil, ErrInvalidRequest
		}

		var w models.Widget
		err = tx.QueryRow(ctx,
			`UPDATE dashboard_widgets
			 SET name = COALESCE(NULLIF($3, ''), name),
			     query_id = COALESCE($4, query_id),
			     chart_type = COALESCE(NULLIF($5, ''), chart_type),
			     chart_config = COALESCE($6, chart_config),
			     position = COALESCE($7, position),
			     responsive_positions = COALESCE($8, responsive_positions),
			     updated_at = CURRENT_TIMESTAMP
			 WHERE id = $1 AND dashboard_id = $2
			 RETURNING id, dashboard_id, name, query_id, chart_type, chart_config, position, responsive_positions, created_at, updated_at`,
			id, dashboardID, updateReq.Name, updateReq.QueryID, updateReq.ChartType, updateReq.ChartConfig, updateReq.Position, updateReq.ResponsivePositions,
		).Scan(&w.ID, &w.DashboardID, &w.Name, &w.QueryID, &w.ChartType, &w.ChartConfig, &w.Position, &w.ResponsivePositions, &w.CreatedAt, &w.UpdatedAt)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				// Widget not found - skip but don't fail the whole transaction
				continue
			}
			return nil, err
		}
		response.Updated = append(response.Updated, w)
	}

	// Commit transaction - all changes are atomic
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return response, nil
}

func (s *DashboardService) DuplicateWidget(ctx context.Context, id, dashboardID, userID uuid.UUID) (*models.Widget, error) {
	// Check edit permission
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return nil, err
	}

	if !permLevel.CanEdit() {
		return nil, ErrPermissionDenied
	}

	pool := database.GetPool()

	// Get the original widget
	var original models.Widget
	err = pool.QueryRow(ctx,
		`SELECT id, dashboard_id, name, query_id, chart_type, chart_config, position, responsive_positions, created_at, updated_at
		 FROM dashboard_widgets WHERE id = $1 AND dashboard_id = $2`,
		id, dashboardID,
	).Scan(&original.ID, &original.DashboardID, &original.Name, &original.QueryID, &original.ChartType, &original.ChartConfig, &original.Position, &original.ResponsivePositions, &original.CreatedAt, &original.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	// Calculate new position (offset Y by the widget's height)
	var pos models.LayoutPosition
	if err := json.Unmarshal(original.Position, &pos); err == nil {
		pos.Y += pos.H
	}
	newPosition, _ := json.Marshal(pos)

	// Create the duplicate with "(Copy)" appended to name
	var w models.Widget
	err = pool.QueryRow(ctx,
		`INSERT INTO dashboard_widgets (dashboard_id, name, query_id, chart_type, chart_config, position, responsive_positions)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, dashboard_id, name, query_id, chart_type, chart_config, position, responsive_positions, created_at, updated_at`,
		dashboardID, original.Name+" (Copy)", original.QueryID, original.ChartType, original.ChartConfig, newPosition, original.ResponsivePositions,
	).Scan(&w.ID, &w.DashboardID, &w.Name, &w.QueryID, &w.ChartType, &w.ChartConfig, &w.Position, &w.ResponsivePositions, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &w, nil
}

// Permission management (only owner can manage permissions)

func (s *DashboardService) GetDashboardPermissions(ctx context.Context, dashboardID, userID uuid.UUID) ([]models.DashboardPermission, error) {
	// Only owner can view permissions
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return nil, err
	}

	if !permLevel.IsOwner() {
		return nil, ErrPermissionDenied
	}

	return s.permRepo.GetDashboardPermissions(ctx, dashboardID)
}

func (s *DashboardService) GrantPermission(ctx context.Context, dashboardID, userID uuid.UUID, req *models.GrantDashboardPermissionRequest) (*models.DashboardPermission, error) {
	// Only owner can grant permissions
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return nil, err
	}

	if !permLevel.IsOwner() {
		return nil, ErrPermissionDenied
	}

	// Validate request
	if (req.UserID == nil && req.RoleID == nil) || (req.UserID != nil && req.RoleID != nil) {
		return nil, ErrInvalidRequest
	}

	if req.PermissionLevel != models.PermissionView && req.PermissionLevel != models.PermissionEdit {
		return nil, ErrInvalidRequest
	}

	// Cannot grant permission to self
	if req.UserID != nil && *req.UserID == userID {
		return nil, ErrInvalidRequest
	}

	return s.permRepo.GrantPermission(ctx, dashboardID, req.UserID, req.RoleID, req.PermissionLevel, userID)
}

func (s *DashboardService) RevokePermission(ctx context.Context, dashboardID, permissionID, userID uuid.UUID) error {
	// Only owner can revoke permissions
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return err
	}

	if !permLevel.IsOwner() {
		return ErrPermissionDenied
	}

	return s.permRepo.RevokePermission(ctx, permissionID)
}

func (s *DashboardService) UpdateVisibility(ctx context.Context, dashboardID, userID uuid.UUID, req *models.UpdateDashboardVisibilityRequest) error {
	// Only owner can change visibility
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return err
	}

	if !permLevel.IsOwner() {
		return ErrPermissionDenied
	}

	return s.permRepo.UpdateVisibility(ctx, dashboardID, req.IsPublic)
}

// GetUserPermissionLevel returns the permission level for a user on a dashboard
func (s *DashboardService) GetUserPermissionLevel(ctx context.Context, dashboardID, userID uuid.UUID) (models.PermissionLevel, error) {
	return s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
}

// SaveAsDraft saves the current dashboard state as a draft
// If the dashboard is already a draft, it updates it in place
// If the dashboard is published, it creates a new draft linked to the original
func (s *DashboardService) SaveAsDraft(ctx context.Context, dashboardID, userID uuid.UUID) (*models.Dashboard, error) {
	// Check edit permission
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return nil, err
	}

	if !permLevel.CanEdit() {
		return nil, ErrPermissionDenied
	}

	pool := database.GetPool()

	// Check if this is already a draft
	var isDraft bool
	err = pool.QueryRow(ctx, `SELECT COALESCE(is_draft, FALSE) FROM dashboards WHERE id = $1`, dashboardID).Scan(&isDraft)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	if isDraft {
		// Already a draft - just update the updated_at
		var d models.Dashboard
		err = pool.QueryRow(ctx,
			`UPDATE dashboards SET updated_at = CURRENT_TIMESTAMP WHERE id = $1
			 RETURNING id, user_id, name, description, layout, COALESCE(is_public, false), COALESCE(parameters, '[]'), COALESCE(is_draft, false), draft_of, created_at, updated_at`,
			dashboardID,
		).Scan(&d.ID, &d.UserID, &d.Name, &d.Description, &d.Layout, &d.IsPublic, &d.Parameters, &d.IsDraft, &d.DraftOf, &d.CreatedAt, &d.UpdatedAt)
		if err != nil {
			return nil, err
		}
		d.MyPermission = permLevel
		return &d, nil
	}

	// Mark as draft
	var d models.Dashboard
	err = pool.QueryRow(ctx,
		`UPDATE dashboards SET is_draft = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1
		 RETURNING id, user_id, name, description, layout, COALESCE(is_public, false), COALESCE(parameters, '[]'), COALESCE(is_draft, false), draft_of, created_at, updated_at`,
		dashboardID,
	).Scan(&d.ID, &d.UserID, &d.Name, &d.Description, &d.Layout, &d.IsPublic, &d.Parameters, &d.IsDraft, &d.DraftOf, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, err
	}

	d.MyPermission = permLevel
	return &d, nil
}

// PublishDraft publishes a draft dashboard (clears the is_draft flag)
func (s *DashboardService) PublishDraft(ctx context.Context, dashboardID, userID uuid.UUID) (*models.Dashboard, error) {
	// Check edit permission
	permLevel, err := s.permRepo.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		return nil, err
	}

	if !permLevel.CanEdit() {
		return nil, ErrPermissionDenied
	}

	pool := database.GetPool()

	var d models.Dashboard
	err = pool.QueryRow(ctx,
		`UPDATE dashboards SET is_draft = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1
		 RETURNING id, user_id, name, description, layout, COALESCE(is_public, false), COALESCE(parameters, '[]'), COALESCE(is_draft, false), draft_of, created_at, updated_at`,
		dashboardID,
	).Scan(&d.ID, &d.UserID, &d.Name, &d.Description, &d.Layout, &d.IsPublic, &d.Parameters, &d.IsDraft, &d.DraftOf, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	d.MyPermission = permLevel

	// Load widgets
	widgets, err := s.GetWidgets(ctx, dashboardID)
	if err != nil {
		return nil, err
	}
	d.Widgets = widgets

	return &d, nil
}

// GetDashboardOwner returns the owner user ID of a dashboard
func (s *DashboardService) GetDashboardOwner(ctx context.Context, dashboardID uuid.UUID) (uuid.UUID, error) {
	return s.permRepo.GetDashboardOwner(ctx, dashboardID)
}

// Helper functions

func (s *DashboardService) ensureSavedQueryOwned(ctx context.Context, queryID, userID uuid.UUID) error {
	pool := database.GetPool()
	var exists bool
	err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM saved_queries WHERE id = $1 AND user_id = $2)`, queryID, userID).
		Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	return nil
}
