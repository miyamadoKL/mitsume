package repository

import (
	"context"

	"github.com/google/uuid"
)

// MockQueryHistoryRecorder is a mock implementation of QueryHistoryRecorder for testing
type MockQueryHistoryRecorder struct {
	// Recorded calls
	SavedHistories []SavedHistoryCall

	// Error simulation
	SaveError error

	// Function hook for custom behavior
	SaveQueryHistoryFunc func(ctx context.Context, userID uuid.UUID, queryText, status string, executionTimeMs int64, rowCount int, errorMsg *string) error
}

// SavedHistoryCall records a call to SaveQueryHistory
type SavedHistoryCall struct {
	UserID          uuid.UUID
	QueryText       string
	Status          string
	ExecutionTimeMs int64
	RowCount        int
	ErrorMsg        *string
}

// NewMockQueryHistoryRecorder creates a new MockQueryHistoryRecorder
func NewMockQueryHistoryRecorder() *MockQueryHistoryRecorder {
	return &MockQueryHistoryRecorder{
		SavedHistories: []SavedHistoryCall{},
	}
}

func (m *MockQueryHistoryRecorder) SaveQueryHistory(ctx context.Context, userID uuid.UUID, queryText, status string, executionTimeMs int64, rowCount int, errorMsg *string) error {
	// Track the call
	m.SavedHistories = append(m.SavedHistories, SavedHistoryCall{
		UserID:          userID,
		QueryText:       queryText,
		Status:          status,
		ExecutionTimeMs: executionTimeMs,
		RowCount:        rowCount,
		ErrorMsg:        errorMsg,
	})

	if m.SaveQueryHistoryFunc != nil {
		return m.SaveQueryHistoryFunc(ctx, userID, queryText, status, executionTimeMs, rowCount, errorMsg)
	}

	return m.SaveError
}
