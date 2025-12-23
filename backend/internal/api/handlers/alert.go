package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/services"
)

// AlertHandler handles alert API requests
type AlertHandler struct {
	alertService        *services.AlertService
	notificationService *services.NotificationService
}

// NewAlertHandler creates a new alert handler
func NewAlertHandler(alertService *services.AlertService, notificationService *services.NotificationService) *AlertHandler {
	return &AlertHandler{
		alertService:        alertService,
		notificationService: notificationService,
	}
}

// GetAlerts returns all alerts for the authenticated user
func (h *AlertHandler) GetAlerts(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	alerts, err := h.alertService.GetAlerts(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if alerts == nil {
		alerts = []models.QueryAlert{}
	}

	c.JSON(http.StatusOK, alerts)
}

// GetAlert returns a specific alert
func (h *AlertHandler) GetAlert(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	alertID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	alert, err := h.alertService.GetAlertByID(c.Request.Context(), alertID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert not found"})
		return
	}

	if alert.UserID != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized"})
		return
	}

	c.JSON(http.StatusOK, alert)
}

// CreateAlert creates a new alert
func (h *AlertHandler) CreateAlert(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.CreateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	alert, err := h.alertService.CreateAlert(c.Request.Context(), userID.(uuid.UUID), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, alert)
}

// UpdateAlert updates an alert
func (h *AlertHandler) UpdateAlert(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	alertID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	var req models.UpdateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	alert, err := h.alertService.UpdateAlert(c.Request.Context(), alertID, userID.(uuid.UUID), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, alert)
}

// DeleteAlert deletes an alert
func (h *AlertHandler) DeleteAlert(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	alertID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	if err := h.alertService.DeleteAlert(c.Request.Context(), alertID, userID.(uuid.UUID)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert deleted"})
}

// TestAlert manually triggers an alert evaluation
func (h *AlertHandler) TestAlert(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	alertID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	alert, err := h.alertService.GetAlertByID(c.Request.Context(), alertID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert not found"})
		return
	}

	if alert.UserID != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized"})
		return
	}

	triggered, value, err := h.alertService.EvaluateAlert(c.Request.Context(), alert)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := gin.H{
		"triggered":    triggered,
		"actual_value": value,
		"condition": gin.H{
			"column":   alert.ConditionColumn,
			"operator": alert.ConditionOperator,
			"value":    alert.ConditionValue,
		},
	}

	if triggered {
		// Send test notification
		channels, err := h.alertService.GetAlertChannels(c.Request.Context(), alertID)
		if err == nil && len(channels) > 0 {
			msg := models.NotificationMessage{
				Title: "[TEST] Alert: " + alert.Name,
				Body:  "This is a test notification. Condition met with value: " + value,
			}
			for _, ch := range channels {
				_ = h.notificationService.Send(c.Request.Context(), &ch, msg)
			}
			result["notification_sent"] = true
		}
	}

	c.JSON(http.StatusOK, result)
}

// GetAlertHistory returns the history of alert triggers
func (h *AlertHandler) GetAlertHistory(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	alertID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	// Verify ownership
	alert, err := h.alertService.GetAlertByID(c.Request.Context(), alertID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert not found"})
		return
	}

	if alert.UserID != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized"})
		return
	}

	// Get limit from query params, default to 50
	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	history, err := h.alertService.GetAlertHistory(c.Request.Context(), alertID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if history == nil {
		history = []models.AlertHistory{}
	}

	c.JSON(http.StatusOK, history)
}
