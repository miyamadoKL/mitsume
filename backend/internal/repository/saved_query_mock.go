package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
)

// MockSavedQueryRepository is a mock implementation of SavedQueryRepository for testing
type MockSavedQueryRepository struct {
	Queries map[uuid.UUID]*models.SavedQuery

	// Error simulation
	GetAllError  error
	GetByIDError error
	CreateError  error
	UpdateError  error
	DeleteError  error
}

// NewMockSavedQueryRepository creates a new MockSavedQueryRepository
func NewMockSavedQueryRepository() *MockSavedQueryRepository {
	return &MockSavedQueryRepository{
		Queries: make(map[uuid.UUID]*models.SavedQuery),
	}
}

func (m *MockSavedQueryRepository) GetAll(ctx context.Context, userID uuid.UUID) ([]models.SavedQuery, error) {
	if m.GetAllError != nil {
		return nil, m.GetAllError
	}

	var result []models.SavedQuery
	for _, q := range m.Queries {
		if q.UserID == userID {
			result = append(result, *q)
		}
	}
	return result, nil
}

func (m *MockSavedQueryRepository) GetByID(ctx context.Context, id, userID uuid.UUID) (*models.SavedQuery, error) {
	if m.GetByIDError != nil {
		return nil, m.GetByIDError
	}

	if q, ok := m.Queries[id]; ok && q.UserID == userID {
		return q, nil
	}
	return nil, ErrNotFound
}

func (m *MockSavedQueryRepository) Create(ctx context.Context, userID uuid.UUID, req *models.SaveQueryRequest) (*models.SavedQuery, error) {
	if m.CreateError != nil {
		return nil, m.CreateError
	}

	q := &models.SavedQuery{
		ID:          uuid.New(),
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		QueryText:   req.QueryText,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	m.Queries[q.ID] = q
	return q, nil
}

func (m *MockSavedQueryRepository) Update(ctx context.Context, id, userID uuid.UUID, req *models.UpdateQueryRequest) (*models.SavedQuery, error) {
	if m.UpdateError != nil {
		return nil, m.UpdateError
	}

	if q, ok := m.Queries[id]; ok && q.UserID == userID {
		if req.Name != "" {
			q.Name = req.Name
		}
		if req.Description != nil {
			q.Description = req.Description
		}
		if req.QueryText != "" {
			q.QueryText = req.QueryText
		}
		q.UpdatedAt = time.Now()
		return q, nil
	}
	return nil, ErrNotFound
}

func (m *MockSavedQueryRepository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	if m.DeleteError != nil {
		return m.DeleteError
	}

	if q, ok := m.Queries[id]; ok && q.UserID == userID {
		delete(m.Queries, id)
		return nil
	}
	return ErrNotFound
}

// AddQuery adds a query to the mock repository (helper for tests)
func (m *MockSavedQueryRepository) AddQuery(q *models.SavedQuery) {
	m.Queries[q.ID] = q
}
