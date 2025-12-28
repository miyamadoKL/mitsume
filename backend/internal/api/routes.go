package api

import (
	"github.com/gin-gonic/gin"
	"github.com/mitsume/backend/internal/api/handlers"
	"github.com/mitsume/backend/internal/api/middleware"
	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/database"
	"github.com/mitsume/backend/internal/repository"
	"github.com/mitsume/backend/internal/services"
)

func SetupRoutes(r *gin.Engine, cfg *config.Config, cacheService *services.QueryCacheService) {
	// Repositories
	userRepo := repository.NewPostgresUserRepository(database.GetPool())
	roleRepo := repository.NewPostgresRoleRepository(database.GetPool())
	layoutTemplateRepo := repository.NewPostgresLayoutTemplateRepository(database.GetPool())

	// Services
	authService := services.NewAuthService(cfg, userRepo, roleRepo)
	trinoService := services.NewTrinoService(&cfg.Trino)
	cachedTrinoService := services.NewCachedTrinoService(trinoService, cacheService, &cfg.Cache)
	queryService := services.NewQueryService(cacheService)
	dashboardService := services.NewDashboardService()
	notificationService := services.NewNotificationService(database.GetPool(), &cfg.Notification)
	alertService := services.NewAlertService(database.GetPool(), cachedTrinoService, notificationService, queryService)
	subscriptionService := services.NewSubscriptionService(database.GetPool(), notificationService, dashboardService)
	roleService := services.NewRoleService(roleRepo)

	// Handlers
	authHandler := handlers.NewAuthHandler(authService, cfg)
	queryHandler := handlers.NewQueryHandler(cachedTrinoService, queryService, roleService, cfg.Trino.Catalog, cfg.Trino.Schema)
	savedQueryHandler := handlers.NewSavedQueryHandler(queryService)
	dashboardHandler := handlers.NewDashboardHandler(dashboardService, cachedTrinoService, queryService, roleService, cfg.Trino.Catalog, cfg.Trino.Schema)
	exportHandler := handlers.NewExportHandler(trinoService, roleService, cfg.Trino.Catalog, cfg.Trino.Schema) // Export uses non-cached version
	notificationHandler := handlers.NewNotificationHandler(notificationService)
	alertHandler := handlers.NewAlertHandler(alertService, notificationService)
	subscriptionHandler := handlers.NewSubscriptionHandler(subscriptionService)
	roleHandler := handlers.NewRoleHandler(roleService, trinoService) // Role handler uses non-cached version for catalog listing
	layoutTemplateHandler := handlers.NewLayoutTemplateHandler(layoutTemplateRepo)

	// Middleware
	r.Use(middleware.CORSMiddleware(cfg.Server.FrontendURL))

	// API routes
	api := r.Group("/api")
	{
		// Auth routes (public)
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.GET("/google", authHandler.GoogleLogin)
			auth.GET("/google/callback", authHandler.GoogleCallback)
		}

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(authService))
		{
			// User
			protected.GET("/auth/me", authHandler.Me)

			// Query execution
			protected.POST("/queries/execute", queryHandler.ExecuteQuery)
			protected.GET("/catalogs", queryHandler.GetCatalogs)
			protected.GET("/catalogs/:catalog/schemas", queryHandler.GetSchemas)
			protected.GET("/catalogs/:catalog/schemas/:schema/tables", queryHandler.GetTables)

			// Saved queries
			protected.GET("/queries/saved", savedQueryHandler.GetSavedQueries)
			protected.GET("/queries/saved/:id", savedQueryHandler.GetSavedQuery)
			protected.POST("/queries/saved", savedQueryHandler.CreateSavedQuery)
			protected.PUT("/queries/saved/:id", savedQueryHandler.UpdateSavedQuery)
			protected.DELETE("/queries/saved/:id", savedQueryHandler.DeleteSavedQuery)

			// Query history
			protected.GET("/queries/history", savedQueryHandler.GetQueryHistory)

			// Export
			protected.POST("/export/csv", exportHandler.ExportCSV)
			protected.POST("/export/tsv", exportHandler.ExportTSV)

			// Dashboards
			protected.GET("/dashboards", dashboardHandler.GetDashboards)
			protected.GET("/dashboards/:id", dashboardHandler.GetDashboard)
			protected.POST("/dashboards", dashboardHandler.CreateDashboard)
			protected.PUT("/dashboards/:id", dashboardHandler.UpdateDashboard)
			protected.DELETE("/dashboards/:id", dashboardHandler.DeleteDashboard)
			protected.POST("/dashboards/:id/save-draft", dashboardHandler.SaveAsDraft)
			protected.POST("/dashboards/:id/publish", dashboardHandler.PublishDraft)

			// Dashboard widgets
			protected.POST("/dashboards/:id/widgets", dashboardHandler.CreateWidget)
			protected.PUT("/dashboards/:id/widgets/:widgetId", dashboardHandler.UpdateWidget)
			protected.DELETE("/dashboards/:id/widgets/:widgetId", dashboardHandler.DeleteWidget)
			protected.POST("/dashboards/:id/widgets/:widgetId/duplicate", dashboardHandler.DuplicateWidget)
			protected.POST("/dashboards/:id/widgets/batch", dashboardHandler.BatchUpdateWidgets)

			// Dashboard permissions
			protected.GET("/dashboards/:id/permissions", dashboardHandler.GetPermissions)
			protected.POST("/dashboards/:id/permissions", dashboardHandler.GrantPermission)
			protected.DELETE("/dashboards/:id/permissions/:permId", dashboardHandler.RevokePermission)
			protected.PUT("/dashboards/:id/visibility", dashboardHandler.UpdateVisibility)

			// Widget data (executes query using dashboard owner's permissions)
			protected.GET("/dashboards/:id/widgets/:widgetId/data", dashboardHandler.GetWidgetData)
			protected.POST("/dashboards/:id/widgets/:widgetId/data", dashboardHandler.GetWidgetDataWithParams)

			// Parameter dynamic options
			protected.POST("/dashboards/:id/parameters/:name/options", dashboardHandler.GetParameterOptions)

			// Notification channels
			protected.GET("/notification-channels", notificationHandler.GetChannels)
			protected.POST("/notification-channels", notificationHandler.CreateChannel)
			protected.GET("/notification-channels/:id", notificationHandler.GetChannel)
			protected.PUT("/notification-channels/:id", notificationHandler.UpdateChannel)
			protected.DELETE("/notification-channels/:id", notificationHandler.DeleteChannel)
			protected.POST("/notification-channels/:id/test", notificationHandler.TestChannel)

			// Alerts
			protected.GET("/alerts", alertHandler.GetAlerts)
			protected.POST("/alerts", alertHandler.CreateAlert)
			protected.GET("/alerts/:id", alertHandler.GetAlert)
			protected.PUT("/alerts/:id", alertHandler.UpdateAlert)
			protected.DELETE("/alerts/:id", alertHandler.DeleteAlert)
			protected.POST("/alerts/:id/test", alertHandler.TestAlert)
			protected.GET("/alerts/:id/history", alertHandler.GetAlertHistory)

			// Subscriptions
			protected.GET("/subscriptions", subscriptionHandler.GetSubscriptions)
			protected.POST("/subscriptions", subscriptionHandler.CreateSubscription)
			protected.GET("/subscriptions/:id", subscriptionHandler.GetSubscription)
			protected.PUT("/subscriptions/:id", subscriptionHandler.UpdateSubscription)
			protected.DELETE("/subscriptions/:id", subscriptionHandler.DeleteSubscription)
			protected.POST("/subscriptions/:id/trigger", subscriptionHandler.TriggerSubscription)

			// Layout templates
			protected.GET("/layout-templates", layoutTemplateHandler.GetLayoutTemplates)
			protected.POST("/layout-templates", layoutTemplateHandler.CreateLayoutTemplate)
			protected.DELETE("/layout-templates/:id", layoutTemplateHandler.DeleteLayoutTemplate)

			// Admin routes (requires admin role)
			admin := protected.Group("/admin")
			admin.Use(middleware.AdminMiddleware(roleService))
			{
				// Role management
				admin.GET("/roles", roleHandler.GetRoles)
				admin.POST("/roles", roleHandler.CreateRole)
				admin.GET("/roles/:id", roleHandler.GetRole)
				admin.PUT("/roles/:id", roleHandler.UpdateRole)
				admin.DELETE("/roles/:id", roleHandler.DeleteRole)
				admin.PUT("/roles/:id/catalogs", roleHandler.SetRoleCatalogs)
				admin.GET("/catalogs/available", roleHandler.GetAvailableCatalogs)

				// User-role management
				admin.GET("/users", roleHandler.GetUsersWithRoles)
				admin.POST("/users/:userId/roles", roleHandler.AssignRole)
				admin.DELETE("/users/:userId/roles/:roleId", roleHandler.UnassignRole)
			}
		}
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})
}
