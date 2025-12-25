package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// PermissionLevel represents the level of access to a dashboard
type PermissionLevel string

const (
	PermissionNone  PermissionLevel = ""
	PermissionView  PermissionLevel = "view"
	PermissionEdit  PermissionLevel = "edit"
	PermissionOwner PermissionLevel = "owner"
)

// CanView returns true if the permission level allows viewing
func (p PermissionLevel) CanView() bool {
	return p == PermissionView || p == PermissionEdit || p == PermissionOwner
}

// CanEdit returns true if the permission level allows editing
func (p PermissionLevel) CanEdit() bool {
	return p == PermissionEdit || p == PermissionOwner
}

// IsOwner returns true if the permission level is owner
func (p PermissionLevel) IsOwner() bool {
	return p == PermissionOwner
}

type Dashboard struct {
	ID          uuid.UUID       `json:"id"`
	UserID      uuid.UUID       `json:"user_id"`
	Name        string          `json:"name"`
	Description *string         `json:"description"`
	Layout      json.RawMessage `json:"layout"`
	IsPublic    bool            `json:"is_public"`
	Parameters  json.RawMessage `json:"parameters"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	Widgets     []Widget        `json:"widgets,omitempty"`
	// Permission info (populated when fetching for a specific user)
	MyPermission PermissionLevel       `json:"my_permission,omitempty"`
	Permissions  []DashboardPermission `json:"permissions,omitempty"`
}

// ParameterType represents the UI input type for a parameter
type ParameterType string

const (
	ParameterTypeText        ParameterType = "text"
	ParameterTypeNumber      ParameterType = "number"
	ParameterTypeDate        ParameterType = "date"
	ParameterTypeDateRange   ParameterType = "daterange"
	ParameterTypeSelect      ParameterType = "select"
	ParameterTypeMultiSelect ParameterType = "multiselect"
)

// SqlFormat represents how the parameter value should be formatted in SQL
type SqlFormat string

const (
	SqlFormatRaw        SqlFormat = "raw"         // Insert value as-is (legacy behavior)
	SqlFormatString     SqlFormat = "string"      // Quote and escape as string literal
	SqlFormatNumber     SqlFormat = "number"      // Validate as number
	SqlFormatDate       SqlFormat = "date"        // Format as date literal
	SqlFormatIdentifier SqlFormat = "identifier"  // Quote as identifier (column/table name)
	SqlFormatStringList SqlFormat = "string_list" // Format as comma-separated quoted strings
	SqlFormatNumberList SqlFormat = "number_list" // Format as comma-separated numbers
)

// EmptyBehavior represents how to handle empty/null parameter values
type EmptyBehavior string

const (
	EmptyBehaviorMissing   EmptyBehavior = "missing"    // Treat as unresolved (don't execute)
	EmptyBehaviorNull      EmptyBehavior = "null"       // Insert SQL NULL
	EmptyBehaviorMatchNone EmptyBehavior = "match_none" // Insert condition that matches nothing
)

// ParameterOption represents a selectable option for select/multiselect parameters
type ParameterOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// DateRangeTargets specifies which placeholders to map start/end values to
type DateRangeTargets struct {
	Start string `json:"start"` // Placeholder name for start date
	End   string `json:"end"`   // Placeholder name for end date
}

// ParameterDefinition defines a dashboard filter parameter
type ParameterDefinition struct {
	Name           string            `json:"name"`                      // Parameter name (matches {{name}} in SQL)
	Type           ParameterType     `json:"type"`                      // UI input type
	Label          *string           `json:"label,omitempty"`           // Display label
	Required       bool              `json:"required,omitempty"`        // Whether parameter is required
	SqlFormat      SqlFormat         `json:"sql_format,omitempty"`      // How to format for SQL (default: raw)
	Targets        *DateRangeTargets `json:"targets,omitempty"`         // For daterange: maps to start/end placeholders
	DefaultValue   interface{}       `json:"default_value,omitempty"`   // Default value (string, string[], or object)
	Options        []ParameterOption `json:"options,omitempty"`         // Static options for select/multiselect
	OptionsQueryID *uuid.UUID        `json:"options_query_id,omitempty"` // Saved query ID for dynamic options
	DependsOn      []string          `json:"depends_on,omitempty"`       // Cascade: parameter names this depends on
	EmptyBehavior  EmptyBehavior     `json:"empty_behavior,omitempty"`   // How to handle empty values
}

// DashboardPermission represents a permission granted to a user or role
type DashboardPermission struct {
	ID              uuid.UUID       `json:"id"`
	DashboardID     uuid.UUID       `json:"dashboard_id"`
	UserID          *uuid.UUID      `json:"user_id,omitempty"`
	RoleID          *uuid.UUID      `json:"role_id,omitempty"`
	PermissionLevel PermissionLevel `json:"permission_level"`
	GrantedAt       time.Time       `json:"granted_at"`
	GrantedBy       *uuid.UUID      `json:"granted_by,omitempty"`
	// Populated fields for display
	UserEmail *string `json:"user_email,omitempty"`
	UserName  *string `json:"user_name,omitempty"`
	RoleName  *string `json:"role_name,omitempty"`
}

type Widget struct {
	ID          uuid.UUID       `json:"id"`
	DashboardID uuid.UUID       `json:"dashboard_id"`
	Name        string          `json:"name"`
	QueryID     *uuid.UUID      `json:"query_id"`
	ChartType   string          `json:"chart_type"`
	ChartConfig json.RawMessage `json:"chart_config"`
	Position    json.RawMessage `json:"position"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type CreateDashboardRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
}

type UpdateDashboardRequest struct {
	Name        string          `json:"name"`
	Description *string         `json:"description"`
	Layout      json.RawMessage `json:"layout"`
	Parameters  json.RawMessage `json:"parameters"`
}

type CreateWidgetRequest struct {
	Name        string          `json:"name" binding:"required"`
	QueryID     *uuid.UUID      `json:"query_id"`
	ChartType   string          `json:"chart_type" binding:"required"`
	ChartConfig json.RawMessage `json:"chart_config"`
	Position    json.RawMessage `json:"position" binding:"required"`
}

type UpdateWidgetRequest struct {
	Name        string          `json:"name"`
	QueryID     *uuid.UUID      `json:"query_id"`
	ChartType   string          `json:"chart_type"`
	ChartConfig json.RawMessage `json:"chart_config"`
	Position    json.RawMessage `json:"position"`
}

// Dashboard permission request types

type GrantDashboardPermissionRequest struct {
	UserID          *uuid.UUID      `json:"user_id"`
	RoleID          *uuid.UUID      `json:"role_id"`
	PermissionLevel PermissionLevel `json:"permission_level" binding:"required"`
}

type UpdateDashboardVisibilityRequest struct {
	IsPublic bool `json:"is_public"`
}
