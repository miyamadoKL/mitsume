package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
	"github.com/mitsume/backend/internal/services"
)

type RoleHandler struct {
	roleService  *services.RoleService
	trinoService *services.TrinoService
}

func NewRoleHandler(roleService *services.RoleService, trinoService *services.TrinoService) *RoleHandler {
	return &RoleHandler{
		roleService:  roleService,
		trinoService: trinoService,
	}
}

// Role CRUD

func (h *RoleHandler) GetRoles(c *gin.Context) {
	roles, err := h.roleService.GetAllRoles(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if roles == nil {
		roles = []models.RoleWithCatalogs{}
	}

	c.JSON(http.StatusOK, roles)
}

func (h *RoleHandler) GetRole(c *gin.Context) {
	roleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role id"})
		return
	}

	role, err := h.roleService.GetRole(c.Request.Context(), roleID)
	if err != nil {
		if errors.Is(err, services.ErrRoleNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, role)
}

func (h *RoleHandler) CreateRole(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	role, err := h.roleService.CreateRole(c.Request.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrDuplicateRoleName) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, role)
}

func (h *RoleHandler) UpdateRole(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	roleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role id"})
		return
	}

	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	role, err := h.roleService.UpdateRole(c.Request.Context(), userID, roleID, &req)
	if err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrRoleNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrCannotModifySystem) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrDuplicateRoleName) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, role)
}

func (h *RoleHandler) DeleteRole(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	roleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role id"})
		return
	}

	if err := h.roleService.DeleteRole(c.Request.Context(), userID, roleID); err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrRoleNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrCannotDeleteSystem) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// Catalog permissions

func (h *RoleHandler) SetRoleCatalogs(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)
	roleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role id"})
		return
	}

	var req models.SetCatalogPermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.roleService.SetRoleCatalogs(c.Request.Context(), userID, roleID, req.Catalogs); err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrRoleNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "catalogs updated"})
}

func (h *RoleHandler) GetAvailableCatalogs(c *gin.Context) {
	catalogs, err := h.trinoService.GetCatalogs(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if catalogs == nil {
		catalogs = []string{}
	}

	c.JSON(http.StatusOK, gin.H{"catalogs": catalogs})
}

// User-role management

func (h *RoleHandler) GetUsersWithRoles(c *gin.Context) {
	userID := c.MustGet("userID").(uuid.UUID)

	users, err := h.roleService.GetUsersWithRoles(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if users == nil {
		users = []models.UserWithRoles{}
	}

	c.JSON(http.StatusOK, users)
}

func (h *RoleHandler) AssignRole(c *gin.Context) {
	adminUserID := c.MustGet("userID").(uuid.UUID)
	targetUserID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req models.AssignRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.roleService.AssignRoleToUser(c.Request.Context(), adminUserID, targetUserID, req.RoleID); err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrRoleNotFound) || errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "role or user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "role assigned"})
}

func (h *RoleHandler) UnassignRole(c *gin.Context) {
	adminUserID := c.MustGet("userID").(uuid.UUID)
	targetUserID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}
	roleID, err := uuid.Parse(c.Param("roleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role id"})
		return
	}

	if err := h.roleService.UnassignRoleFromUser(c.Request.Context(), adminUserID, targetUserID, roleID); err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrCannotSelfDemote) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "role assignment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "role unassigned"})
}

// User approval management

func (h *RoleHandler) GetPendingUsers(c *gin.Context) {
	adminUserID := c.MustGet("userID").(uuid.UUID)

	users, err := h.roleService.GetPendingUsers(c.Request.Context(), adminUserID)
	if err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if users == nil {
		users = []models.User{}
	}

	c.JSON(http.StatusOK, users)
}

func (h *RoleHandler) GetAllUsers(c *gin.Context) {
	adminUserID := c.MustGet("userID").(uuid.UUID)

	// Optional status filter
	status := c.Query("status")
	if status != "" {
		// Get users by status if specified
		users, err := h.roleService.GetAllUsers(c.Request.Context(), adminUserID)
		if err != nil {
			if errors.Is(err, services.ErrUnauthorized) {
				c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Filter by status
		var filtered []models.User
		for _, u := range users {
			if string(u.Status) == status {
				filtered = append(filtered, u)
			}
		}
		if filtered == nil {
			filtered = []models.User{}
		}
		c.JSON(http.StatusOK, filtered)
		return
	}

	users, err := h.roleService.GetAllUsers(c.Request.Context(), adminUserID)
	if err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if users == nil {
		users = []models.User{}
	}

	c.JSON(http.StatusOK, users)
}

func (h *RoleHandler) ApproveUser(c *gin.Context) {
	adminUserID := c.MustGet("userID").(uuid.UUID)
	targetUserID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	if err := h.roleService.ApproveUser(c.Request.Context(), adminUserID, targetUserID); err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrUserNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user approved"})
}

func (h *RoleHandler) DisableUser(c *gin.Context) {
	adminUserID := c.MustGet("userID").(uuid.UUID)
	targetUserID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	if err := h.roleService.DisableUser(c.Request.Context(), adminUserID, targetUserID); err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrUserNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrCannotDisableSelf) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user disabled"})
}

func (h *RoleHandler) EnableUser(c *gin.Context) {
	adminUserID := c.MustGet("userID").(uuid.UUID)
	targetUserID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	if err := h.roleService.EnableUser(c.Request.Context(), adminUserID, targetUserID); err != nil {
		if errors.Is(err, services.ErrUnauthorized) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrUserNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user enabled"})
}
