package models

import (
	"time"

	"github.com/google/uuid"
)

// UserStatus represents the approval status of a user
type UserStatus string

const (
	UserStatusPending  UserStatus = "pending"  // Waiting for admin approval
	UserStatusActive   UserStatus = "active"   // Approved and can login
	UserStatusDisabled UserStatus = "disabled" // Deactivated by admin
)

type User struct {
	ID           uuid.UUID  `json:"id"`
	Email        *string    `json:"email,omitempty"`
	Username     *string    `json:"username,omitempty"`
	PasswordHash string     `json:"-"`
	Name         string     `json:"name"`
	AuthProvider string     `json:"auth_provider"`
	GoogleID     *string    `json:"-"`
	Status       UserStatus `json:"status"`
	ApprovedAt   *time.Time `json:"approved_at,omitempty"`
	ApprovedBy   *uuid.UUID `json:"approved_by,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required"`               // Email or username for admin users
	Password string `json:"password" binding:"required,maxbytes=72"` // maxbytes=72 for bcrypt byte limit
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6,maxbytes=72"` // maxbytes=72 for bcrypt byte limit
	Name     string `json:"name" binding:"required"`
}

// PendingAuthResponse is returned when user registration is pending approval
type PendingAuthResponse struct {
	Message string `json:"message"`
	Status  string `json:"status"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
