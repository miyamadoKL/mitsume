package handlers

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
	"github.com/mitsume/backend/internal/services"
)

type QueryHandler struct {
	trinoExecutor   repository.CachedTrinoExecutor
	historyRecorder repository.QueryHistoryRecorder
	roleService     *services.RoleService
	defaultCatalog  string
	defaultSchema   string
}

func NewQueryHandler(
	trinoExecutor repository.CachedTrinoExecutor,
	historyRecorder repository.QueryHistoryRecorder,
	roleService *services.RoleService,
	defaultCatalog string,
	defaultSchema string,
) *QueryHandler {
	return &QueryHandler{
		trinoExecutor:   trinoExecutor,
		historyRecorder: historyRecorder,
		roleService:     roleService,
		defaultCatalog:  defaultCatalog,
		defaultSchema:   defaultSchema,
	}
}

func (h *QueryHandler) ExecuteQuery(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req models.ExecuteQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	catalog := req.Catalog
	if catalog == "" {
		catalog = h.defaultCatalog
	}
	schema := req.Schema
	if schema == "" {
		schema = h.defaultSchema
	}

	// Enforce catalog permission based on referenced catalogs + effective catalog
	if err := enforceCatalogAccess(c.Request.Context(), h.roleService, userID, req.Query, catalog); err != nil {
		if errors.Is(err, ErrCatalogAccessDenied) || errors.Is(err, ErrShowCatalogsForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Execute query with caching (LOW priority for ad-hoc queries)
	result, err := h.trinoExecutor.ExecuteQueryWithCache(c.Request.Context(), req.Query, catalog, schema, int(services.CachePriorityLow), nil)
	if err != nil {
		// Save error to history
		errMsg := err.Error()
		if h.historyRecorder != nil {
			if recErr := h.historyRecorder.SaveQueryHistory(c.Request.Context(), userID, req.Query, "error", 0, 0, &errMsg); recErr != nil {
				log.Printf("failed to record query error history for user %s: %v", userID, recErr)
			}
		}

		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Save success to history
	if h.historyRecorder != nil {
		if recErr := h.historyRecorder.SaveQueryHistory(c.Request.Context(), userID, req.Query, "success", result.ExecutionTimeMs, result.RowCount, nil); recErr != nil {
			log.Printf("failed to record query success history for user %s: %v", userID, recErr)
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h *QueryHandler) GetCatalogs(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	catalogs, err := h.trinoExecutor.GetCatalogs(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Filter catalogs based on user permissions
	if h.roleService != nil {
		allowedCatalogs, err := h.roleService.GetUserAllowedCatalogs(c.Request.Context(), userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// nil means admin user has access to all catalogs
		if allowedCatalogs != nil {
			catalogs = filterCatalogs(catalogs, allowedCatalogs)
		}
	}

	c.JSON(http.StatusOK, gin.H{"catalogs": catalogs})
}

// filterCatalogs returns the intersection of available and allowed catalogs
func filterCatalogs(available []string, allowed []string) []string {
	allowedSet := make(map[string]bool)
	for _, c := range allowed {
		allowedSet[c] = true
	}

	var filtered []string
	for _, c := range available {
		if allowedSet[c] {
			filtered = append(filtered, c)
		}
	}
	return filtered
}

func (h *QueryHandler) GetSchemas(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	catalog := c.Param("catalog")
	if catalog == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "catalog is required"})
		return
	}

	// Check catalog access permission
	if h.roleService != nil {
		hasAccess, err := h.roleService.CanUserAccessCatalog(c.Request.Context(), userID, catalog)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !hasAccess {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied to catalog"})
			return
		}
	}

	schemas, err := h.trinoExecutor.GetSchemas(c.Request.Context(), catalog)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"schemas": schemas})
}

func (h *QueryHandler) GetTables(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	catalog := c.Param("catalog")
	schema := c.Param("schema")
	if catalog == "" || schema == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "catalog and schema are required"})
		return
	}

	// Check catalog access permission
	if h.roleService != nil {
		hasAccess, err := h.roleService.CanUserAccessCatalog(c.Request.Context(), userID, catalog)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !hasAccess {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied to catalog"})
			return
		}
	}

	tables, err := h.trinoExecutor.GetTables(c.Request.Context(), catalog, schema)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tables": tables})
}
