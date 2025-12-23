package repository

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
)

func TestMockDashboardRepository_CRUD(t *testing.T) {
	ctx := context.Background()
	repo := NewMockDashboardRepository()
	userID := uuid.New()

	var dashboardID uuid.UUID

	// Test Create
	t.Run("Create", func(t *testing.T) {
		dashboard, err := repo.Create(ctx, userID, "Test Dashboard", "A test dashboard")
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if dashboard.Name != "Test Dashboard" {
			t.Fatalf("Create() name = %v, want 'Test Dashboard'", dashboard.Name)
		}
		if dashboard.UserID != userID {
			t.Fatalf("Create() userID = %v, want %v", dashboard.UserID, userID)
		}
		dashboardID = dashboard.ID
	})

	// Test GetAll
	t.Run("GetAll", func(t *testing.T) {
		dashboards, err := repo.GetAll(ctx, userID)
		if err != nil {
			t.Fatalf("GetAll() error = %v", err)
		}
		if len(dashboards) != 1 {
			t.Fatalf("GetAll() count = %v, want 1", len(dashboards))
		}
	})

	// Test GetByID
	t.Run("GetByID", func(t *testing.T) {
		dashboard, err := repo.GetByID(ctx, dashboardID, userID)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if dashboard.ID != dashboardID {
			t.Fatalf("GetByID() id = %v, want %v", dashboard.ID, dashboardID)
		}
	})

	// Test GetByID - not found
	t.Run("GetByID_NotFound", func(t *testing.T) {
		_, err := repo.GetByID(ctx, uuid.New(), userID)
		if err != ErrNotFound {
			t.Fatalf("GetByID() error = %v, want ErrNotFound", err)
		}
	})

	// Test Update
	t.Run("Update", func(t *testing.T) {
		dashboard, err := repo.Update(ctx, dashboardID, userID, "Updated Dashboard", "", nil)
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if dashboard.Name != "Updated Dashboard" {
			t.Fatalf("Update() name = %v, want 'Updated Dashboard'", dashboard.Name)
		}
	})

	// Test Delete
	t.Run("Delete", func(t *testing.T) {
		err := repo.Delete(ctx, dashboardID, userID)
		if err != nil {
			t.Fatalf("Delete() error = %v", err)
		}

		// Verify deleted
		_, err = repo.GetByID(ctx, dashboardID, userID)
		if err != ErrNotFound {
			t.Fatalf("After Delete, GetByID() error = %v, want ErrNotFound", err)
		}
	})
}

func TestMockWidgetRepository_CRUD(t *testing.T) {
	ctx := context.Background()
	repo := NewMockWidgetRepository()
	userID := uuid.New()

	// Create a dashboard first
	dashboard := &models.Dashboard{
		ID:     uuid.New(),
		UserID: userID,
		Name:   "Test Dashboard",
	}
	repo.SetDashboard(dashboard)

	var widgetID uuid.UUID

	// Test Create
	t.Run("Create", func(t *testing.T) {
		widget, err := repo.Create(ctx, dashboard.ID, userID, "Test Widget", nil, "bar", []byte("{}"), []byte("{}"))
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if widget.Name != "Test Widget" {
			t.Fatalf("Create() name = %v, want 'Test Widget'", widget.Name)
		}
		widgetID = widget.ID
	})

	// Test Create - wrong user
	t.Run("Create_WrongUser", func(t *testing.T) {
		_, err := repo.Create(ctx, dashboard.ID, uuid.New(), "Widget", nil, "bar", []byte("{}"), []byte("{}"))
		if err != ErrNotFound {
			t.Fatalf("Create() error = %v, want ErrNotFound", err)
		}
	})

	// Test GetByDashboardID
	t.Run("GetByDashboardID", func(t *testing.T) {
		widgets, err := repo.GetByDashboardID(ctx, dashboard.ID)
		if err != nil {
			t.Fatalf("GetByDashboardID() error = %v", err)
		}
		if len(widgets) != 1 {
			t.Fatalf("GetByDashboardID() count = %v, want 1", len(widgets))
		}
	})

	// Test Update
	t.Run("Update", func(t *testing.T) {
		widget, err := repo.Update(ctx, widgetID, dashboard.ID, userID, "Updated Widget", nil, "", nil, nil)
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if widget.Name != "Updated Widget" {
			t.Fatalf("Update() name = %v, want 'Updated Widget'", widget.Name)
		}
	})

	// Test Delete
	t.Run("Delete", func(t *testing.T) {
		err := repo.Delete(ctx, widgetID, dashboard.ID, userID)
		if err != nil {
			t.Fatalf("Delete() error = %v", err)
		}

		widgets, _ := repo.GetByDashboardID(ctx, dashboard.ID)
		if len(widgets) != 0 {
			t.Fatalf("After Delete, GetByDashboardID() count = %v, want 0", len(widgets))
		}
	})
}
