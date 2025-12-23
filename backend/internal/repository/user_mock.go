package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
)

// MockUserRepository is a mock implementation of UserRepository for testing
type MockUserRepository struct {
	Users         map[uuid.UUID]*models.User
	UsersByEmail  map[string]*models.User
	UsersByGoogle map[string]*models.User

	// Function hooks for custom behavior
	FindByIDFunc         func(ctx context.Context, id uuid.UUID) (*models.User, error)
	FindByEmailFunc      func(ctx context.Context, email string) (*models.User, error)
	FindByGoogleIDFunc   func(ctx context.Context, googleID string) (*models.User, error)
	ExistsByEmailFunc    func(ctx context.Context, email string) (bool, error)
	CreateFunc           func(ctx context.Context, email, passwordHash, name string) (*models.User, error)
	CreateGoogleUserFunc func(ctx context.Context, email, name, googleID string) (*models.User, error)
}

// NewMockUserRepository creates a new MockUserRepository
func NewMockUserRepository() *MockUserRepository {
	return &MockUserRepository{
		Users:         make(map[uuid.UUID]*models.User),
		UsersByEmail:  make(map[string]*models.User),
		UsersByGoogle: make(map[string]*models.User),
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

func (m *MockUserRepository) Create(ctx context.Context, email, passwordHash, name string) (*models.User, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, email, passwordHash, name)
	}
	user := &models.User{
		ID:           uuid.New(),
		Email:        email,
		PasswordHash: passwordHash,
		Name:         name,
		AuthProvider: "local",
	}
	m.Users[user.ID] = user
	m.UsersByEmail[email] = user
	return user, nil
}

func (m *MockUserRepository) CreateGoogleUser(ctx context.Context, email, name, googleID string) (*models.User, error) {
	if m.CreateGoogleUserFunc != nil {
		return m.CreateGoogleUserFunc(ctx, email, name, googleID)
	}
	user := &models.User{
		ID:           uuid.New(),
		Email:        email,
		Name:         name,
		AuthProvider: "google",
	}
	m.Users[user.ID] = user
	m.UsersByEmail[email] = user
	m.UsersByGoogle[googleID] = user
	return user, nil
}

// AddUser adds a user to the mock repository (helper for tests)
func (m *MockUserRepository) AddUser(user *models.User) {
	m.Users[user.ID] = user
	m.UsersByEmail[user.Email] = user
}
