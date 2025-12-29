package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// BodyLimitMiddleware limits the size of request bodies to prevent DoS attacks.
// If maxBytes is 0 or negative, no limit is applied.
func BodyLimitMiddleware(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if maxBytes <= 0 {
			c.Next()
			return
		}

		// Check Content-Length header first for early rejection
		if c.Request.ContentLength > maxBytes {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": "request body too large",
			})
			return
		}

		// Wrap the body with a size limiter to handle cases where
		// Content-Length is missing or incorrect
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)

		c.Next()
	}
}
