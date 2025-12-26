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
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	Widgets     []Widget        `json:"widgets,omitempty"`
	// Permission info (populated when fetching for a specific user)
	MyPermission PermissionLevel       `json:"my_permission,omitempty"`
	Permissions  []DashboardPermission `json:"permissions,omitempty"`
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
