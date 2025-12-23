package utils

import (
	"encoding/csv"
	"fmt"
	"io"
	"strings"

	"github.com/mitsume/backend/internal/models"
)

func ExportToCSV(w io.Writer, result *models.QueryResult) error {
	return exportDelimited(w, result, ',')
}

func ExportToTSV(w io.Writer, result *models.QueryResult) error {
	return exportDelimited(w, result, '\t')
}

func exportDelimited(w io.Writer, result *models.QueryResult, delimiter rune) error {
	writer := csv.NewWriter(w)
	writer.Comma = delimiter

	// Write header
	if err := writer.Write(result.Columns); err != nil {
		return fmt.Errorf("failed to write header: %w", err)
	}

	// Write rows
	for _, row := range result.Rows {
		record := make([]string, len(row))
		for i, val := range row {
			record[i] = formatValueForExport(val)
		}
		if err := writer.Write(record); err != nil {
			return fmt.Errorf("failed to write row: %w", err)
		}
	}

	writer.Flush()
	return writer.Error()
}

func formatValueForExport(v interface{}) string {
	if v == nil {
		return ""
	}

	switch val := v.(type) {
	case string:
		return val
	case []byte:
		return string(val)
	case bool:
		if val {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", val)
	}
}

func SanitizeFilename(name string) string {
	// Remove or replace characters that are invalid in filenames
	replacer := strings.NewReplacer(
		"/", "_",
		"\\", "_",
		":", "_",
		"*", "_",
		"?", "_",
		"\"", "_",
		"<", "_",
		">", "_",
		"|", "_",
	)
	return replacer.Replace(name)
}
