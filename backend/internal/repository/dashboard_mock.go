package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
)

// MockDashboardRepository is a mock implementation of DashboardRepository for testing
type MockDashboardRepository struct {
	Dashboards map[uuid.UUID]*models.Dashboard
	Widgets    map[uuid.UUID]*models.Widget

	// Error simulation
	GetAllError  error
	GetByIDError error
	CreateError  error
	UpdateError  error
	DeleteError  error
}

// NewMockDashboardRepository creates a new MockDashboardRepository
func NewMockDashboardRepository() *MockDashboardRepository {
	return &MockDashboardRepository{
		Dashboards: make(map[uuid.UUID]*models.Dashboard),
		Widgets:    make(map[uuid.UUID]*models.Widget),
	}
}

func (m *MockDashboardRepository) GetAll(ctx context.Context, userID uuid.UUID) ([]models.Dashboard, error) {
	if m.GetAllError != nil {
		return nil, m.GetAllError
	}

	var result []models.Dashboard
	for _, d := range m.Dashboards {
		if d.UserID == userID {
			result = append(result, *d)
		}
	}
	return result, nil
}

func (m *MockDashboardRepository) GetByID(ctx context.Context, id, userID uuid.UUID) (*models.Dashboard, error) {
	if m.GetByIDError != nil {
		return nil, m.GetByIDError
	}

	if d, ok := m.Dashboards[id]; ok && d.UserID == userID {
		// Add widgets
		var widgets []models.Widget
		for _, w := range m.Widgets {
			if w.DashboardID == id {
				widgets = append(widgets, *w)
			}
		}
		d.Widgets = widgets
		return d, nil
	}
	return nil, ErrNotFound
}

func (m *MockDashboardRepository) Create(ctx context.Context, userID uuid.UUID, name, description string) (*models.Dashboard, error) {
	if m.CreateError != nil {
		return nil, m.CreateError
	}

	var desc *string
	if description != "" {
		desc = &description
	}
	d := &models.Dashboard{
		ID:          uuid.New(),
		UserID:      userID,
		Name:        name,
		Description: desc,
		Layout:      []byte("[]"),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	m.Dashboards[d.ID] = d
	return d, nil
}

func (m *MockDashboardRepository) Update(ctx context.Context, id, userID uuid.UUID, name, description string, layout []byte) (*models.Dashboard, error) {
	if m.UpdateError != nil {
		return nil, m.UpdateError
	}

	if d, ok := m.Dashboards[id]; ok && d.UserID == userID {
		if name != "" {
			d.Name = name
		}
		if description != "" {
			d.Description = &description
		}
		if layout != nil {
			d.Layout = layout
		}
		d.UpdatedAt = time.Now()
		return d, nil
	}
	return nil, ErrNotFound
}

func (m *MockDashboardRepository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	if m.DeleteError != nil {
		return m.DeleteError
	}

	if d, ok := m.Dashboards[id]; ok && d.UserID == userID {
		delete(m.Dashboards, id)
		// Delete associated widgets
		for wid, w := range m.Widgets {
			if w.DashboardID == id {
				delete(m.Widgets, wid)
			}
		}
		return nil
	}
	return ErrNotFound
}

// AddDashboard adds a dashboard to the mock repository (helper for tests)
func (m *MockDashboardRepository) AddDashboard(d *models.Dashboard) {
	m.Dashboards[d.ID] = d
}

// MockWidgetRepository is a mock implementation of WidgetRepository for testing
type MockWidgetRepository struct {
	Widgets    map[uuid.UUID]*models.Widget
	Dashboards map[uuid.UUID]*models.Dashboard // For ownership checks

	// Error simulation
	GetByDashboardIDError error
	CreateError           error
	UpdateError           error
	DeleteError           error
}

// NewMockWidgetRepository creates a new MockWidgetRepository
func NewMockWidgetRepository() *MockWidgetRepository {
	return &MockWidgetRepository{
		Widgets:    make(map[uuid.UUID]*models.Widget),
		Dashboards: make(map[uuid.UUID]*models.Dashboard),
	}
}

func (m *MockWidgetRepository) GetByDashboardID(ctx context.Context, dashboardID uuid.UUID) ([]models.Widget, error) {
	if m.GetByDashboardIDError != nil {
		return nil, m.GetByDashboardIDError
	}

	var result []models.Widget
	for _, w := range m.Widgets {
		if w.DashboardID == dashboardID {
			result = append(result, *w)
		}
	}
	return result, nil
}

func (m *MockWidgetRepository) Create(ctx context.Context, dashboardID, userID uuid.UUID, name string, queryID *uuid.UUID, chartType string, chartConfig, position []byte) (*models.Widget, error) {
	if m.CreateError != nil {
		return nil, m.CreateError
	}

	// Check dashboard ownership
	if d, ok := m.Dashboards[dashboardID]; !ok || d.UserID != userID {
		return nil, ErrNotFound
	}

	w := &models.Widget{
		ID:          uuid.New(),
		DashboardID: dashboardID,
		Name:        name,
		QueryID:     queryID,
		ChartType:   chartType,
		ChartConfig: chartConfig,
		Position:    position,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	m.Widgets[w.ID] = w
	return w, nil
}

func (m *MockWidgetRepository) Update(ctx context.Context, id, dashboardID, userID uuid.UUID, name string, queryID *uuid.UUID, chartType string, chartConfig, position []byte) (*models.Widget, error) {
	if m.UpdateError != nil {
		return nil, m.UpdateError
	}

	// Check dashboard ownership
	if d, ok := m.Dashboards[dashboardID]; !ok || d.UserID != userID {
		return nil, ErrNotFound
	}

	if w, ok := m.Widgets[id]; ok && w.DashboardID == dashboardID {
		if name != "" {
			w.Name = name
		}
		if queryID != nil {
			w.QueryID = queryID
		}
		if chartType != "" {
			w.ChartType = chartType
		}
		if chartConfig != nil {
			w.ChartConfig = chartConfig
		}
		if position != nil {
			w.Position = position
		}
		w.UpdatedAt = time.Now()
		return w, nil
	}
	return nil, ErrNotFound
}

func (m *MockWidgetRepository) Delete(ctx context.Context, id, dashboardID, userID uuid.UUID) error {
	if m.DeleteError != nil {
		return m.DeleteError
	}

	// Check dashboard ownership
	if d, ok := m.Dashboards[dashboardID]; !ok || d.UserID != userID {
		return ErrNotFound
	}

	if w, ok := m.Widgets[id]; ok && w.DashboardID == dashboardID {
		delete(m.Widgets, id)
		return nil
	}
	return ErrNotFound
}

// AddWidget adds a widget to the mock repository (helper for tests)
func (m *MockWidgetRepository) AddWidget(w *models.Widget) {
	m.Widgets[w.ID] = w
}

// SetDashboard sets a dashboard for ownership checks (helper for tests)
func (m *MockWidgetRepository) SetDashboard(d *models.Dashboard) {
	m.Dashboards[d.ID] = d
}
