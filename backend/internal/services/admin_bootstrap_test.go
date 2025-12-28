package services

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
)

// mockRoleRepository is a minimal mock for testing admin bootstrap
type mockRoleRepository struct {
	adminRole     *models.Role
	assignedRoles map[uuid.UUID]uuid.UUID // userID -> roleID
}

func newMockRoleRepository() *mockRoleRepository {
	return &mockRoleRepository{
		adminRole: &models.Role{
			ID:       uuid.New(),
			Name:     "admin",
			IsSystem: true,
		},
		assignedRoles: make(map[uuid.UUID]uuid.UUID),
	}
}

func (m *mockRoleRepository) GetAll(ctx context.Context) ([]models.Role, error) {
	return []models.Role{*m.adminRole}, nil
}

func (m *mockRoleRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Role, error) {
	if id == m.adminRole.ID {
		return m.adminRole, nil
	}
	return nil, repository.ErrNotFound
}

func (m *mockRoleRepository) GetByName(ctx context.Context, name string) (*models.Role, error) {
	if name == "admin" {
		return m.adminRole, nil
	}
	return nil, repository.ErrNotFound
}

func (m *mockRoleRepository) Create(ctx context.Context, name, description string) (*models.Role, error) {
	return &models.Role{ID: uuid.New(), Name: name, Description: description}, nil
}

func (m *mockRoleRepository) Update(ctx context.Context, id uuid.UUID, name, description string) (*models.Role, error) {
	return &models.Role{ID: id, Name: name, Description: description}, nil
}

func (m *mockRoleRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *mockRoleRepository) GetUserRoles(ctx context.Context, userID uuid.UUID) ([]models.Role, error) {
	if roleID, ok := m.assignedRoles[userID]; ok {
		if roleID == m.adminRole.ID {
			return []models.Role{*m.adminRole}, nil
		}
	}
	return nil, nil
}

func (m *mockRoleRepository) GetRoleUsers(ctx context.Context, roleID uuid.UUID) ([]models.User, error) {
	return nil, nil
}

func (m *mockRoleRepository) AssignRole(ctx context.Context, userID, roleID uuid.UUID, assignedBy *uuid.UUID) error {
	m.assignedRoles[userID] = roleID
	return nil
}

func (m *mockRoleRepository) UnassignRole(ctx context.Context, userID, roleID uuid.UUID) error {
	delete(m.assignedRoles, userID)
	return nil
}

func (m *mockRoleRepository) GetRoleCatalogs(ctx context.Context, roleID uuid.UUID) ([]string, error) {
	return nil, nil
}

func (m *mockRoleRepository) SetRoleCatalogs(ctx context.Context, roleID uuid.UUID, catalogs []string) error {
	return nil
}

func (m *mockRoleRepository) GetUserAllowedCatalogs(ctx context.Context, userID uuid.UUID) ([]string, error) {
	return nil, nil
}

func (m *mockRoleRepository) IsUserAdmin(ctx context.Context, userID uuid.UUID) (bool, error) {
	roleID, ok := m.assignedRoles[userID]
	return ok && roleID == m.adminRole.ID, nil
}

func (m *mockRoleRepository) GetAdminRole(ctx context.Context) (*models.Role, error) {
	return m.adminRole, nil
}

func (m *mockRoleRepository) CountUsers(ctx context.Context) (int, error) {
	return 0, nil
}

func (m *mockRoleRepository) GetAllUsersWithRoles(ctx context.Context) ([]models.UserWithRoles, error) {
	return nil, nil
}

func TestEnsureAdminUser_PasswordNotSet_Skips(t *testing.T) {
	userRepo := repository.NewMockUserRepository()
	roleRepo := newMockRoleRepository()

	cfg := &config.AdminConfig{
		Username: "admin",
		Password: "", // Empty password
	}

	svc := NewAdminBootstrapService(cfg, userRepo, roleRepo)
	err := svc.EnsureAdminUser(context.Background())

	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}

	// Should not create any user
	if len(userRepo.Users) != 0 {
		t.Errorf("Expected 0 users, got: %d", len(userRepo.Users))
	}
}

func TestEnsureAdminUser_CreatesNewUser(t *testing.T) {
	userRepo := repository.NewMockUserRepository()
	roleRepo := newMockRoleRepository()

	cfg := &config.AdminConfig{
		Username: "testadmin",
		Password: "testpassword123",
	}

	svc := NewAdminBootstrapService(cfg, userRepo, roleRepo)
	err := svc.EnsureAdminUser(context.Background())

	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}

	// Should create user
	if len(userRepo.Users) != 1 {
		t.Errorf("Expected 1 user, got: %d", len(userRepo.Users))
	}

	// Check user is created by username (not email)
	user, exists := userRepo.UsersByUsername["testadmin"]
	if !exists {
		t.Error("Expected user with username 'testadmin' to exist")
	}

	// Check user has no email
	if user.Email != nil {
		t.Errorf("Expected user to have no email, got: %v", user.Email)
	}

	// Check user has username
	if user.Username == nil || *user.Username != "testadmin" {
		t.Errorf("Expected user username 'testadmin', got: %v", user.Username)
	}

	// Check user name
	if user.Name != "testadmin" {
		t.Errorf("Expected user name 'testadmin', got: %s", user.Name)
	}

	// Check password is hashed (not plaintext)
	if user.PasswordHash == "testpassword123" {
		t.Error("Password should be hashed, not stored as plaintext")
	}

	// Check admin role is assigned
	if _, ok := roleRepo.assignedRoles[user.ID]; !ok {
		t.Error("Expected admin role to be assigned to user")
	}
}

func TestEnsureAdminUser_ExistingUser_Skips(t *testing.T) {
	userRepo := repository.NewMockUserRepository()
	roleRepo := newMockRoleRepository()

	// Pre-create admin user with username
	username := "admin"
	existingUser := &models.User{
		ID:       uuid.New(),
		Username: &username,
		Name:     "admin",
	}
	userRepo.AddUser(existingUser)

	cfg := &config.AdminConfig{
		Username: "admin",
		Password: "testpassword123",
	}

	svc := NewAdminBootstrapService(cfg, userRepo, roleRepo)
	err := svc.EnsureAdminUser(context.Background())

	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}

	// Should not create additional users
	if len(userRepo.Users) != 1 {
		t.Errorf("Expected 1 user (existing only), got: %d", len(userRepo.Users))
	}
}

func TestEnsureAdminUser_DefaultUsername(t *testing.T) {
	userRepo := repository.NewMockUserRepository()
	roleRepo := newMockRoleRepository()

	cfg := &config.AdminConfig{
		Username: "admin", // Default username
		Password: "testpassword123",
	}

	svc := NewAdminBootstrapService(cfg, userRepo, roleRepo)
	err := svc.EnsureAdminUser(context.Background())

	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}

	// Check user is created with default username
	if _, exists := userRepo.UsersByUsername["admin"]; !exists {
		t.Error("Expected user with username 'admin' to exist")
	}
}

func TestEnsureAdminUser_PasswordTooShort_FailsStartup(t *testing.T) {
	userRepo := repository.NewMockUserRepository()
	roleRepo := newMockRoleRepository()

	cfg := &config.AdminConfig{
		Username:          "admin",
		Password:          "test", // Only 4 characters
		PasswordMinLength: 6,      // Requires 6
	}

	svc := NewAdminBootstrapService(cfg, userRepo, roleRepo)
	err := svc.EnsureAdminUser(context.Background())

	if err == nil {
		t.Error("Expected error when password is too short, got nil")
	}

	// Check error message contains useful information
	expectedSubstr := "too short"
	if err != nil && !contains(err.Error(), expectedSubstr) {
		t.Errorf("Expected error message to contain '%s', got: %v", expectedSubstr, err)
	}

	// Should not create any user
	if len(userRepo.Users) != 0 {
		t.Errorf("Expected 0 users when password too short, got: %d", len(userRepo.Users))
	}
}

func TestEnsureAdminUser_PasswordMinLengthZero_AllowsShortPassword(t *testing.T) {
	userRepo := repository.NewMockUserRepository()
	roleRepo := newMockRoleRepository()

	cfg := &config.AdminConfig{
		Username:          "admin",
		Password:          "test", // Only 4 characters
		PasswordMinLength: 0,      // No minimum
	}

	svc := NewAdminBootstrapService(cfg, userRepo, roleRepo)
	err := svc.EnsureAdminUser(context.Background())

	if err != nil {
		t.Errorf("Expected no error when min length is 0, got: %v", err)
	}

	// Should create user
	if len(userRepo.Users) != 1 {
		t.Errorf("Expected 1 user, got: %d", len(userRepo.Users))
	}
}

func TestEnsureAdminUser_PasswordExactlyMinLength_Succeeds(t *testing.T) {
	userRepo := repository.NewMockUserRepository()
	roleRepo := newMockRoleRepository()

	cfg := &config.AdminConfig{
		Username:          "admin",
		Password:          "123456", // Exactly 6 characters
		PasswordMinLength: 6,        // Requires 6
	}

	svc := NewAdminBootstrapService(cfg, userRepo, roleRepo)
	err := svc.EnsureAdminUser(context.Background())

	if err != nil {
		t.Errorf("Expected no error when password is exactly min length, got: %v", err)
	}

	// Should create user
	if len(userRepo.Users) != 1 {
		t.Errorf("Expected 1 user, got: %d", len(userRepo.Users))
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
