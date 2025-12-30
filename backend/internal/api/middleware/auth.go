package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mitsume/backend/internal/services"
)

const AuthCookieName = "auth_token"

func AuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var token string

		// Try Authorization header first
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				token = parts[1]
			}
		}

		// Fall back to cookie if no Authorization header
		if token == "" {
			if cookieToken, err := c.Cookie(AuthCookieName); err == nil && cookieToken != "" {
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

		c.Set("userID", userID)
		c.Next()
	}
}
