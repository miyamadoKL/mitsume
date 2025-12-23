package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupQueryHandlerTest() (*QueryHandler, *repository.MockTrinoExecutor, *repository.MockQueryHistoryRecorder) {
	mockTrino := repository.NewMockTrinoExecutor()
	mockHistory := repository.NewMockQueryHistoryRecorder()
	handler := NewQueryHandler(mockTrino, mockHistory, nil)
	return handler, mockTrino, mockHistory
}

func createTestContext(method, path string, body interface{}) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	var req *http.Request
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		req = httptest.NewRequest(method, path, bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	c.Request = req

	// Set userID for authenticated routes
	c.Set("userID", uuid.New())

	return c, w
}

func TestExecuteQuery_Success(t *testing.T) {
	handler, mockTrino, _ := setupQueryHandlerTest()

	expectedResult := &models.QueryResult{
		Columns:         []string{"id", "name"},
		Rows:            [][]interface{}{{1, "alice"}, {2, "bob"}},
		RowCount:        2,
		ExecutionTimeMs: 50,
	}
	mockTrino.SetQueryResult("SELECT * FROM users", expectedResult)

	body := models.ExecuteQueryRequest{
		Query:   "SELECT * FROM users",
		Catalog: "memory",
		Schema:  "default",
	}
	c, w := createTestContext("POST", "/api/queries/execute", body)

	handler.ExecuteQuery(c)

	if w.Code != http.StatusOK {
		t.Fatalf("ExecuteQuery() status = %d, want %d", w.Code, http.StatusOK)
	}

	var result models.QueryResult
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if result.RowCount != 2 {
		t.Fatalf("ExecuteQuery() rowCount = %d, want 2", result.RowCount)
	}
	if len(result.Columns) != 2 {
		t.Fatalf("ExecuteQuery() columns = %d, want 2", len(result.Columns))
	}
}

func TestExecuteQuery_Error(t *testing.T) {
	handler, mockTrino, _ := setupQueryHandlerTest()

	mockTrino.ExecuteQueryError = errors.New("query execution failed")

	body := models.ExecuteQueryRequest{
		Query:   "SELECT * FROM invalid",
		Catalog: "memory",
		Schema:  "default",
	}
	c, w := createTestContext("POST", "/api/queries/execute", body)

	handler.ExecuteQuery(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ExecuteQuery() status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetCatalogs_Success(t *testing.T) {
	handler, mockTrino, _ := setupQueryHandlerTest()

	mockTrino.Catalogs = []string{"memory", "postgresql", "hive"}

	c, w := createTestContext("GET", "/api/catalogs", nil)

	handler.GetCatalogs(c)

	if w.Code != http.StatusOK {
		t.Fatalf("GetCatalogs() status = %d, want %d", w.Code, http.StatusOK)
	}

	var response map[string][]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	catalogs := response["catalogs"]
	if len(catalogs) != 3 {
		t.Fatalf("GetCatalogs() count = %d, want 3", len(catalogs))
	}
}

func TestGetCatalogs_Error(t *testing.T) {
	handler, mockTrino, _ := setupQueryHandlerTest()

	mockTrino.GetCatalogsError = errors.New("connection failed")

	c, w := createTestContext("GET", "/api/catalogs", nil)

	handler.GetCatalogs(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("GetCatalogs() status = %d, want %d", w.Code, http.StatusInternalServerError)
	}
}

func TestGetSchemas_Success(t *testing.T) {
	handler, mockTrino, _ := setupQueryHandlerTest()

	mockTrino.Schemas["memory"] = []string{"default", "information_schema"}

	c, w := createTestContext("GET", "/api/catalogs/memory/schemas", nil)
	c.Params = gin.Params{{Key: "catalog", Value: "memory"}}

	handler.GetSchemas(c)

	if w.Code != http.StatusOK {
		t.Fatalf("GetSchemas() status = %d, want %d", w.Code, http.StatusOK)
	}

	var response map[string][]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	schemas := response["schemas"]
	if len(schemas) != 2 {
		t.Fatalf("GetSchemas() count = %d, want 2", len(schemas))
	}
}

func TestGetSchemas_MissingCatalog(t *testing.T) {
	handler, _, _ := setupQueryHandlerTest()

	c, w := createTestContext("GET", "/api/catalogs//schemas", nil)
	c.Params = gin.Params{{Key: "catalog", Value: ""}}

	handler.GetSchemas(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("GetSchemas() status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetTables_Success(t *testing.T) {
	handler, mockTrino, _ := setupQueryHandlerTest()

	mockTrino.SetupCatalog("memory", map[string][]string{
		"default": {"users", "orders", "products"},
	})

	c, w := createTestContext("GET", "/api/catalogs/memory/schemas/default/tables", nil)
	c.Params = gin.Params{
		{Key: "catalog", Value: "memory"},
		{Key: "schema", Value: "default"},
	}

	handler.GetTables(c)

	if w.Code != http.StatusOK {
		t.Fatalf("GetTables() status = %d, want %d", w.Code, http.StatusOK)
	}

	var response map[string][]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	tables := response["tables"]
	if len(tables) != 3 {
		t.Fatalf("GetTables() count = %d, want 3", len(tables))
	}
}

func TestGetTables_MissingParams(t *testing.T) {
	handler, _, _ := setupQueryHandlerTest()

	// Missing schema
	c, w := createTestContext("GET", "/api/catalogs/memory/schemas//tables", nil)
	c.Params = gin.Params{
		{Key: "catalog", Value: "memory"},
		{Key: "schema", Value: ""},
	}

	handler.GetTables(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("GetTables() status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestExecuteQuery_CallTracking(t *testing.T) {
	handler, mockTrino, _ := setupQueryHandlerTest()

	body := models.ExecuteQueryRequest{
		Query:   "SELECT 1",
		Catalog: "test_catalog",
		Schema:  "test_schema",
	}
	c, _ := createTestContext("POST", "/api/queries/execute", body)

	handler.ExecuteQuery(c)

	if len(mockTrino.ExecuteQueryCalls) != 1 {
		t.Fatalf("Expected 1 call, got %d", len(mockTrino.ExecuteQueryCalls))
	}

	call := mockTrino.ExecuteQueryCalls[0]
	if call.Query != "SELECT 1" {
		t.Fatalf("Query = %q, want %q", call.Query, "SELECT 1")
	}
	if call.Catalog != "test_catalog" {
		t.Fatalf("Catalog = %q, want %q", call.Catalog, "test_catalog")
	}
	if call.Schema != "test_schema" {
		t.Fatalf("Schema = %q, want %q", call.Schema, "test_schema")
	}
}

func TestExecuteQuery_CustomFunc(t *testing.T) {
	handler, mockTrino, _ := setupQueryHandlerTest()

	// Use custom function to simulate dynamic behavior
	callCount := 0
	mockTrino.ExecuteQueryFunc = func(ctx context.Context, query, catalog, schema string) (*models.QueryResult, error) {
		callCount++
		return &models.QueryResult{
			Columns:         []string{"count"},
			Rows:            [][]interface{}{{callCount}},
			RowCount:        1,
			ExecutionTimeMs: 10,
		}, nil
	}

	body := models.ExecuteQueryRequest{Query: "SELECT 1"}
	c, w := createTestContext("POST", "/api/queries/execute", body)

	handler.ExecuteQuery(c)

	if w.Code != http.StatusOK {
		t.Fatalf("ExecuteQuery() status = %d, want %d", w.Code, http.StatusOK)
	}
	if callCount != 1 {
		t.Fatalf("Custom function called %d times, want 1", callCount)
	}
}
