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
	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/database"
	"github.com/mitsume/backend/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
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
	api.SetupRoutes(r, cfg, cacheService)

	// Initialize services for scheduler
	pool := database.GetPool()
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
