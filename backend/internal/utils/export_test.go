package utils

import (
	"bytes"
	"strings"
	"testing"

	"github.com/mitsume/backend/internal/models"
)

func sampleResult() *models.QueryResult {
	return &models.QueryResult{
		Columns: []string{"id", "name", "active"},
		Rows: [][]interface{}{
			{1, "alice", true},
			{2, nil, false},
		},
	}
}

func TestExportToCSV(t *testing.T) {
	var buf bytes.Buffer
	if err := ExportToCSV(&buf, sampleResult()); err != nil {
		t.Fatalf("ExportToCSV() error = %v", err)
	}
	got := buf.String()
	wantContains := []string{
		"id,name,active",
		"1,alice,true",
		"2,,false", // nil should be empty
	}
	for _, part := range wantContains {
		if !strings.Contains(got, part) {
			t.Fatalf("CSV output missing %q\nOutput:\n%s", part, got)
		}
	}
}

func TestExportToTSV(t *testing.T) {
	var buf bytes.Buffer
	if err := ExportToTSV(&buf, sampleResult()); err != nil {
		t.Fatalf("ExportToTSV() error = %v", err)
	}
	got := buf.String()
	wantContains := []string{
		"id\tname\tactive",
		"1\talice\ttrue",
		"2\t\tfalse",
	}
	for _, part := range wantContains {
		if !strings.Contains(got, part) {
			t.Fatalf("TSV output missing %q\nOutput:\n%s", part, got)
		}
	}
}

func TestSanitizeFilename(t *testing.T) {
	name := `bad/<>:"\\name?.txt`
	got := SanitizeFilename(name)
	if strings.ContainsAny(got, `/\\:*?"<>|`) {
		t.Fatalf("SanitizeFilename(%q) produced unsafe name %q", name, got)
	}
}
