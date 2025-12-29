package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
)

// MockUserRepository is a mock implementation of UserRepository for testing
type MockUserRepository struct {
	Users           map[uuid.UUID]*models.User
	UsersByEmail    map[string]*models.User
	UsersByUsername map[string]*models.User
	UsersByGoogle   map[string]*models.User

	// Function hooks for custom behavior
	FindByIDFunc              func(ctx context.Context, id uuid.UUID) (*models.User, error)
	FindByEmailFunc           func(ctx context.Context, email string) (*models.User, error)
	FindByUsernameFunc        func(ctx context.Context, username string) (*models.User, error)
	FindByEmailOrUsernameFunc func(ctx context.Context, identifier string) (*models.User, error)
	FindByGoogleIDFunc        func(ctx context.Context, googleID string) (*models.User, error)
	ExistsByEmailFunc         func(ctx context.Context, email string) (bool, error)
	ExistsByUsernameFunc      func(ctx context.Context, username string) (bool, error)
	CreateFunc                func(ctx context.Context, email, passwordHash, name string) (*models.User, error)
	CreateAdminUserFunc       func(ctx context.Context, username, passwordHash, name string) (*models.User, error)
	CreateGoogleUserFunc      func(ctx context.Context, email, name, googleID string) (*models.User, error)
	UpdateStatusFunc          func(ctx context.Context, userID uuid.UUID, status models.UserStatus, approvedBy *uuid.UUID) error
	GetAllByStatusFunc        func(ctx context.Context, status models.UserStatus) ([]models.User, error)
	GetAllFunc                func(ctx context.Context) ([]models.User, error)
}

// NewMockUserRepository creates a new MockUserRepository
func NewMockUserRepository() *MockUserRepository {
	return &MockUserRepository{
		Users:           make(map[uuid.UUID]*models.User),
		UsersByEmail:    make(map[string]*models.User),
		UsersByUsername: make(map[string]*models.User),
		UsersByGoogle:   make(map[string]*models.User),
	}
}

func (m *MockUserRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	if m.FindByIDFunc != nil {
		return m.FindByIDFunc(ctx, id)
	}
	if user, ok := m.Users[id]; ok {
		return user, nil
	}
	return nil, ErrNotFound
}

func (m *MockUserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	if m.FindByEmailFunc != nil {
		return m.FindByEmailFunc(ctx, email)
	}
	if user, ok := m.UsersByEmail[email]; ok {
		return user, nil
	}
	return nil, ErrNotFound
}

func (m *MockUserRepository) FindByUsername(ctx context.Context, username string) (*models.User, error) {
	if m.FindByUsernameFunc != nil {
		return m.FindByUsernameFunc(ctx, username)
	}
	if user, ok := m.UsersByUsername[username]; ok {
		return user, nil
	}
	return nil, ErrNotFound
}

func (m *MockUserRepository) FindByEmailOrUsername(ctx context.Context, identifier string) (*models.User, error) {
	if m.FindByEmailOrUsernameFunc != nil {
		return m.FindByEmailOrUsernameFunc(ctx, identifier)
	}
	if user, ok := m.UsersByEmail[identifier]; ok {
		return user, nil
	}
	if user, ok := m.UsersByUsername[identifier]; ok {
		return user, nil
	}
	return nil, ErrNotFound
}

func (m *MockUserRepository) FindByGoogleID(ctx context.Context, googleID string) (*models.User, error) {
	if m.FindByGoogleIDFunc != nil {
		return m.FindByGoogleIDFunc(ctx, googleID)
	}
	if user, ok := m.UsersByGoogle[googleID]; ok {
		return user, nil
	}
	return nil, ErrNotFound
}

func (m *MockUserRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	if m.ExistsByEmailFunc != nil {
		return m.ExistsByEmailFunc(ctx, email)
	}
	_, ok := m.UsersByEmail[email]
	return ok, nil
}

func (m *MockUserRepository) ExistsByUsername(ctx context.Context, username string) (bool, error) {
	if m.ExistsByUsernameFunc != nil {
		return m.ExistsByUsernameFunc(ctx, username)
	}
	_, ok := m.UsersByUsername[username]
	return ok, nil
}

func (m *MockUserRepository) Create(ctx context.Context, email, passwordHash, name string) (*models.User, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, email, passwordHash, name)
	}
	user := &models.User{
		ID:           uuid.New(),
		Email:        &email,
		PasswordHash: passwordHash,
		Name:         name,
		AuthProvider: "local",
		Status:       models.UserStatusPending,
	}
	m.Users[user.ID] = user
	m.UsersByEmail[email] = user
	return user, nil
}

func (m *MockUserRepository) CreateAdminUser(ctx context.Context, username, passwordHash, name string) (*models.User, error) {
	if m.CreateAdminUserFunc != nil {
		return m.CreateAdminUserFunc(ctx, username, passwordHash, name)
	}
	user := &models.User{
		ID:           uuid.New(),
		Username:     &username,
		PasswordHash: passwordHash,
		Name:         name,
		AuthProvider: "local",
		Status:       models.UserStatusActive,
	}
	m.Users[user.ID] = user
	m.UsersByUsername[username] = user
	return user, nil
}

func (m *MockUserRepository) CreateGoogleUser(ctx context.Context, email, name, googleID string) (*models.User, error) {
	if m.CreateGoogleUserFunc != nil {
		return m.CreateGoogleUserFunc(ctx, email, name, googleID)
	}
	user := &models.User{
		ID:           uuid.New(),
		Email:        &email,
		Name:         name,
		AuthProvider: "google",
		Status:       models.UserStatusPending,
	}
	m.Users[user.ID] = user
	m.UsersByEmail[email] = user
	m.UsersByGoogle[googleID] = user
	return user, nil
}

func (m *MockUserRepository) UpdateStatus(ctx context.Context, userID uuid.UUID, status models.UserStatus, approvedBy *uuid.UUID) error {
	if m.UpdateStatusFunc != nil {
		return m.UpdateStatusFunc(ctx, userID, status, approvedBy)
	}
	user, ok := m.Users[userID]
	if !ok {
		return ErrNotFound
	}
	user.Status = status
	user.ApprovedBy = approvedBy
	return nil
}

func (m *MockUserRepository) GetAllByStatus(ctx context.Context, status models.UserStatus) ([]models.User, error) {
	if m.GetAllByStatusFunc != nil {
		return m.GetAllByStatusFunc(ctx, status)
	}
	var users []models.User
	for _, user := range m.Users {
		if user.Status == status {
			users = append(users, *user)
		}
	}
	return users, nil
}

func (m *MockUserRepository) GetAll(ctx context.Context) ([]models.User, error) {
	if m.GetAllFunc != nil {
		return m.GetAllFunc(ctx)
	}
	var users []models.User
	for _, user := range m.Users {
		users = append(users, *user)
	}
	return users, nil
}

// AddUser adds a user to the mock repository (helper for tests)
func (m *MockUserRepository) AddUser(user *models.User) {
	m.Users[user.ID] = user
	if user.Email != nil {
		m.UsersByEmail[*user.Email] = user
	}
	if user.Username != nil {
		m.UsersByUsername[*user.Username] = user
	}
}
