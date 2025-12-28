package services

import (
	"context"
	"fmt"
	"log"

	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
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

	// Validate password length
	if s.cfg.PasswordMinLength > 0 && len(s.cfg.Password) < s.cfg.PasswordMinLength {
		return fmt.Errorf("MITSUME_ADMIN_PASSWORD is too short: got %d characters, minimum required is %d (set by MITSUME_ADMIN_PASSWORD_MIN_LENGTH)",
			len(s.cfg.Password), s.cfg.PasswordMinLength)
	}

	// Check if user already exists by username
	exists, err := s.userRepo.ExistsByUsername(ctx, s.cfg.Username)
	if err != nil {
		return fmt.Errorf("failed to check if admin user exists: %w", err)
	}

	if exists {
		log.Printf("[INFO] Admin user '%s' already exists, skipping creation", s.cfg.Username)
		return nil
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(s.cfg.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash admin password: %w", err)
	}

	// Create admin user (without email)
	user, err := s.userRepo.CreateAdminUser(ctx, s.cfg.Username, string(hashedPassword), s.cfg.Username)
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
