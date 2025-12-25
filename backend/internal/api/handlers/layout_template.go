package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
)

type LayoutTemplateHandler struct {
	repo repository.LayoutTemplateRepository
}

func NewLayoutTemplateHandler(repo repository.LayoutTemplateRepository) *LayoutTemplateHandler {
	return &LayoutTemplateHandler{repo: repo}
}

// GetLayoutTemplates returns all layout templates for the user
func (h *LayoutTemplateHandler) GetLayoutTemplates(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	templates, err := h.repo.GetAll(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if templates == nil {
		templates = []models.LayoutTemplate{}
	}

	c.JSON(http.StatusOK, templates)
}

// CreateLayoutTemplate creates a new custom layout template
func (h *LayoutTemplateHandler) CreateLayoutTemplate(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req models.CreateLayoutTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	template, err := h.repo.Create(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, template)
}

// DeleteLayoutTemplate deletes a custom layout template
func (h *LayoutTemplateHandler) DeleteLayoutTemplate(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	templateID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid template id"})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), templateID, userID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "template not found or cannot be deleted"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
