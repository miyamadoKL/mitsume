package services

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	cfg      *config.Config
	userRepo repository.UserRepository
	roleRepo repository.RoleRepository
}

func NewAuthService(cfg *config.Config, userRepo repository.UserRepository, roleRepo repository.RoleRepository) *AuthService {
	return &AuthService{
		cfg:      cfg,
		userRepo: userRepo,
		roleRepo: roleRepo,
	}
}

func (s *AuthService) Register(ctx context.Context, req *models.RegisterRequest) (*models.AuthResponse, error) {
	// Check if user already exists
	exists, err := s.userRepo.ExistsByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("user with this email already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	user, err := s.userRepo.Create(ctx, req.Email, string(hashedPassword), req.Name)
	if err != nil {
		return nil, err
	}

	// Auto-assign admin role to the first registered user
	if s.roleRepo != nil {
		if err := s.autoAssignAdminToFirstUser(ctx, user.ID); err != nil {
			log.Printf("[WARN] Failed to auto-assign admin role to first user %s: %v", user.ID, err)
		}
	}

	// Generate token
	token, err := s.generateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Status: models.AuthStatusSuccess,
		Token:  token,
		User:   user,
	}, nil
}

func (s *AuthService) Login(ctx context.Context, req *models.LoginRequest) (*models.AuthResponse, error) {
	if req.Email == "" {
		return nil, errors.New("email or username is required")
	}

	// Try to find user by email or username
	user, err := s.userRepo.FindByEmailOrUsername(ctx, req.Email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, errors.New("invalid credentials")
		}
		return nil, errors.New("invalid credentials")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Generate token
	token, err := s.generateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Status: models.AuthStatusSuccess,
		Token:  token,
		User:   user,
	}, nil
}

func (s *AuthService) GetUserByID(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	return s.userRepo.FindByID(ctx, userID)
}

func (s *AuthService) FindOrCreateGoogleUser(ctx context.Context, googleID, email, name string) (*models.AuthResponse, error) {
	// Try to find existing user by Google ID
	user, err := s.userRepo.FindByGoogleID(ctx, googleID)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	isNewUser := user == nil
	if isNewUser {
		// Create new user
		user, err = s.userRepo.CreateGoogleUser(ctx, email, name, googleID)
		if err != nil {
			return nil, err
		}

		// Auto-assign admin role to the first registered user
		if s.roleRepo != nil {
			if err := s.autoAssignAdminToFirstUser(ctx, user.ID); err != nil {
				log.Printf("[WARN] Failed to auto-assign admin role to first Google user %s: %v", user.ID, err)
			}
		}
	}

	// Generate token
	token, err := s.generateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Status: models.AuthStatusSuccess,
		Token:  token,
		User:   user,
	}, nil
}

func (s *AuthService) generateToken(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"exp":     time.Now().Add(time.Duration(s.cfg.JWT.ExpireHour) * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWT.Secret))
}

func (s *AuthService) ValidateToken(tokenString string) (uuid.UUID, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(s.cfg.JWT.Secret), nil
	})

	if err != nil {
		return uuid.Nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		userIDStr, ok := claims["user_id"].(string)
		if !ok {
			return uuid.Nil, errors.New("invalid token claims")
		}
		return uuid.Parse(userIDStr)
	}

	return uuid.Nil, errors.New("invalid token")
}

// autoAssignAdminToFirstUser assigns admin role to the first registered user
func (s *AuthService) autoAssignAdminToFirstUser(ctx context.Context, userID uuid.UUID) error {
	count, err := s.roleRepo.CountUsers(ctx)
	if err != nil {
		return err
	}

	// Only assign admin to the very first user
	if count == 1 {
		adminRole, err := s.roleRepo.GetAdminRole(ctx)
		if err != nil {
			return err
		}
		return s.roleRepo.AssignRole(ctx, userID, adminRole.ID, nil)
	}

	return nil
}

// GetUserRoles returns the roles for a specific user
func (s *AuthService) GetUserRoles(ctx context.Context, userID uuid.UUID) ([]models.Role, error) {
	if s.roleRepo == nil {
		return nil, nil
	}
	return s.roleRepo.GetUserRoles(ctx, userID)
}
