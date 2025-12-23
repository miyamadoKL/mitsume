package models

import (
	"time"

	"github.com/google/uuid"
)

type Role struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsSystem    bool      `json:"is_system"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type RoleWithCatalogs struct {
	Role
	Catalogs []string `json:"catalogs"`
}

type UserWithRoles struct {
	User
	Roles []Role `json:"roles"`
}

type UserRole struct {
	UserID     uuid.UUID  `json:"user_id"`
	RoleID     uuid.UUID  `json:"role_id"`
	AssignedAt time.Time  `json:"assigned_at"`
	AssignedBy *uuid.UUID `json:"assigned_by"`
}

type RoleCatalogPermission struct {
	ID          uuid.UUID `json:"id"`
	RoleID      uuid.UUID `json:"role_id"`
	CatalogName string    `json:"catalog_name"`
	CreatedAt   time.Time `json:"created_at"`
}

// Request types

type CreateRoleRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=100"`
	Description string `json:"description"`
}

type UpdateRoleRequest struct {
	Name        string `json:"name" binding:"omitempty,min=1,max=100"`
	Description string `json:"description"`
}

type SetCatalogPermissionsRequest struct {
	Catalogs []string `json:"catalogs" binding:"required"`
}

type AssignRoleRequest struct {
	RoleID uuid.UUID `json:"role_id" binding:"required"`
}
