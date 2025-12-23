package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
)

// MockTrinoExecutor is a mock implementation of TrinoExecutor for testing
type MockTrinoExecutor struct {
	// Predefined responses
	Catalogs []string
	Schemas  map[string][]string          // catalog -> schemas
	Tables   map[string]map[string][]string // catalog -> schema -> tables

	// Query results
	QueryResults map[string]*models.QueryResult // query -> result

	// Error simulation
	ExecuteQueryError error
	GetCatalogsError  error
	GetSchemasError   error
	GetTablesError    error

	// Function hooks for custom behavior
	ExecuteQueryFunc func(ctx context.Context, query, catalog, schema string) (*models.QueryResult, error)
	GetCatalogsFunc  func(ctx context.Context) ([]string, error)
	GetSchemasFunc   func(ctx context.Context, catalog string) ([]string, error)
	GetTablesFunc    func(ctx context.Context, catalog, schema string) ([]string, error)

	// Call tracking
	ExecuteQueryCalls []ExecuteQueryCall
}

// ExecuteQueryCall records a call to ExecuteQuery
type ExecuteQueryCall struct {
	Query   string
	Catalog string
	Schema  string
}

// NewMockTrinoExecutor creates a new MockTrinoExecutor
func NewMockTrinoExecutor() *MockTrinoExecutor {
	return &MockTrinoExecutor{
		Catalogs:     []string{},
		Schemas:      make(map[string][]string),
		Tables:       make(map[string]map[string][]string),
		QueryResults: make(map[string]*models.QueryResult),
	}
}

func (m *MockTrinoExecutor) ExecuteQuery(ctx context.Context, query, catalog, schema string) (*models.QueryResult, error) {
	// Track the call
	m.ExecuteQueryCalls = append(m.ExecuteQueryCalls, ExecuteQueryCall{
		Query:   query,
		Catalog: catalog,
		Schema:  schema,
	})

	if m.ExecuteQueryFunc != nil {
		return m.ExecuteQueryFunc(ctx, query, catalog, schema)
	}

	if m.ExecuteQueryError != nil {
		return nil, m.ExecuteQueryError
	}

	if result, ok := m.QueryResults[query]; ok {
		return result, nil
	}

	// Return empty result by default
	return &models.QueryResult{
		Columns:         []string{},
		Rows:            [][]interface{}{},
		RowCount:        0,
		ExecutionTimeMs: 10,
	}, nil
}

func (m *MockTrinoExecutor) GetCatalogs(ctx context.Context) ([]string, error) {
	if m.GetCatalogsFunc != nil {
		return m.GetCatalogsFunc(ctx)
	}

	if m.GetCatalogsError != nil {
		return nil, m.GetCatalogsError
	}

	return m.Catalogs, nil
}

func (m *MockTrinoExecutor) GetSchemas(ctx context.Context, catalog string) ([]string, error) {
	if m.GetSchemasFunc != nil {
		return m.GetSchemasFunc(ctx, catalog)
	}

	if m.GetSchemasError != nil {
		return nil, m.GetSchemasError
	}

	if schemas, ok := m.Schemas[catalog]; ok {
		return schemas, nil
	}

	return []string{}, nil
}

func (m *MockTrinoExecutor) GetTables(ctx context.Context, catalog, schema string) ([]string, error) {
	if m.GetTablesFunc != nil {
		return m.GetTablesFunc(ctx, catalog, schema)
	}

	if m.GetTablesError != nil {
		return nil, m.GetTablesError
	}

	if catalogSchemas, ok := m.Tables[catalog]; ok {
		if tables, ok := catalogSchemas[schema]; ok {
			return tables, nil
		}
	}

	return []string{}, nil
}

// SetupCatalog adds a catalog with schemas and tables for testing
func (m *MockTrinoExecutor) SetupCatalog(catalog string, schemas map[string][]string) {
	m.Catalogs = append(m.Catalogs, catalog)
	m.Schemas[catalog] = make([]string, 0, len(schemas))
	m.Tables[catalog] = make(map[string][]string)

	for schema, tables := range schemas {
		m.Schemas[catalog] = append(m.Schemas[catalog], schema)
		m.Tables[catalog][schema] = tables
	}
}

// SetQueryResult sets a predefined result for a specific query
func (m *MockTrinoExecutor) SetQueryResult(query string, result *models.QueryResult) {
	m.QueryResults[query] = result
}

// ExecuteQueryWithCache implements CachedTrinoExecutor interface
// In mock, it simply delegates to ExecuteQuery (no actual caching)
func (m *MockTrinoExecutor) ExecuteQueryWithCache(ctx context.Context, query, catalog, schema string, priority int, savedQueryID *uuid.UUID) (*models.QueryResult, error) {
	return m.ExecuteQuery(ctx, query, catalog, schema)
}
