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
		 SET name = COALESCE(NULLIF($3, ''), name),
		     description = COALESCE($4, description),
		     layout = COALESCE($5, layout),
		     parameters = COALESCE($6, parameters),
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1
		 RETURNING id, user_id, name, description, layout, COALESCE(is_public, false), COALESCE(parameters, '[]'), created_at, updated_at`,
		id, userID, req.Name, req.Description, req.Layout, req.Parameters,
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
		`SELECT id, dashboard_id, name, query_id, chart_type, chart_config, position, created_at, updated_at
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
		if err := rows.Scan(&w.ID, &w.DashboardID, &w.Name, &w.QueryID, &w.ChartType, &w.ChartConfig, &w.Position, &w.CreatedAt, &w.UpdatedAt); err != nil {
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
		`SELECT id, dashboard_id, name, query_id, chart_type, chart_config, position, created_at, updated_at
		 FROM dashboard_widgets WHERE dashboard_id = $1 AND id = $2`,
		dashboardID, widgetID,
	).Scan(&w.ID, &w.DashboardID, &w.Name, &w.QueryID, &w.ChartType, &w.ChartConfig, &w.Position, &w.CreatedAt, &w.UpdatedAt)
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
		`INSERT INTO dashboard_widgets (dashboard_id, name, query_id, chart_type, chart_config, position)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, dashboard_id, name, query_id, chart_type, chart_config, position, created_at, updated_at`,
		dashboardID, req.Name, req.QueryID, req.ChartType, req.ChartConfig, req.Position,
	).Scan(&w.ID, &w.DashboardID, &w.Name, &w.QueryID, &w.ChartType, &w.ChartConfig, &w.Position, &w.CreatedAt, &w.UpdatedAt)
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
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND dashboard_id = $2
		 RETURNING id, dashboard_id, name, query_id, chart_type, chart_config, position, created_at, updated_at`,
		id, dashboardID, req.Name, req.QueryID, req.ChartType, req.ChartConfig, req.Position,
	).Scan(&w.ID, &w.DashboardID, &w.Name, &w.QueryID, &w.ChartType, &w.ChartConfig, &w.Position, &w.CreatedAt, &w.UpdatedAt)
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
