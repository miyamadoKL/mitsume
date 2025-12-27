package models

import (
	"encoding/json"
	"strconv"
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
	ID                  uuid.UUID       `json:"id"`
	DashboardID         uuid.UUID       `json:"dashboard_id"`
	Name                string          `json:"name"`
	QueryID             *uuid.UUID      `json:"query_id"`
	ChartType           string          `json:"chart_type"`
	ChartConfig         json.RawMessage `json:"chart_config"`
	Position            json.RawMessage `json:"position"`
	ResponsivePositions json.RawMessage `json:"responsive_positions,omitempty"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
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
	Name                string          `json:"name" binding:"required"`
	QueryID             *uuid.UUID      `json:"query_id"`
	ChartType           string          `json:"chart_type" binding:"required"`
	ChartConfig         json.RawMessage `json:"chart_config"`
	Position            json.RawMessage `json:"position" binding:"required"`
	ResponsivePositions json.RawMessage `json:"responsive_positions,omitempty"`
}

type UpdateWidgetRequest struct {
	Name                string          `json:"name"`
	QueryID             *uuid.UUID      `json:"query_id"`
	ChartType           string          `json:"chart_type"`
	ChartConfig         json.RawMessage `json:"chart_config"`
	Position            json.RawMessage `json:"position"`
	ResponsivePositions json.RawMessage `json:"responsive_positions,omitempty"`
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

// LayoutTemplate represents a saved layout template
type LayoutTemplate struct {
	ID          uuid.UUID       `json:"id"`
	UserID      *uuid.UUID      `json:"user_id,omitempty"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Layout      json.RawMessage `json:"layout"`
	IsSystem    bool            `json:"is_system"`
	CreatedAt   time.Time       `json:"created_at"`
}

type CreateLayoutTemplateRequest struct {
	Name        string          `json:"name" binding:"required"`
	Description string          `json:"description"`
	Layout      json.RawMessage `json:"layout" binding:"required"`
}

// LayoutPosition represents a widget position in the grid
type LayoutPosition struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

// Layout validation constants
const (
	MaxLayoutItems       = 50  // Maximum number of widgets in a layout
	MaxLayoutNameLength  = 100 // Maximum length of template name
	MaxLayoutDescLength  = 500 // Maximum length of template description
	MaxGridColumns       = 12  // Grid column count
	MaxGridRows          = 100 // Maximum Y position
	MinWidgetWidth       = 1
	MinWidgetHeight      = 1
	MaxWidgetWidth       = 12
	MaxWidgetHeight      = 20
)

// ValidateLayout validates a layout JSON and returns parsed positions
func ValidateLayout(layoutJSON json.RawMessage) ([]LayoutPosition, error) {
	if len(layoutJSON) == 0 {
		return []LayoutPosition{}, nil
	}

	// Size check (prevent DoS with huge JSON)
	if len(layoutJSON) > 64*1024 { // 64KB limit
		return nil, &ValidationError{Field: "layout", Message: "layout JSON too large"}
	}

	var positions []LayoutPosition
	if err := json.Unmarshal(layoutJSON, &positions); err != nil {
		return nil, &ValidationError{Field: "layout", Message: "invalid layout format: must be an array of positions"}
	}

	if len(positions) > MaxLayoutItems {
		return nil, &ValidationError{Field: "layout", Message: "too many layout items"}
	}

	for i, pos := range positions {
		idxStr := strconv.Itoa(i)
		if pos.X < 0 || pos.X >= MaxGridColumns {
			return nil, &ValidationError{Field: "layout", Message: "invalid x position at index " + idxStr}
		}
		if pos.Y < 0 || pos.Y > MaxGridRows {
			return nil, &ValidationError{Field: "layout", Message: "invalid y position at index " + idxStr}
		}
		if pos.W < MinWidgetWidth || pos.W > MaxWidgetWidth {
			return nil, &ValidationError{Field: "layout", Message: "invalid width at index " + idxStr}
		}
		if pos.H < MinWidgetHeight || pos.H > MaxWidgetHeight {
			return nil, &ValidationError{Field: "layout", Message: "invalid height at index " + idxStr}
		}
		if pos.X+pos.W > MaxGridColumns {
			return nil, &ValidationError{Field: "layout", Message: "widget exceeds grid bounds at index " + idxStr}
		}
	}

	return positions, nil
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

// ValidateWidgetPosition validates a single widget position JSON
func ValidateWidgetPosition(positionJSON json.RawMessage) (*LayoutPosition, error) {
	if len(positionJSON) == 0 {
		return nil, nil // Position is optional for updates
	}

	// Size check
	if len(positionJSON) > 1024 { // 1KB limit for single position
		return nil, &ValidationError{Field: "position", Message: "position JSON too large"}
	}

	var pos LayoutPosition
	if err := json.Unmarshal(positionJSON, &pos); err != nil {
		return nil, &ValidationError{Field: "position", Message: "invalid position format"}
	}

	// Validate bounds
	if pos.X < 0 || pos.X >= MaxGridColumns {
		return nil, &ValidationError{Field: "position.x", Message: "x must be between 0 and 11"}
	}
	if pos.Y < 0 || pos.Y > MaxGridRows {
		return nil, &ValidationError{Field: "position.y", Message: "y must be between 0 and 100"}
	}
	if pos.W < MinWidgetWidth || pos.W > MaxWidgetWidth {
		return nil, &ValidationError{Field: "position.w", Message: "width must be between 1 and 12"}
	}
	if pos.H < MinWidgetHeight || pos.H > MaxWidgetHeight {
		return nil, &ValidationError{Field: "position.h", Message: "height must be between 1 and 20"}
	}
	if pos.X+pos.W > MaxGridColumns {
		return nil, &ValidationError{Field: "position", Message: "widget exceeds grid bounds (x + w > 12)"}
	}

	return &pos, nil
}
