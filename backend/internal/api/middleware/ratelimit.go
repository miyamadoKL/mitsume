package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mitsume/backend/internal/config"
)

// RateLimiter implements a token bucket rate limiter per IP
type RateLimiter struct {
	mu              sync.RWMutex
	buckets         map[string]*tokenBucket
	rate            float64 // tokens per second
	burstSize       int
	cleanupInterval time.Duration
	enabled         bool
}

type tokenBucket struct {
	tokens     float64
	lastUpdate time.Time
}

// NewRateLimiter creates a new rate limiter from config
func NewRateLimiter(cfg *config.RateLimitConfig) *RateLimiter {
	rl := &RateLimiter{
		buckets:         make(map[string]*tokenBucket),
		rate:            float64(cfg.RequestsPerMinute) / 60.0, // convert to per second
		burstSize:       cfg.BurstSize,
		cleanupInterval: time.Duration(cfg.CleanupIntervalSec) * time.Second,
		enabled:         cfg.Enabled,
	}

	if rl.enabled {
		go rl.cleanup()
	}

	return rl
}

// Allow checks if a request from the given IP is allowed
func (rl *RateLimiter) Allow(ip string) bool {
	if !rl.enabled {
		return true
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	bucket, exists := rl.buckets[ip]

	if !exists {
		bucket = &tokenBucket{
			tokens:     float64(rl.burstSize),
			lastUpdate: now,
		}
		rl.buckets[ip] = bucket
	}

	// Refill tokens based on elapsed time
	elapsed := now.Sub(bucket.lastUpdate).Seconds()
	bucket.tokens += elapsed * rl.rate
	if bucket.tokens > float64(rl.burstSize) {
		bucket.tokens = float64(rl.burstSize)
	}
	bucket.lastUpdate = now

	// Check if we have tokens available
	if bucket.tokens >= 1 {
		bucket.tokens--
		return true
	}

	return false
}

// cleanup periodically removes old buckets to prevent memory leaks
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, bucket := range rl.buckets {
			// Remove buckets that haven't been accessed for 5 minutes
			if now.Sub(bucket.lastUpdate) > 5*time.Minute {
				delete(rl.buckets, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// RateLimitMiddleware creates a gin middleware for rate limiting
func RateLimitMiddleware(rl *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !rl.enabled {
			c.Next()
			return
		}

		// Get client IP
		ip := c.ClientIP()

		if !rl.Allow(ip) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded, please try again later",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// AuthRateLimiter is a stricter rate limiter for auth endpoints
type AuthRateLimiter struct {
	*RateLimiter
}

// NewAuthRateLimiter creates a stricter rate limiter for auth endpoints
// Uses 1/4 of the normal rate limit for auth-related operations
func NewAuthRateLimiter(cfg *config.RateLimitConfig) *AuthRateLimiter {
	authCfg := &config.RateLimitConfig{
		Enabled:            cfg.Enabled,
		RequestsPerMinute:  cfg.RequestsPerMinute / 4, // Stricter limit for auth
		BurstSize:          cfg.BurstSize / 2,         // Smaller burst for auth
		CleanupIntervalSec: cfg.CleanupIntervalSec,
	}

	// Ensure minimum values
	if authCfg.RequestsPerMinute < 5 {
		authCfg.RequestsPerMinute = 5
	}
	if authCfg.BurstSize < 3 {
		authCfg.BurstSize = 3
	}

	return &AuthRateLimiter{
		RateLimiter: NewRateLimiter(authCfg),
	}
}

// AuthRateLimitMiddleware creates a gin middleware for auth rate limiting
func AuthRateLimitMiddleware(rl *AuthRateLimiter) gin.HandlerFunc {
	return RateLimitMiddleware(rl.RateLimiter)
}
