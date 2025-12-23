package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/services"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type AuthHandler struct {
	authService *services.AuthService
	oauthConfig *oauth2.Config
	cfg         *config.Config
}

func NewAuthHandler(authService *services.AuthService, cfg *config.Config) *AuthHandler {
	var oauthConfig *oauth2.Config
	if cfg.Google.ClientID != "" && cfg.Google.ClientSecret != "" {
		oauthConfig = &oauth2.Config{
			ClientID:     cfg.Google.ClientID,
			ClientSecret: cfg.Google.ClientSecret,
			RedirectURL:  cfg.Google.RedirectURL,
			Scopes:       []string{"openid", "profile", "email"},
			Endpoint:     google.Endpoint,
		}
	}

	return &AuthHandler{
		authService: authService,
		oauthConfig: oauthConfig,
		cfg:         cfg,
	}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.authService.Register(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.authService.Login(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	user, err := h.authService.GetUserByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Get user roles
	roles, err := h.authService.GetUserRoles(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		// Return user without roles if there's an error fetching roles
		c.JSON(http.StatusOK, user)
		return
	}

	// Return user with roles
	response := models.UserWithRoles{
		User:  *user,
		Roles: roles,
	}
	if response.Roles == nil {
		response.Roles = []models.Role{}
	}

	c.JSON(http.StatusOK, response)
}

func (h *AuthHandler) GoogleLogin(c *gin.Context) {
	if h.oauthConfig == nil {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "Google OAuth not configured"})
		return
	}

	state := uuid.New().String()
	url := h.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)

	// Save state in a short-lived cookie to validate on callback
	c.SetCookie("oauth_state", state, 300, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{"url": url})
}

func (h *AuthHandler) GoogleCallback(c *gin.Context) {
	if h.oauthConfig == nil {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "Google OAuth not configured"})
		return
	}

	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "authorization code required"})
		return
	}

	state := c.Query("state")
	cookieState, err := c.Cookie("oauth_state")
	if err != nil || state == "" || cookieState != state {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid oauth state"})
		return
	}
	// Invalidate state cookie
	c.SetCookie("oauth_state", "", -1, "/", "", false, true)

	token, err := h.oauthConfig.Exchange(context.Background(), code)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to exchange token"})
		return
	}

	client := h.oauthConfig.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user info"})
		return
	}
	defer resp.Body.Close()

	var userInfo struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode user info"})
		return
	}

	authResp, err := h.authService.FindOrCreateGoogleUser(c.Request.Context(), userInfo.ID, userInfo.Email, userInfo.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create or find user"})
		return
	}

	// Redirect to frontend with token
	frontendURL := h.cfg.Server.FrontendURL + "/auth/callback?token=" + authResp.Token
	c.Redirect(http.StatusTemporaryRedirect, frontendURL)
}
