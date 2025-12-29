package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/services"
)

// UserStatusChecker interface for checking user status
type UserStatusChecker interface {
	GetUserByID(ctx context.Context, userID uuid.UUID) (*models.User, error)
}

func AuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var token string

		// Try Bearer token first
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				token = parts[1]
			}
		}

		// Fallback to cookie if no Bearer token
		if token == "" {
			cookieToken, err := c.Cookie("auth_token")
			if err == nil && cookieToken != "" {
				token = cookieToken
			}
		}

		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
			c.Abort()
			return
		}

		userID, err := authService.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}

		// Check user status on every request
		user, err := authService.GetUserByID(c.Request.Context(), userID)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			c.Abort()
			return
		}

		// Only active users can access protected routes
		if user.Status != models.UserStatusActive {
			c.JSON(http.StatusForbidden, gin.H{
				"error":  "account is not active",
				"status": string(user.Status),
			})
			c.Abort()
			return
		}

		c.Set("userID", userID)
		c.Next()
	}
}
