package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/mitsume/backend/internal/config"
)

func TestRateLimiter_Allow(t *testing.T) {
	cfg := &config.RateLimitConfig{
		Enabled:            true,
		RequestsPerMinute:  60,
		BurstSize:          10,
		CleanupIntervalSec: 60,
	}
	rl := NewRateLimiter(cfg)

	// First 10 requests should be allowed (burst size)
	for i := 0; i < 10; i++ {
		if !rl.Allow("192.168.1.1") {
			t.Errorf("Request %d should be allowed within burst size", i+1)
		}
	}

	// 11th request should be blocked (exceeded burst)
	if rl.Allow("192.168.1.1") {
		t.Error("Request should be blocked after exceeding burst size")
	}
}

func TestRateLimiter_DifferentIPs(t *testing.T) {
	cfg := &config.RateLimitConfig{
		Enabled:            true,
		RequestsPerMinute:  60,
		BurstSize:          5,
		CleanupIntervalSec: 60,
	}
	rl := NewRateLimiter(cfg)

	// Use all tokens for IP1
	for i := 0; i < 5; i++ {
		rl.Allow("192.168.1.1")
	}

	// IP1 should be blocked
	if rl.Allow("192.168.1.1") {
		t.Error("IP1 should be blocked after using all tokens")
	}

	// IP2 should still have tokens
	if !rl.Allow("192.168.1.2") {
		t.Error("IP2 should still have tokens available")
	}
}

func TestRateLimiter_Disabled(t *testing.T) {
	cfg := &config.RateLimitConfig{
		Enabled:            false,
		RequestsPerMinute:  1,
		BurstSize:          1,
		CleanupIntervalSec: 60,
	}
	rl := NewRateLimiter(cfg)

	// Even with very restrictive settings, disabled should always allow
	for i := 0; i < 100; i++ {
		if !rl.Allow("192.168.1.1") {
			t.Error("Disabled rate limiter should always allow requests")
		}
	}
}

func TestRateLimitMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cfg := &config.RateLimitConfig{
		Enabled:            true,
		RequestsPerMinute:  60,
		BurstSize:          3,
		CleanupIntervalSec: 60,
	}
	rl := NewRateLimiter(cfg)

	router := gin.New()
	router.Use(RateLimitMiddleware(rl))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// First 3 requests should succeed
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Request %d should succeed, got status %d", i+1, w.Code)
		}
	}

	// 4th request should be rate limited
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	router.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("Request should be rate limited, got status %d", w.Code)
	}
}

func TestAuthRateLimiter(t *testing.T) {
	cfg := &config.RateLimitConfig{
		Enabled:            true,
		RequestsPerMinute:  60,
		BurstSize:          10,
		CleanupIntervalSec: 60,
	}
	authRL := NewAuthRateLimiter(cfg)

	// Auth rate limiter should have stricter limits (burst/2 = 5)
	for i := 0; i < 5; i++ {
		if !authRL.Allow("192.168.1.1") {
			t.Errorf("Request %d should be allowed within auth burst size", i+1)
		}
	}

	// 6th request should be blocked
	if authRL.Allow("192.168.1.1") {
		t.Error("Request should be blocked after exceeding auth burst size")
	}
}

func TestAuthRateLimiter_MinimumValues(t *testing.T) {
	// Test with very low values to verify minimum thresholds
	cfg := &config.RateLimitConfig{
		Enabled:            true,
		RequestsPerMinute:  4,  // 4/4 = 1, but minimum is 5
		BurstSize:          2,  // 2/2 = 1, but minimum is 3
		CleanupIntervalSec: 60,
	}
	authRL := NewAuthRateLimiter(cfg)

	// Should use minimum burst size of 3
	for i := 0; i < 3; i++ {
		if !authRL.Allow("192.168.1.1") {
			t.Errorf("Request %d should be allowed with minimum burst size", i+1)
		}
	}

	if authRL.Allow("192.168.1.1") {
		t.Error("Request should be blocked after exceeding minimum burst size")
	}
}

func TestRateLimitMiddleware_Disabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cfg := &config.RateLimitConfig{
		Enabled:            false,
		RequestsPerMinute:  1,
		BurstSize:          1,
		CleanupIntervalSec: 60,
	}
	rl := NewRateLimiter(cfg)

	router := gin.New()
	router.Use(RateLimitMiddleware(rl))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// All requests should succeed when disabled
	for i := 0; i < 10; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Request %d should succeed when rate limiting is disabled, got status %d", i+1, w.Code)
		}
	}
}
