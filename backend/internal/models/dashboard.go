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
