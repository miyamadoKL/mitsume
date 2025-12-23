package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
)

// UserRepository defines the interface for user data access
type UserRepository interface {
	// FindByID retrieves a user by their ID
	FindByID(ctx context.Context, id uuid.UUID) (*models.User, error)

	// FindByEmail retrieves a user by their email address
	FindByEmail(ctx context.Context, email string) (*models.User, error)

	// FindByGoogleID retrieves a user by their Google ID
	FindByGoogleID(ctx context.Context, googleID string) (*models.User, error)

	// ExistsByEmail checks if a user with the given email exists
	ExistsByEmail(ctx context.Context, email string) (bool, error)

	// Create creates a new local user with email/password
	Create(ctx context.Context, email, passwordHash, name string) (*models.User, error)

	// CreateGoogleUser creates a new user authenticated via Google
	CreateGoogleUser(ctx context.Context, email, name, googleID string) (*models.User, error)
}

// TrinoExecutor defines the interface for Trino query execution
type TrinoExecutor interface {
	// ExecuteQuery executes a SQL query against Trino
	ExecuteQuery(ctx context.Context, query, catalog, schema string) (*models.QueryResult, error)

	// GetCatalogs returns a list of available catalogs
	GetCatalogs(ctx context.Context) ([]string, error)

	// GetSchemas returns a list of schemas in the specified catalog
	GetSchemas(ctx context.Context, catalog string) ([]string, error)

	// GetTables returns a list of tables in the specified catalog and schema
	GetTables(ctx context.Context, catalog, schema string) ([]string, error)
}

// CachedTrinoExecutor extends TrinoExecutor with caching capability
type CachedTrinoExecutor interface {
	TrinoExecutor

	// ExecuteQueryWithCache executes a query with optional caching support
	// priority: 1=Low (ad-hoc), 2=Normal (widget), 3=High (scheduled)
	// savedQueryID is used for cache invalidation
	ExecuteQueryWithCache(ctx context.Context, query, catalog, schema string, priority int, savedQueryID *uuid.UUID) (*models.QueryResult, error)
}

// QueryHistoryRecorder defines the interface for recording query execution history
type QueryHistoryRecorder interface {
	// SaveQueryHistory records a query execution in the history
	SaveQueryHistory(ctx context.Context, userID uuid.UUID, queryText, status string, executionTimeMs int64, rowCount int, errorMsg *string) error
}

// SavedQueryRepository defines the interface for saved query data access
type SavedQueryRepository interface {
	// GetAll returns all saved queries for a user
	GetAll(ctx context.Context, userID uuid.UUID) ([]models.SavedQuery, error)

	// GetByID returns a specific saved query
	GetByID(ctx context.Context, id, userID uuid.UUID) (*models.SavedQuery, error)

	// Create creates a new saved query
	Create(ctx context.Context, userID uuid.UUID, req *models.SaveQueryRequest) (*models.SavedQuery, error)

	// Update updates an existing saved query
	Update(ctx context.Context, id, userID uuid.UUID, req *models.UpdateQueryRequest) (*models.SavedQuery, error)

	// Delete deletes a saved query
	Delete(ctx context.Context, id, userID uuid.UUID) error
}

// QueryHistoryRepository defines the interface for query history data access
type QueryHistoryRepository interface {
	QueryHistoryRecorder

	// GetHistory returns query history for a user
	GetHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.QueryHistory, error)
}

// DashboardRepository defines the interface for dashboard data access
type DashboardRepository interface {
	// GetAll returns all dashboards for a user
	GetAll(ctx context.Context, userID uuid.UUID) ([]models.Dashboard, error)

	// GetByID returns a specific dashboard with widgets
	GetByID(ctx context.Context, id, userID uuid.UUID) (*models.Dashboard, error)

	// Create creates a new dashboard
	Create(ctx context.Context, userID uuid.UUID, name, description string) (*models.Dashboard, error)

	// Update updates an existing dashboard
	Update(ctx context.Context, id, userID uuid.UUID, name, description string, layout []byte) (*models.Dashboard, error)

	// Delete deletes a dashboard
	Delete(ctx context.Context, id, userID uuid.UUID) error
}

// DashboardPermissionRepository defines the interface for dashboard permission data access
type DashboardPermissionRepository interface {
	// GetUserPermissionLevel returns the permission level for a user on a dashboard
	// Returns PermissionOwner if user is owner, checks explicit permissions and role permissions
	GetUserPermissionLevel(ctx context.Context, dashboardID, userID uuid.UUID) (models.PermissionLevel, error)

	// GetAccessibleDashboards returns all dashboards accessible to a user (owned + shared + public)
	GetAccessibleDashboards(ctx context.Context, userID uuid.UUID) ([]models.Dashboard, error)

	// GetDashboardByIDWithPermission returns a dashboard if user has at least view permission
	GetDashboardByIDWithPermission(ctx context.Context, dashboardID, userID uuid.UUID) (*models.Dashboard, error)

	// GetDashboardPermissions returns all permissions for a dashboard
	GetDashboardPermissions(ctx context.Context, dashboardID uuid.UUID) ([]models.DashboardPermission, error)

	// GrantPermission grants a permission to a user or role
	GrantPermission(ctx context.Context, dashboardID uuid.UUID, userID, roleID *uuid.UUID, level models.PermissionLevel, grantedBy uuid.UUID) (*models.DashboardPermission, error)

	// RevokePermission revokes a permission
	RevokePermission(ctx context.Context, permissionID uuid.UUID) error

	// UpdateVisibility updates the is_public flag
	UpdateVisibility(ctx context.Context, dashboardID uuid.UUID, isPublic bool) error

	// GetDashboardOwner returns the owner user ID of a dashboard
	GetDashboardOwner(ctx context.Context, dashboardID uuid.UUID) (uuid.UUID, error)
}

// WidgetRepository defines the interface for widget data access
type WidgetRepository interface {
	// GetByDashboardID returns all widgets for a dashboard
	GetByDashboardID(ctx context.Context, dashboardID uuid.UUID) ([]models.Widget, error)

	// Create creates a new widget
	Create(ctx context.Context, dashboardID, userID uuid.UUID, name string, queryID *uuid.UUID, chartType string, chartConfig, position []byte) (*models.Widget, error)

	// Update updates an existing widget
	Update(ctx context.Context, id, dashboardID, userID uuid.UUID, name string, queryID *uuid.UUID, chartType string, chartConfig, position []byte) (*models.Widget, error)

	// Delete deletes a widget
	Delete(ctx context.Context, id, dashboardID, userID uuid.UUID) error
}

// RoleRepository defines the interface for role and permission data access
type RoleRepository interface {
	// GetAll returns all roles
	GetAll(ctx context.Context) ([]models.Role, error)

	// GetByID returns a role by ID
	GetByID(ctx context.Context, id uuid.UUID) (*models.Role, error)

	// GetByName returns a role by name
	GetByName(ctx context.Context, name string) (*models.Role, error)

	// Create creates a new role
	Create(ctx context.Context, name, description string) (*models.Role, error)

	// Update updates an existing role (non-system roles only)
	Update(ctx context.Context, id uuid.UUID, name, description string) (*models.Role, error)

	// Delete deletes a role (non-system roles only)
	Delete(ctx context.Context, id uuid.UUID) error

	// GetUserRoles returns all roles assigned to a user
	GetUserRoles(ctx context.Context, userID uuid.UUID) ([]models.Role, error)

	// GetRoleUsers returns all users with a specific role
	GetRoleUsers(ctx context.Context, roleID uuid.UUID) ([]models.User, error)

	// AssignRole assigns a role to a user
	AssignRole(ctx context.Context, userID, roleID uuid.UUID, assignedBy *uuid.UUID) error

	// UnassignRole removes a role from a user
	UnassignRole(ctx context.Context, userID, roleID uuid.UUID) error

	// GetRoleCatalogs returns all catalog permissions for a role
	GetRoleCatalogs(ctx context.Context, roleID uuid.UUID) ([]string, error)

	// SetRoleCatalogs sets the catalog permissions for a role
	SetRoleCatalogs(ctx context.Context, roleID uuid.UUID, catalogs []string) error

	// GetUserAllowedCatalogs returns all catalogs a user can access (nil means all catalogs for admin)
	GetUserAllowedCatalogs(ctx context.Context, userID uuid.UUID) ([]string, error)

	// IsUserAdmin checks if a user has the admin role
	IsUserAdmin(ctx context.Context, userID uuid.UUID) (bool, error)

	// GetAdminRole returns the admin role
	GetAdminRole(ctx context.Context) (*models.Role, error)

	// CountUsers returns the total number of users
	CountUsers(ctx context.Context) (int, error)

	// GetAllUsersWithRoles returns all users with their assigned roles
	GetAllUsersWithRoles(ctx context.Context) ([]models.UserWithRoles, error)
}
