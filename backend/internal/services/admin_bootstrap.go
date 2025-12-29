package services

import (
	"context"
	"fmt"
	"log"
	"unicode/utf8"

	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/crypto"
	"github.com/mitsume/backend/internal/repository"
)

// AdminBootstrapService handles initial admin user creation from environment variables
type AdminBootstrapService struct {
	cfg      *config.AdminConfig
	userRepo repository.UserRepository
	roleRepo repository.RoleRepository
}

// NewAdminBootstrapService creates a new AdminBootstrapService
func NewAdminBootstrapService(cfg *config.AdminConfig, userRepo repository.UserRepository, roleRepo repository.RoleRepository) *AdminBootstrapService {
	return &AdminBootstrapService{
		cfg:      cfg,
		userRepo: userRepo,
		roleRepo: roleRepo,
	}
}

// EnsureAdminUser creates the admin user from environment variables if not exists
func (s *AdminBootstrapService) EnsureAdminUser(ctx context.Context) error {
	// Skip if password is not set
	if s.cfg.Password == "" {
		log.Println("[INFO] MITSUME_ADMIN_PASSWORD not set, skipping admin user creation")
		return nil
	}

	// Validate password length (use rune count for proper multi-byte character handling)
	passwordLength := utf8.RuneCountInString(s.cfg.Password)
	if s.cfg.PasswordMinLength > 0 && passwordLength < s.cfg.PasswordMinLength {
		return fmt.Errorf("MITSUME_ADMIN_PASSWORD is too short: got %d characters, minimum required is %d (set by MITSUME_ADMIN_PASSWORD_MIN_LENGTH)",
			passwordLength, s.cfg.PasswordMinLength)
	}

	// Check if user already exists by username
	existingUser, err := s.userRepo.FindByUsername(ctx, s.cfg.Username)
	if err != nil && err != repository.ErrNotFound {
		return fmt.Errorf("failed to check if admin user exists: %w", err)
	}

	if existingUser != nil {
		// Verify that env password matches the stored hash
		if err := crypto.VerifyPassword(s.cfg.Password, existingUser.PasswordHash); err != nil {
			return fmt.Errorf("MITSUME_ADMIN_PASSWORD does not match the existing admin user's password: update the environment variable or delete the existing admin user")
		}
		log.Printf("[INFO] Admin user '%s' already exists with matching password, skipping creation", s.cfg.Username)
		return nil
	}

	// Hash password
	hashedPassword, err := crypto.HashPassword(s.cfg.Password)
	if err != nil {
		return fmt.Errorf("failed to hash admin password: %w", err)
	}

	// Create admin user (without email)
	user, err := s.userRepo.CreateAdminUser(ctx, s.cfg.Username, hashedPassword, s.cfg.Username)
	if err != nil {
		return fmt.Errorf("failed to create admin user: %w", err)
	}

	log.Printf("[INFO] Created admin user: %s", s.cfg.Username)

	// Assign admin role
	adminRole, err := s.roleRepo.GetAdminRole(ctx)
	if err != nil {
		return fmt.Errorf("failed to get admin role: %w", err)
	}

	if err := s.roleRepo.AssignRole(ctx, user.ID, adminRole.ID, nil); err != nil {
		return fmt.Errorf("failed to assign admin role: %w", err)
	}

	log.Printf("[INFO] Assigned admin role to user: %s", s.cfg.Username)

	return nil
}
