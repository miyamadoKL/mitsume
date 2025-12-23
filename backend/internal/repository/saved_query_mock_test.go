package repository

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
)

func TestMockSavedQueryRepository_CRUD(t *testing.T) {
	ctx := context.Background()
	repo := NewMockSavedQueryRepository()
	userID := uuid.New()

	// Test Create
	t.Run("Create", func(t *testing.T) {
		desc := "A test query"
		req := &models.SaveQueryRequest{
			Name:        "Test Query",
			Description: &desc,
			QueryText:   "SELECT 1",
		}

		query, err := repo.Create(ctx, userID, req)
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if query.Name != req.Name {
			t.Fatalf("Create() name = %v, want %v", query.Name, req.Name)
		}
		if query.UserID != userID {
			t.Fatalf("Create() userID = %v, want %v", query.UserID, userID)
		}
	})

	// Test GetAll
	t.Run("GetAll", func(t *testing.T) {
		queries, err := repo.GetAll(ctx, userID)
		if err != nil {
			t.Fatalf("GetAll() error = %v", err)
		}
		if len(queries) != 1 {
			t.Fatalf("GetAll() count = %v, want 1", len(queries))
		}
	})

	// Test GetByID
	t.Run("GetByID", func(t *testing.T) {
		queries, _ := repo.GetAll(ctx, userID)
		queryID := queries[0].ID

		query, err := repo.GetByID(ctx, queryID, userID)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if query.ID != queryID {
			t.Fatalf("GetByID() id = %v, want %v", query.ID, queryID)
		}
	})

	// Test GetByID - not found
	t.Run("GetByID_NotFound", func(t *testing.T) {
		_, err := repo.GetByID(ctx, uuid.New(), userID)
		if err != ErrNotFound {
			t.Fatalf("GetByID() error = %v, want ErrNotFound", err)
		}
	})

	// Test GetByID - wrong user
	t.Run("GetByID_WrongUser", func(t *testing.T) {
		queries, _ := repo.GetAll(ctx, userID)
		queryID := queries[0].ID

		_, err := repo.GetByID(ctx, queryID, uuid.New())
		if err != ErrNotFound {
			t.Fatalf("GetByID() error = %v, want ErrNotFound", err)
		}
	})

	// Test Update
	t.Run("Update", func(t *testing.T) {
		queries, _ := repo.GetAll(ctx, userID)
		queryID := queries[0].ID

		req := &models.UpdateQueryRequest{
			Name:      "Updated Query",
			QueryText: "SELECT 2",
		}

		query, err := repo.Update(ctx, queryID, userID, req)
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if query.Name != req.Name {
			t.Fatalf("Update() name = %v, want %v", query.Name, req.Name)
		}
	})

	// Test Delete
	t.Run("Delete", func(t *testing.T) {
		queries, _ := repo.GetAll(ctx, userID)
		queryID := queries[0].ID

		err := repo.Delete(ctx, queryID, userID)
		if err != nil {
			t.Fatalf("Delete() error = %v", err)
		}

		// Verify deleted
		_, err = repo.GetByID(ctx, queryID, userID)
		if err != ErrNotFound {
			t.Fatalf("After Delete, GetByID() error = %v, want ErrNotFound", err)
		}
	})

	// Test Delete - not found
	t.Run("Delete_NotFound", func(t *testing.T) {
		err := repo.Delete(ctx, uuid.New(), userID)
		if err != ErrNotFound {
			t.Fatalf("Delete() error = %v, want ErrNotFound", err)
		}
	})
}

func TestMockSavedQueryRepository_ErrorSimulation(t *testing.T) {
	ctx := context.Background()
	repo := NewMockSavedQueryRepository()
	userID := uuid.New()

	t.Run("GetAll_Error", func(t *testing.T) {
		repo.GetAllError = ErrNotFound
		defer func() { repo.GetAllError = nil }()

		_, err := repo.GetAll(ctx, userID)
		if err != ErrNotFound {
			t.Fatalf("GetAll() error = %v, want ErrNotFound", err)
		}
	})

	t.Run("Create_Error", func(t *testing.T) {
		repo.CreateError = ErrNotFound
		defer func() { repo.CreateError = nil }()

		_, err := repo.Create(ctx, userID, &models.SaveQueryRequest{Name: "Test"})
		if err != ErrNotFound {
			t.Fatalf("Create() error = %v, want ErrNotFound", err)
		}
	})
}
