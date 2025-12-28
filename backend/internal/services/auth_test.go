package services

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

func newTestConfig() *config.Config {
	return &config.Config{
		JWT: config.JWTConfig{
			Secret:     "test-secret",
			ExpireHour: 1,
		},
	}
}

func TestGenerateAndValidateToken(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	userID := uuid.New()
	token, err := service.generateToken(userID)
	if err != nil {
		t.Fatalf("generateToken() error = %v", err)
	}

	got, err := service.ValidateToken(token)
	if err != nil {
		t.Fatalf("ValidateToken() error = %v", err)
	}
	if got != userID {
		t.Fatalf("ValidateToken() = %v, want %v", got, userID)
	}
}

func TestValidateToken_Invalid(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	_, err := service.ValidateToken("not-a-jwt")
	if err == nil {
		t.Fatal("ValidateToken() expected error, got nil")
	}

	// Token signed with a different secret should fail
	other := &config.Config{
		JWT: config.JWTConfig{
			Secret:     "other-secret",
			ExpireHour: 1,
		},
	}
	otherService := NewAuthService(other, mockRepo, nil)
	userID := uuid.New()
	token, err := otherService.generateToken(userID)
	if err != nil {
		t.Fatalf("generateToken() error = %v", err)
	}

	if _, err := service.ValidateToken(token); err == nil {
		t.Fatal("ValidateToken() expected error with mismatched secret, got nil")
	}
}

func TestRegister_PendingApproval(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	req := &models.RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
		Name:     "Test User",
	}

	resp, err := service.Register(context.Background(), req)

	// Registration should return ErrUserPending and no token
	if err != ErrUserPending {
		t.Fatalf("Register() error = %v, want ErrUserPending", err)
	}
	if resp != nil {
		t.Fatal("Register() should return nil response for pending users")
	}

	// Verify user was created with pending status
	createdUser := mockRepo.UsersByEmail["test@example.com"]
	if createdUser == nil {
		t.Fatal("Register() did not create user in repository")
	}
	if createdUser.Status != models.UserStatusPending {
		t.Fatalf("Register() user status = %v, want %v", createdUser.Status, models.UserStatusPending)
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	// Add existing user
	existingEmail := "existing@example.com"
	existingUser := &models.User{
		ID:    uuid.New(),
		Email: &existingEmail,
		Name:  "Existing User",
	}
	mockRepo.AddUser(existingUser)

	req := &models.RegisterRequest{
		Email:    "existing@example.com",
		Password: "password123",
		Name:     "New User",
	}

	_, err := service.Register(context.Background(), req)
	if err == nil {
		t.Fatal("Register() expected error for duplicate email, got nil")
	}
	if err.Error() != "user with this email already exists" {
		t.Fatalf("Register() error = %v, want 'user with this email already exists'", err)
	}
}

func TestLogin_Success(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	// Create hashed password
	password := "password123"
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	// Add user with hashed password and active status
	email := "test@example.com"
	user := &models.User{
		ID:           uuid.New(),
		Email:        &email,
		PasswordHash: string(hashedPassword),
		Name:         "Test User",
		AuthProvider: "local",
		Status:       models.UserStatusActive,
	}
	mockRepo.AddUser(user)

	req := &models.LoginRequest{
		Email:    "test@example.com",
		Password: password,
	}

	resp, err := service.Login(context.Background(), req)
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}

	if resp.Token == "" {
		t.Fatal("Login() returned empty token")
	}
	if resp.User.Email == nil || *resp.User.Email != *user.Email {
		t.Fatalf("Login() user email = %v, want %v", resp.User.Email, user.Email)
	}
}

func TestLogin_PendingUser(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	// Create hashed password
	password := "password123"
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	// Add user with pending status
	email := "pending@example.com"
	user := &models.User{
		ID:           uuid.New(),
		Email:        &email,
		PasswordHash: string(hashedPassword),
		Name:         "Pending User",
		AuthProvider: "local",
		Status:       models.UserStatusPending,
	}
	mockRepo.AddUser(user)

	req := &models.LoginRequest{
		Email:    "pending@example.com",
		Password: password,
	}

	_, err := service.Login(context.Background(), req)
	if err != ErrUserPending {
		t.Fatalf("Login() error = %v, want ErrUserPending", err)
	}
}

func TestLogin_DisabledUser(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	// Create hashed password
	password := "password123"
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	// Add user with disabled status
	email := "disabled@example.com"
	user := &models.User{
		ID:           uuid.New(),
		Email:        &email,
		PasswordHash: string(hashedPassword),
		Name:         "Disabled User",
		AuthProvider: "local",
		Status:       models.UserStatusDisabled,
	}
	mockRepo.AddUser(user)

	req := &models.LoginRequest{
		Email:    "disabled@example.com",
		Password: password,
	}

	_, err := service.Login(context.Background(), req)
	if err != ErrUserDisabled {
		t.Fatalf("Login() error = %v, want ErrUserDisabled", err)
	}
}

func TestLogin_InvalidEmail(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	req := &models.LoginRequest{
		Email:    "nonexistent@example.com",
		Password: "password123",
	}

	_, err := service.Login(context.Background(), req)
	if err == nil {
		t.Fatal("Login() expected error for invalid email, got nil")
	}
	if err.Error() != "invalid credentials" {
		t.Fatalf("Login() error = %v, want 'invalid credentials'", err)
	}
}

func TestLogin_InvalidPassword(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	// Create hashed password
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("correctpassword"), bcrypt.DefaultCost)

	email := "test@example.com"
	user := &models.User{
		ID:           uuid.New(),
		Email:        &email,
		PasswordHash: string(hashedPassword),
		Name:         "Test User",
		AuthProvider: "local",
	}
	mockRepo.AddUser(user)

	req := &models.LoginRequest{
		Email:    "test@example.com",
		Password: "wrongpassword",
	}

	_, err := service.Login(context.Background(), req)
	if err == nil {
		t.Fatal("Login() expected error for invalid password, got nil")
	}
	if err.Error() != "invalid credentials" {
		t.Fatalf("Login() error = %v, want 'invalid credentials'", err)
	}
}

func TestGetUserByID_Success(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	email := "test@example.com"
	user := &models.User{
		ID:    uuid.New(),
		Email: &email,
		Name:  "Test User",
	}
	mockRepo.Users[user.ID] = user

	got, err := service.GetUserByID(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("GetUserByID() error = %v", err)
	}
	if got.ID != user.ID {
		t.Fatalf("GetUserByID() ID = %v, want %v", got.ID, user.ID)
	}
}

func TestGetUserByID_NotFound(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	_, err := service.GetUserByID(context.Background(), uuid.New())
	if err == nil {
		t.Fatal("GetUserByID() expected error for non-existent user, got nil")
	}
}

func TestFindOrCreateGoogleUser_ExistingActiveUser(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	googleID := "google-123"
	email := "test@example.com"
	user := &models.User{
		ID:           uuid.New(),
		Email:        &email,
		Name:         "Test User",
		AuthProvider: "google",
		Status:       models.UserStatusActive,
	}
	mockRepo.Users[user.ID] = user
	mockRepo.UsersByGoogle[googleID] = user

	resp, err := service.FindOrCreateGoogleUser(context.Background(), googleID, "test@example.com", "Test User")
	if err != nil {
		t.Fatalf("FindOrCreateGoogleUser() error = %v", err)
	}

	if resp.Token == "" {
		t.Fatal("FindOrCreateGoogleUser() returned empty token")
	}
	if resp.User.ID != user.ID {
		t.Fatalf("FindOrCreateGoogleUser() should return existing user")
	}
}

func TestFindOrCreateGoogleUser_ExistingPendingUser(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	googleID := "google-pending-123"
	email := "pending@example.com"
	user := &models.User{
		ID:           uuid.New(),
		Email:        &email,
		Name:         "Pending User",
		AuthProvider: "google",
		Status:       models.UserStatusPending,
	}
	mockRepo.Users[user.ID] = user
	mockRepo.UsersByGoogle[googleID] = user

	_, err := service.FindOrCreateGoogleUser(context.Background(), googleID, email, "Pending User")
	if err != ErrUserPending {
		t.Fatalf("FindOrCreateGoogleUser() error = %v, want ErrUserPending", err)
	}
}

func TestFindOrCreateGoogleUser_NewUser(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	googleID := "google-new-123"
	email := "newuser@example.com"
	name := "New User"

	// New user should return ErrUserPending (pending approval)
	resp, err := service.FindOrCreateGoogleUser(context.Background(), googleID, email, name)
	if err != ErrUserPending {
		t.Fatalf("FindOrCreateGoogleUser() error = %v, want ErrUserPending", err)
	}
	if resp != nil {
		t.Fatal("FindOrCreateGoogleUser() should return nil response for new pending users")
	}

	// Verify user was created with pending status
	createdUser := mockRepo.UsersByGoogle[googleID]
	if createdUser == nil {
		t.Fatal("FindOrCreateGoogleUser() did not create user in repository")
	}
	if createdUser.Status != models.UserStatusPending {
		t.Fatalf("FindOrCreateGoogleUser() user status = %v, want %v", createdUser.Status, models.UserStatusPending)
	}
}
