package models

import (
	"time"

	"github.com/google/uuid"
)

type SavedQuery struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	QueryText   string    `json:"query_text"`
	Catalog     *string   `json:"catalog,omitempty"`
	SchemaName  *string   `json:"schema_name,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type QueryHistory struct {
	ID              uuid.UUID `json:"id"`
	UserID          uuid.UUID `json:"user_id"`
	QueryText       string    `json:"query_text"`
	Status          string    `json:"status"`
	ExecutionTimeMs *int      `json:"execution_time_ms"`
	RowCount        *int      `json:"row_count"`
	ErrorMessage    *string   `json:"error_message"`
	ExecutedAt      time.Time `json:"executed_at"`
}

type ExecuteQueryRequest struct {
	Query   string `json:"query" binding:"required"`
	Catalog string `json:"catalog"`
	Schema  string `json:"schema"`
}

type QueryResult struct {
	Columns []string        `json:"columns"`
	Rows    [][]interface{} `json:"rows"`
	RowCount int            `json:"row_count"`
	ExecutionTimeMs int64   `json:"execution_time_ms"`
}

type SaveQueryRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	QueryText   string  `json:"query_text" binding:"required"`
	Catalog     *string `json:"catalog"`
	SchemaName  *string `json:"schema_name"`
}

type UpdateQueryRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	QueryText   string  `json:"query_text"`
	Catalog     *string `json:"catalog"`
	SchemaName  *string `json:"schema_name"`
}

// WidgetDataResponse represents the result of executing a widget's query
type WidgetDataResponse struct {
	WidgetID        uuid.UUID       `json:"widget_id"`
	QueryResult     *QueryResult    `json:"query_result,omitempty"`
	Error           string          `json:"error,omitempty"`
}
