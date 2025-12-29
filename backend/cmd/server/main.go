package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mitsume/backend/internal/api"
	"github.com/mitsume/backend/internal/api/validators"
	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/database"
	"github.com/mitsume/backend/internal/repository"
	"github.com/mitsume/backend/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Register custom validators
	if err := validators.RegisterCustomValidators(); err != nil {
		log.Fatalf("Failed to register custom validators: %v", err)
	}

	// Set Gin mode
	gin.SetMode(cfg.Server.Mode)

	// Connect to database
	if err := database.Connect(&cfg.Database); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Run migrations
	if err := database.RunMigrations(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Bootstrap admin user from environment variables
	pool := database.GetPool()
	userRepo := repository.NewPostgresUserRepository(pool)
	roleRepo := repository.NewPostgresRoleRepository(pool)
	adminBootstrap := services.NewAdminBootstrapService(&cfg.Admin, userRepo, roleRepo)
	if err := adminBootstrap.EnsureAdminUser(context.Background()); err != nil {
		log.Fatalf("Failed to bootstrap admin user: %v", err)
	}

	// Initialize cache service (if enabled)
	var cacheService *services.QueryCacheService
	if cfg.Cache.Enabled {
		cacheService, err = services.NewQueryCacheService(&cfg.Cache)
		if err != nil {
			log.Fatalf("Failed to create cache service: %v", err)
		}
		if cacheService != nil {
			defer cacheService.Close()
			log.Println("Query cache enabled (Redis)")
		}
	} else {
		log.Println("Query cache disabled")
	}

	// Setup router
	r := gin.Default()

	// Configure trusted proxies for rate limiting
	// Only trust localhost proxies by default to prevent X-Forwarded-For spoofing
	// In production with a known proxy, set TRUSTED_PROXIES env var
	trustedProxies := os.Getenv("TRUSTED_PROXIES")
	if trustedProxies != "" {
		// Parse comma-separated list of trusted proxies
		var proxies []string
		for _, p := range splitAndTrim(trustedProxies, ",") {
			if p != "" {
				proxies = append(proxies, p)
			}
		}
		if err := r.SetTrustedProxies(proxies); err != nil {
			log.Printf("Warning: failed to set trusted proxies: %v", err)
		}
	} else {
		// Trust no proxies by default - use RemoteAddr directly
		if err := r.SetTrustedProxies(nil); err != nil {
			log.Printf("Warning: failed to set trusted proxies: %v", err)
		}
	}

	api.SetupRoutes(r, cfg, cacheService)

	// Initialize services for scheduler
	// pool is already initialized above for admin bootstrap
	trinoService := services.NewTrinoService(&cfg.Trino)
	cachedTrinoService := services.NewCachedTrinoService(trinoService, cacheService, &cfg.Cache)
	queryService := services.NewQueryService(cacheService)
	dashboardService := services.NewDashboardService()
	notificationService := services.NewNotificationService(pool, &cfg.Notification)
	alertService := services.NewAlertService(pool, cachedTrinoService, notificationService, queryService)
	subscriptionService := services.NewSubscriptionService(pool, notificationService, dashboardService)

	// Start scheduler
	scheduler, err := services.NewScheduler(alertService, subscriptionService, notificationService)
	if err != nil {
		log.Fatalf("Failed to create scheduler: %v", err)
	}
	if err := scheduler.Start(); err != nil {
		log.Fatalf("Failed to start scheduler: %v", err)
	}

	// Create HTTP server
	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: r,
	}

	// Graceful shutdown handling
	go func() {
		log.Printf("Starting server on port %s", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Stop scheduler
	if err := scheduler.Stop(); err != nil {
		log.Printf("Error stopping scheduler: %v", err)
	}

	// Shutdown HTTP server with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully")
}

// splitAndTrim splits a string by separator and trims whitespace from each part
func splitAndTrim(s, sep string) []string {
	var result []string
	start := 0
	for i := 0; i < len(s); i++ {
		if i+len(sep) <= len(s) && s[i:i+len(sep)] == sep {
			part := trimSpace(s[start:i])
			if part != "" {
				result = append(result, part)
			}
			start = i + len(sep)
		}
	}
	// Add the last part
	part := trimSpace(s[start:])
	if part != "" {
		result = append(result, part)
	}
	return result
}

func trimSpace(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}
