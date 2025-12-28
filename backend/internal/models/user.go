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
	Email    string `json:"email"`                     // Email or username for admin users
	Password string `json:"password" binding:"required"` // No min length for admin flexibility
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Name     string `json:"name" binding:"required"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
