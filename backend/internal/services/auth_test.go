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

func TestRegister_Success(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	req := &models.RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
		Name:     "Test User",
	}

	resp, err := service.Register(context.Background(), req)
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	if resp.Token == "" {
		t.Fatal("Register() returned empty token")
	}
	if resp.User.Email != req.Email {
		t.Fatalf("Register() user email = %v, want %v", resp.User.Email, req.Email)
	}
	if resp.User.Name != req.Name {
		t.Fatalf("Register() user name = %v, want %v", resp.User.Name, req.Name)
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	// Add existing user
	existingUser := &models.User{
		ID:    uuid.New(),
		Email: "existing@example.com",
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

	// Add user with hashed password
	user := &models.User{
		ID:           uuid.New(),
		Email:        "test@example.com",
		PasswordHash: string(hashedPassword),
		Name:         "Test User",
		AuthProvider: "local",
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
	if resp.User.Email != user.Email {
		t.Fatalf("Login() user email = %v, want %v", resp.User.Email, user.Email)
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
	if err.Error() != "invalid email or password" {
		t.Fatalf("Login() error = %v, want 'invalid email or password'", err)
	}
}

func TestLogin_InvalidPassword(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	// Create hashed password
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("correctpassword"), bcrypt.DefaultCost)

	user := &models.User{
		ID:           uuid.New(),
		Email:        "test@example.com",
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
	if err.Error() != "invalid email or password" {
		t.Fatalf("Login() error = %v, want 'invalid email or password'", err)
	}
}

func TestGetUserByID_Success(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	user := &models.User{
		ID:    uuid.New(),
		Email: "test@example.com",
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

func TestFindOrCreateGoogleUser_ExistingUser(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	googleID := "google-123"
	user := &models.User{
		ID:           uuid.New(),
		Email:        "test@example.com",
		Name:         "Test User",
		AuthProvider: "google",
	}
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

func TestFindOrCreateGoogleUser_NewUser(t *testing.T) {
	cfg := newTestConfig()
	mockRepo := repository.NewMockUserRepository()
	service := NewAuthService(cfg, mockRepo, nil)

	googleID := "google-new-123"
	email := "newuser@example.com"
	name := "New User"

	resp, err := service.FindOrCreateGoogleUser(context.Background(), googleID, email, name)
	if err != nil {
		t.Fatalf("FindOrCreateGoogleUser() error = %v", err)
	}

	if resp.Token == "" {
		t.Fatal("FindOrCreateGoogleUser() returned empty token")
	}
	if resp.User.Email != email {
		t.Fatalf("FindOrCreateGoogleUser() email = %v, want %v", resp.User.Email, email)
	}
	if resp.User.Name != name {
		t.Fatalf("FindOrCreateGoogleUser() name = %v, want %v", resp.User.Name, name)
	}
}
