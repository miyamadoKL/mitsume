package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
	"github.com/mitsume/backend/internal/services"
	"github.com/mitsume/backend/internal/utils"
)

type ExportHandler struct {
	trinoExecutor  repository.TrinoExecutor
	roleService    *services.RoleService
	defaultCatalog string
	defaultSchema  string
}

func NewExportHandler(
	trinoExecutor repository.TrinoExecutor,
	roleService *services.RoleService,
	defaultCatalog string,
	defaultSchema string,
) *ExportHandler {
	return &ExportHandler{
		trinoExecutor:  trinoExecutor,
		roleService:    roleService,
		defaultCatalog: defaultCatalog,
		defaultSchema:  defaultSchema,
	}
}

type ExportRequest struct {
	Query    string `json:"query" binding:"required"`
	Catalog  string `json:"catalog"`
	Schema   string `json:"schema"`
	Filename string `json:"filename"`
}

func (h *ExportHandler) ExportCSV(c *gin.Context) {
	h.export(c, "csv")
}

func (h *ExportHandler) ExportTSV(c *gin.Context) {
	h.export(c, "tsv")
}

func (h *ExportHandler) export(c *gin.Context, format string) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req ExportRequest
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

	if err := enforceCatalogAccess(c.Request.Context(), h.roleService, userID, req.Query, catalog); err != nil {
		if errors.Is(err, ErrCatalogAccessDenied) || errors.Is(err, ErrShowCatalogsForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result, err := h.trinoExecutor.ExecuteQuery(c.Request.Context(), req.Query, catalog, schema)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	filename := req.Filename
	if filename == "" {
		filename = fmt.Sprintf("query_result_%s", time.Now().Format("20060102_150405"))
	}
	filename = utils.SanitizeFilename(filename)

	var contentType string
	var extension string
	var exportFunc func(*gin.Context, *models.QueryResult, string)

	switch format {
	case "csv":
		contentType = "text/csv"
		extension = ".csv"
		exportFunc = h.writeCSV
	case "tsv":
		contentType = "text/tab-separated-values"
		extension = ".tsv"
		exportFunc = h.writeTSV
	}

	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s%s\"", filename, extension))

	exportFunc(c, result, filename)
}

func (h *ExportHandler) writeCSV(c *gin.Context, result *models.QueryResult, _ string) {
	if err := utils.ExportToCSV(c.Writer, result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

func (h *ExportHandler) writeTSV(c *gin.Context, result *models.QueryResult, _ string) {
	if err := utils.ExportToTSV(c.Writer, result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}
