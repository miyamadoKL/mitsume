package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/mitsume/backend/internal/models"
	"github.com/mitsume/backend/internal/repository"
)

func setupExportHandlerTest() (*ExportHandler, *repository.MockTrinoExecutor) {
	mockTrino := repository.NewMockTrinoExecutor()
	handler := NewExportHandler(mockTrino)
	return handler, mockTrino
}

func TestExportCSV_Success(t *testing.T) {
	handler, mockTrino := setupExportHandlerTest()

	mockTrino.SetQueryResult("SELECT * FROM users", &models.QueryResult{
		Columns:         []string{"id", "name", "active"},
		Rows:            [][]interface{}{{1, "alice", true}, {2, "bob", false}},
		RowCount:        2,
		ExecutionTimeMs: 50,
	})

	body := ExportRequest{
		Query:    "SELECT * FROM users",
		Catalog:  "memory",
		Schema:   "default",
		Filename: "test_export",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/export/csv", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	handler.ExportCSV(c)

	if w.Code != http.StatusOK {
		t.Fatalf("ExportCSV() status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "text/csv" {
		t.Fatalf("Content-Type = %q, want %q", contentType, "text/csv")
	}

	disposition := w.Header().Get("Content-Disposition")
	if !strings.Contains(disposition, "test_export.csv") {
		t.Fatalf("Content-Disposition = %q, should contain 'test_export.csv'", disposition)
	}

	csvContent := w.Body.String()
	if !strings.Contains(csvContent, "id,name,active") {
		t.Fatalf("CSV should contain header row")
	}
	if !strings.Contains(csvContent, "alice") {
		t.Fatalf("CSV should contain data")
	}
}

func TestExportTSV_Success(t *testing.T) {
	handler, mockTrino := setupExportHandlerTest()

	mockTrino.SetQueryResult("SELECT id, name FROM products", &models.QueryResult{
		Columns:         []string{"id", "name"},
		Rows:            [][]interface{}{{1, "Product A"}, {2, "Product B"}},
		RowCount:        2,
		ExecutionTimeMs: 30,
	})

	body := ExportRequest{
		Query:   "SELECT id, name FROM products",
		Catalog: "memory",
		Schema:  "default",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/export/tsv", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	handler.ExportTSV(c)

	if w.Code != http.StatusOK {
		t.Fatalf("ExportTSV() status = %d, want %d", w.Code, http.StatusOK)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "text/tab-separated-values" {
		t.Fatalf("Content-Type = %q, want %q", contentType, "text/tab-separated-values")
	}

	tsvContent := w.Body.String()
	if !strings.Contains(tsvContent, "id\tname") {
		t.Fatalf("TSV should contain tab-separated header")
	}
}

func TestExportCSV_QueryError(t *testing.T) {
	handler, mockTrino := setupExportHandlerTest()

	mockTrino.ExecuteQueryError = errors.New("query failed")

	body := ExportRequest{
		Query: "SELECT * FROM nonexistent",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/export/csv", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	handler.ExportCSV(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ExportCSV() status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestExportCSV_InvalidRequest(t *testing.T) {
	handler, _ := setupExportHandlerTest()

	// Missing required field 'query'
	body := ExportRequest{
		Catalog: "memory",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/export/csv", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	handler.ExportCSV(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ExportCSV() status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestExportCSV_DefaultFilename(t *testing.T) {
	handler, mockTrino := setupExportHandlerTest()

	mockTrino.SetQueryResult("SELECT 1", &models.QueryResult{
		Columns:         []string{"result"},
		Rows:            [][]interface{}{{1}},
		RowCount:        1,
		ExecutionTimeMs: 10,
	})

	// No filename provided
	body := ExportRequest{
		Query: "SELECT 1",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/export/csv", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	handler.ExportCSV(c)

	if w.Code != http.StatusOK {
		t.Fatalf("ExportCSV() status = %d, want %d", w.Code, http.StatusOK)
	}

	disposition := w.Header().Get("Content-Disposition")
	if !strings.Contains(disposition, "query_result_") {
		t.Fatalf("Content-Disposition = %q, should contain default filename", disposition)
	}
}

func TestExportCSV_SanitizedFilename(t *testing.T) {
	handler, mockTrino := setupExportHandlerTest()

	mockTrino.SetQueryResult("SELECT 1", &models.QueryResult{
		Columns:         []string{"result"},
		Rows:            [][]interface{}{{1}},
		RowCount:        1,
		ExecutionTimeMs: 10,
	})

	// Filename with dangerous characters
	body := ExportRequest{
		Query:    "SELECT 1",
		Filename: "../../etc/passwd",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/export/csv", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	handler.ExportCSV(c)

	if w.Code != http.StatusOK {
		t.Fatalf("ExportCSV() status = %d, want %d", w.Code, http.StatusOK)
	}

	disposition := w.Header().Get("Content-Disposition")
	// After sanitization, "/" should be replaced with "_"
	// Original: "../../etc/passwd" -> Sanitized: ".._.._etc_passwd"
	if strings.Contains(disposition, "/") {
		t.Fatalf("Filename should not contain '/', got: %s", disposition)
	}
	if !strings.Contains(disposition, "_") {
		t.Fatalf("Filename should contain sanitized characters, got: %s", disposition)
	}
}
