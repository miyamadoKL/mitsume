package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/services"
)

type SavedQueryHandler struct {
	queryService *services.QueryService
}

func NewSavedQueryHandler(queryService *services.QueryService) *SavedQueryHandler {
	return &SavedQueryHandler{
		queryService: queryService,
	}
}

func (h *SavedQueryHandler) GetSavedQueries(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	queries, err := h.queryService.GetSavedQueries(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if queries == nil {
		queries = []models.SavedQuery{}
	}

	c.JSON(http.StatusOK, queries)
}

func (h *SavedQueryHandler) GetSavedQuery(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	queryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid query id"})
		return
	}

	query, err := h.queryService.GetSavedQuery(c.Request.Context(), queryID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "query not found"})
		return
	}

	c.JSON(http.StatusOK, query)
}

func (h *SavedQueryHandler) CreateSavedQuery(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req models.SaveQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query, err := h.queryService.CreateSavedQuery(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, query)
}

func (h *SavedQueryHandler) UpdateSavedQuery(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	queryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid query id"})
		return
	}

	var req models.UpdateQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query, err := h.queryService.UpdateSavedQuery(c.Request.Context(), queryID, userID, &req)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "query not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, query)
}

func (h *SavedQueryHandler) DeleteSavedQuery(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	queryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid query id"})
		return
	}

	if err := h.queryService.DeleteSavedQuery(c.Request.Context(), queryID, userID); err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "query not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *SavedQueryHandler) GetQueryHistory(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	limit := 50
	offset := 0

	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil {
			offset = parsed
		}
	}

	history, err := h.queryService.GetQueryHistory(c.Request.Context(), userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if history == nil {
		history = []models.QueryHistory{}
	}

	c.JSON(http.StatusOK, history)
}
