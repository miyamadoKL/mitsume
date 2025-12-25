package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
	"github.com/mitsume/backend/internal/services"
)

type DashboardHandler struct {
	dashboardService *services.DashboardService
	trinoService     repository.CachedTrinoExecutor
	queryService     *services.QueryService
	roleService      *services.RoleService
}

func NewDashboardHandler(dashboardService *services.DashboardService, trinoService repository.CachedTrinoExecutor, queryService *services.QueryService, roleService *services.RoleService) *DashboardHandler {
	return &DashboardHandler{
		dashboardService: dashboardService,
		trinoService:     trinoService,
		queryService:     queryService,
		roleService:      roleService,
	}
}

func (h *DashboardHandler) GetDashboards(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	dashboards, err := h.dashboardService.GetDashboards(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if dashboards == nil {
		dashboards = []models.Dashboard{}
	}

	c.JSON(http.StatusOK, dashboards)
}

func (h *DashboardHandler) GetDashboard(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}

	dashboard, err := h.dashboardService.GetDashboard(c.Request.Context(), dashboardID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
		return
	}

	c.JSON(http.StatusOK, dashboard)
}

func (h *DashboardHandler) CreateDashboard(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req models.CreateDashboardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dashboard, err := h.dashboardService.CreateDashboard(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, dashboard)
}

func (h *DashboardHandler) UpdateDashboard(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}

	var req models.UpdateDashboardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dashboard, err := h.dashboardService.UpdateDashboard(c.Request.Context(), dashboardID, userID, &req)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
			return
		}
		if errors.Is(err, services.ErrPermissionDenied) {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, dashboard)
}

func (h *DashboardHandler) DeleteDashboard(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}

	if err := h.dashboardService.DeleteDashboard(c.Request.Context(), dashboardID, userID); err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
			return
		}
		if errors.Is(err, services.ErrPermissionDenied) {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied: only owner can delete"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// Widget handlers

func (h *DashboardHandler) CreateWidget(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}

	var req models.CreateWidgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	widget, err := h.dashboardService.CreateWidget(c.Request.Context(), dashboardID, userID, &req)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard or query not found"})
			return
		}
		if errors.Is(err, services.ErrPermissionDenied) {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, widget)
}

func (h *DashboardHandler) UpdateWidget(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}
	widgetID, err := uuid.Parse(c.Param("widgetId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget id"})
		return
	}

	var req models.UpdateWidgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	widget, err := h.dashboardService.UpdateWidget(c.Request.Context(), widgetID, dashboardID, userID, &req)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard or widget not found"})
			return
		}
		if errors.Is(err, services.ErrPermissionDenied) {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, widget)
}

func (h *DashboardHandler) DeleteWidget(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}
	widgetID, err := uuid.Parse(c.Param("widgetId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget id"})
		return
	}

	if err := h.dashboardService.DeleteWidget(c.Request.Context(), widgetID, dashboardID, userID); err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard or widget not found"})
			return
		}
		if errors.Is(err, services.ErrPermissionDenied) {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// Permission management handlers

func (h *DashboardHandler) GetPermissions(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}

	permissions, err := h.dashboardService.GetDashboardPermissions(c.Request.Context(), dashboardID, userID)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
			return
		}
		if errors.Is(err, services.ErrPermissionDenied) {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if permissions == nil {
		permissions = []models.DashboardPermission{}
	}

	c.JSON(http.StatusOK, permissions)
}

func (h *DashboardHandler) GrantPermission(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}

	var req models.GrantDashboardPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	permission, err := h.dashboardService.GrantPermission(c.Request.Context(), dashboardID, userID, &req)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
			return
		}
		if errors.Is(err, services.ErrPermissionDenied) {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			return
		}
		if errors.Is(err, services.ErrInvalidRequest) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: provide either user_id or role_id, and permission_level must be 'view' or 'edit'"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, permission)
}

func (h *DashboardHandler) RevokePermission(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}
	permissionID, err := uuid.Parse(c.Param("permId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid permission id"})
		return
	}

	if err := h.dashboardService.RevokePermission(c.Request.Context(), dashboardID, permissionID, userID); err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard or permission not found"})
			return
		}
		if errors.Is(err, services.ErrPermissionDenied) {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *DashboardHandler) UpdateVisibility(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}

	var req models.UpdateDashboardVisibilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.dashboardService.UpdateVisibility(c.Request.Context(), dashboardID, userID, &req); err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
			return
		}
		if errors.Is(err, services.ErrPermissionDenied) {
			c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "visibility updated"})
}

// GetWidgetData executes the widget's query and returns the result.
// This endpoint allows dashboard viewers to get widget data without having
// direct access to the data source - the query is executed using the
// dashboard owner's catalog permissions.
func (h *DashboardHandler) GetWidgetData(c *gin.Context) {
	ctx := c.Request.Context()
	userID := c.MustGet("userID").(uuid.UUID)

	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}
	widgetID, err := uuid.Parse(c.Param("widgetId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget id"})
		return
	}

	// Check if user has at least view permission on the dashboard
	permLevel, err := h.dashboardService.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if !permLevel.CanView() {
		c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
		return
	}

	// Get widget (single query instead of fetching all widgets)
	widget, err := h.dashboardService.GetWidget(ctx, dashboardID, widgetID)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "widget not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if widget.QueryID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "widget has no associated query"})
		return
	}

	// Get the saved query
	savedQuery, err := h.queryService.GetSavedQueryByID(ctx, *widget.QueryID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "query not found"})
		return
	}

	// Get dashboard owner for permission check
	ownerID, err := h.dashboardService.GetDashboardOwner(ctx, dashboardID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Check if the dashboard owner has access to the catalog
	catalog := ""
	schema := ""
	if savedQuery.Catalog != nil {
		catalog = *savedQuery.Catalog
	}
	if savedQuery.SchemaName != nil {
		schema = *savedQuery.SchemaName
	}

	if h.roleService != nil && catalog != "" {
		hasAccess, err := h.roleService.CanUserAccessCatalog(ctx, ownerID, catalog)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !hasAccess {
			c.JSON(http.StatusForbidden, gin.H{"error": "dashboard owner does not have access to the data source"})
			return
		}
	}

	// Execute the query with caching (NORMAL priority for widget data)
	result, err := h.trinoService.ExecuteQueryWithCache(ctx, savedQuery.QueryText, catalog, schema, int(services.CachePriorityNormal), widget.QueryID)
	if err != nil {
		c.JSON(http.StatusOK, models.WidgetDataResponse{
			WidgetID: widgetID,
			Error:    err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.WidgetDataResponse{
		WidgetID:    widgetID,
		QueryResult: result,
	})
}

// extractParameters extracts parameter names from SQL query ({{param}} syntax)
func extractParameters(queryText string) []string {
	re := regexp.MustCompile(`\{\{([^}]+)\}\}`)
	matches := re.FindAllStringSubmatch(queryText, -1)

	seen := make(map[string]bool)
	var params []string
	for _, match := range matches {
		if len(match) > 1 {
			paramName := strings.TrimSpace(match[1])
			if !seen[paramName] {
				seen[paramName] = true
				params = append(params, paramName)
			}
		}
	}
	return params
}

// escapeString escapes a string for safe inclusion in SQL
// Uses standard SQL escaping (single quotes doubled)
func escapeString(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}

// isValidNumber checks if a string represents a valid number
func isValidNumber(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return false
	}
	// Allow optional leading sign, digits, optional decimal point, optional digits
	matched, _ := regexp.MatchString(`^-?\d+(\.\d+)?$`, s)
	return matched
}

// isValidDate checks if a string represents a valid date (YYYY-MM-DD)
func isValidDate(s string) bool {
	s = strings.TrimSpace(s)
	matched, _ := regexp.MatchString(`^\d{4}-\d{2}-\d{2}$`, s)
	return matched
}

// isValidIdentifier checks if a string is a valid SQL identifier
func isValidIdentifier(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return false
	}
	// Allow alphanumeric and underscore, must start with letter or underscore
	matched, _ := regexp.MatchString(`^[a-zA-Z_][a-zA-Z0-9_]*$`, s)
	return matched
}

// formatParameterValue formats a parameter value according to its SqlFormat
// Returns the formatted value and any validation error
func formatParameterValue(value interface{}, sqlFormat models.SqlFormat) (string, error) {
	if value == nil {
		return "", fmt.Errorf("null value")
	}

	// Convert to string first
	var strValue string
	switch v := value.(type) {
	case string:
		strValue = v
	case float64:
		if v == float64(int64(v)) {
			strValue = fmt.Sprintf("%d", int64(v))
		} else {
			strValue = fmt.Sprintf("%g", v)
		}
	case bool:
		strValue = fmt.Sprintf("%t", v)
	case []interface{}:
		// Handle arrays based on format
		switch sqlFormat {
		case models.SqlFormatStringList:
			var parts []string
			for _, item := range v {
				s := fmt.Sprintf("%v", item)
				parts = append(parts, fmt.Sprintf("'%s'", escapeString(s)))
			}
			return strings.Join(parts, ","), nil
		case models.SqlFormatNumberList:
			var parts []string
			for _, item := range v {
				s := fmt.Sprintf("%v", item)
				if !isValidNumber(s) {
					return "", fmt.Errorf("invalid number in list: %s", s)
				}
				parts = append(parts, s)
			}
			return strings.Join(parts, ","), nil
		default:
			// Default array handling
			var parts []string
			for _, item := range v {
				parts = append(parts, fmt.Sprintf("%v", item))
			}
			strValue = strings.Join(parts, ",")
		}
	default:
		strValue = fmt.Sprintf("%v", v)
	}

	// Format based on SqlFormat
	switch sqlFormat {
	case models.SqlFormatString:
		// Escape and quote as string literal
		return fmt.Sprintf("'%s'", escapeString(strValue)), nil

	case models.SqlFormatNumber:
		// Validate as number
		if !isValidNumber(strValue) {
			return "", fmt.Errorf("invalid number: %s", strValue)
		}
		return strValue, nil

	case models.SqlFormatDate:
		// Validate and format as date literal
		if !isValidDate(strValue) {
			return "", fmt.Errorf("invalid date format (expected YYYY-MM-DD): %s", strValue)
		}
		return fmt.Sprintf("DATE '%s'", strValue), nil

	case models.SqlFormatIdentifier:
		// Validate and quote as identifier
		if !isValidIdentifier(strValue) {
			return "", fmt.Errorf("invalid identifier: %s", strValue)
		}
		return fmt.Sprintf("\"%s\"", strValue), nil

	case models.SqlFormatStringList:
		// Format as comma-separated quoted strings
		parts := strings.Split(strValue, ",")
		var quoted []string
		for _, part := range parts {
			quoted = append(quoted, fmt.Sprintf("'%s'", escapeString(strings.TrimSpace(part))))
		}
		return strings.Join(quoted, ","), nil

	case models.SqlFormatNumberList:
		// Format as comma-separated numbers
		parts := strings.Split(strValue, ",")
		var numbers []string
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if !isValidNumber(part) {
				return "", fmt.Errorf("invalid number in list: %s", part)
			}
			numbers = append(numbers, part)
		}
		return strings.Join(numbers, ","), nil

	case models.SqlFormatRaw:
		fallthrough
	default:
		// Raw format - escape single quotes for safety
		return escapeString(strValue), nil
	}
}

// getParameterDefinition finds a parameter definition by name
func getParameterDefinition(defs []models.ParameterDefinition, name string) *models.ParameterDefinition {
	for i := range defs {
		if defs[i].Name == name {
			return &defs[i]
		}
	}
	return nil
}

// replaceParameters replaces {{param}} placeholders with provided values
// Returns the resolved query and list of missing parameters
func replaceParameters(queryText string, params map[string]interface{}) (string, []string) {
	// Use replaceParametersWithDefs with no definitions (legacy behavior)
	return replaceParametersWithDefs(queryText, params, nil)
}

// replaceParametersWithDefs replaces {{param}} placeholders with provided values
// using parameter definitions for proper formatting and validation
func replaceParametersWithDefs(queryText string, params map[string]interface{}, defs []models.ParameterDefinition) (string, []string) {
	required := extractParameters(queryText)
	var missing []string

	result := queryText
	for _, paramName := range required {
		placeholder := fmt.Sprintf("{{%s}}", paramName)
		value, exists := params[paramName]

		// Get parameter definition if available
		def := getParameterDefinition(defs, paramName)

		// Check for empty/missing value
		if !exists || value == nil || value == "" {
			// Check empty behavior from definition
			if def != nil {
				switch def.EmptyBehavior {
				case models.EmptyBehaviorNull:
					result = strings.ReplaceAll(result, placeholder, "NULL")
					continue
				case models.EmptyBehaviorMatchNone:
					result = strings.ReplaceAll(result, placeholder, "1=0")
					continue
				}
			}
			missing = append(missing, paramName)
			continue
		}

		// Determine SQL format
		sqlFormat := models.SqlFormatRaw
		if def != nil && def.SqlFormat != "" {
			sqlFormat = def.SqlFormat
		}

		// Format the value
		formattedValue, err := formatParameterValue(value, sqlFormat)
		if err != nil {
			// Validation failed - treat as missing to prevent SQL injection
			missing = append(missing, paramName)
			continue
		}

		result = strings.ReplaceAll(result, placeholder, formattedValue)
	}

	return result, missing
}

// GetWidgetDataWithParams executes the widget's query with parameter substitution.
// POST /dashboards/:id/widgets/:widgetId/data
func (h *DashboardHandler) GetWidgetDataWithParams(c *gin.Context) {
	ctx := c.Request.Context()
	userID := c.MustGet("userID").(uuid.UUID)

	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}
	widgetID, err := uuid.Parse(c.Param("widgetId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget id"})
		return
	}

	// Parse request body
	var req models.WidgetDataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Check if user has at least view permission on the dashboard
	permLevel, err := h.dashboardService.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if !permLevel.CanView() {
		c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
		return
	}

	// Get widget (single query instead of fetching all widgets)
	widget, err := h.dashboardService.GetWidget(ctx, dashboardID, widgetID)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "widget not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if widget.QueryID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "widget has no associated query"})
		return
	}

	// Get the saved query
	savedQuery, err := h.queryService.GetSavedQueryByID(ctx, *widget.QueryID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "query not found"})
		return
	}

	// Get dashboard to access parameter definitions for secure formatting
	dashboard, err := h.dashboardService.GetDashboard(ctx, dashboardID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get dashboard"})
		return
	}

	// Parse parameter definitions from dashboard
	var paramDefs []models.ParameterDefinition
	if len(dashboard.Parameters) > 0 {
		if err := json.Unmarshal(dashboard.Parameters, &paramDefs); err != nil {
			// Log but don't fail - fall back to raw format
			paramDefs = nil
		}
	}

	// Extract required parameters from query
	requiredParams := extractParameters(savedQuery.QueryText)

	// Replace parameters with provided values using definitions for secure formatting
	resolvedQuery, missingParams := replaceParametersWithDefs(savedQuery.QueryText, req.Parameters, paramDefs)

	// If there are missing required parameters, return them
	if len(missingParams) > 0 {
		c.JSON(http.StatusOK, models.WidgetDataResponse{
			WidgetID:           widgetID,
			RequiredParameters: requiredParams,
			MissingParameters:  missingParams,
		})
		return
	}

	// Get dashboard owner for permission check
	ownerID, err := h.dashboardService.GetDashboardOwner(ctx, dashboardID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Check if the dashboard owner has access to the catalog
	catalog := ""
	schema := ""
	if savedQuery.Catalog != nil {
		catalog = *savedQuery.Catalog
	}
	if savedQuery.SchemaName != nil {
		schema = *savedQuery.SchemaName
	}

	if h.roleService != nil && catalog != "" {
		hasAccess, err := h.roleService.CanUserAccessCatalog(ctx, ownerID, catalog)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !hasAccess {
			c.JSON(http.StatusForbidden, gin.H{"error": "dashboard owner does not have access to the data source"})
			return
		}
	}

	// Execute the resolved query with caching
	// Note: Cache key should include parameters for uniqueness
	result, err := h.trinoService.ExecuteQueryWithCache(ctx, resolvedQuery, catalog, schema, int(services.CachePriorityNormal), widget.QueryID)
	if err != nil {
		c.JSON(http.StatusOK, models.WidgetDataResponse{
			WidgetID:           widgetID,
			Error:              err.Error(),
			RequiredParameters: requiredParams,
		})
		return
	}

	c.JSON(http.StatusOK, models.WidgetDataResponse{
		WidgetID:           widgetID,
		QueryResult:        result,
		RequiredParameters: requiredParams,
	})
}

// GetParameterOptions executes the options query for a parameter with dynamic options.
// POST /dashboards/:id/parameters/:name/options
func (h *DashboardHandler) GetParameterOptions(c *gin.Context) {
	ctx := c.Request.Context()
	userID := c.MustGet("userID").(uuid.UUID)

	dashboardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dashboard id"})
		return
	}

	paramName := c.Param("name")
	if paramName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parameter name is required"})
		return
	}

	// Parse request body for dependent parameter values
	var req models.ParameterOptionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Empty body is acceptable
		req = models.ParameterOptionsRequest{}
	}

	// Check if user has at least view permission on the dashboard
	permLevel, err := h.dashboardService.GetUserPermissionLevel(ctx, dashboardID, userID)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if !permLevel.CanView() {
		c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
		return
	}

	// Get dashboard to access parameter definitions
	dashboard, err := h.dashboardService.GetDashboard(ctx, dashboardID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
		return
	}

	// Parse parameter definitions from JSON
	var paramDefs []models.ParameterDefinition
	if len(dashboard.Parameters) > 0 {
		if err := json.Unmarshal(dashboard.Parameters, &paramDefs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse parameters"})
			return
		}
	}

	// Find the parameter definition
	var paramDef *models.ParameterDefinition
	for i := range paramDefs {
		if paramDefs[i].Name == paramName {
			paramDef = &paramDefs[i]
			break
		}
	}

	if paramDef == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "parameter not found"})
		return
	}

	// Check if parameter has optionsQueryId
	if paramDef.OptionsQueryID == nil {
		// Return static options if available
		if paramDef.Options != nil {
			c.JSON(http.StatusOK, paramDef.Options)
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "parameter has no options query"})
		return
	}

	// Get the options query
	savedQuery, err := h.queryService.GetSavedQueryByID(ctx, *paramDef.OptionsQueryID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "options query not found"})
		return
	}

	// Get dashboard owner for permission check
	ownerID, err := h.dashboardService.GetDashboardOwner(ctx, dashboardID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Check if the dashboard owner has access to the catalog
	catalog := ""
	schema := ""
	if savedQuery.Catalog != nil {
		catalog = *savedQuery.Catalog
	}
	if savedQuery.SchemaName != nil {
		schema = *savedQuery.SchemaName
	}

	if h.roleService != nil && catalog != "" {
		hasAccess, err := h.roleService.CanUserAccessCatalog(ctx, ownerID, catalog)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !hasAccess {
			c.JSON(http.StatusForbidden, gin.H{"error": "dashboard owner does not have access to the data source"})
			return
		}
	}

	// Replace parameters in the options query (for cascade/dependsOn)
	// Use secure formatting based on parameter definitions
	resolvedQuery, _ := replaceParametersWithDefs(savedQuery.QueryText, req.Parameters, paramDefs)

	// Execute the query
	result, err := h.trinoService.ExecuteQueryWithCache(ctx, resolvedQuery, catalog, schema, int(services.CachePriorityNormal), paramDef.OptionsQueryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Convert query result to options
	// First column = value, second column = label (optional)
	const maxOptions = 200
	options := make([]models.ParameterOption, 0, min(len(result.Rows), maxOptions))

	for i, row := range result.Rows {
		if i >= maxOptions {
			break
		}
		if len(row) == 0 {
			continue
		}

		value := fmt.Sprintf("%v", row[0])
		label := value
		if len(row) > 1 && row[1] != nil {
			label = fmt.Sprintf("%v", row[1])
		}

		options = append(options, models.ParameterOption{
			Value: value,
			Label: label,
		})
	}

	c.JSON(http.StatusOK, options)
}
