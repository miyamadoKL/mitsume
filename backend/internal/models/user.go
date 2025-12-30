package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        *string   `json:"email,omitempty"`
	Username     *string   `json:"username,omitempty"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	AuthProvider string    `json:"auth_provider"`
	GoogleID     *string   `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required"`    // Email or username for admin users
	Password string `json:"password" binding:"required"` // No min length for admin flexibility
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Name     string `json:"name" binding:"required"`
}

// AuthStatus represents the status of authentication/registration
type AuthStatus string

const (
	AuthStatusSuccess         AuthStatus = "success"
	AuthStatusPendingApproval AuthStatus = "pending_approval"
)

type AuthResponse struct {
	// Status indicates the result of authentication/registration
	// "success" = fully authenticated, token and user are present
	// "pending_approval" = registration successful but awaiting admin approval, no token/user
	Status  AuthStatus `json:"status"`
	Token   string     `json:"token,omitempty"`   // Present only when status is "success"
	User    *User      `json:"user,omitempty"`    // Present only when status is "success"
	Message string     `json:"message,omitempty"` // Optional message (e.g., "Awaiting admin approval")
}
