package services

import (
	"testing"
	"time"

	"github.com/mitsume/backend/internal/config"
)

func newTestTrinoService() *TrinoService {
	return NewTrinoService(&config.TrinoConfig{
		Host:    "localhost",
		Port:    "8080",
		User:    "user",
		Catalog: "memory",
		Schema:  "default",
	})
}

func TestGetConnectionStringDefaults(t *testing.T) {
	service := newTestTrinoService()

	got := service.getConnectionString("", "")
	want := "http://user@localhost:8080?catalog=memory&schema=default"
	if got != want {
		t.Fatalf("getConnectionString() = %s, want %s", got, want)
	}
}

func TestGetConnectionStringOverrides(t *testing.T) {
	service := newTestTrinoService()

	got := service.getConnectionString("custom", "schema")
	want := "http://user@localhost:8080?catalog=custom&schema=schema"
	if got != want {
		t.Fatalf("getConnectionString() = %s, want %s", got, want)
	}
}

func TestValidateIdentifier(t *testing.T) {
	cases := []struct {
		name      string
		value     string
		wantError bool
	}{
		{"valid_alnum", "catalog1", false},
		{"valid_with_underscore", "schema_name", false},
		{"valid_with_dash", "my-catalog", false},
		{"valid_with_dollar", "table$name", false},
		{"valid_mixed", "my-catalog_name$1", false},
		{"empty", "", true},
		{"has_space", "bad name", true},
		{"has_dot", "bad.name", true},
		{"has_semicolon", "bad;name", true},
		{"starts_with_dash", "-leading-dash", false}, // Valid when properly quoted
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			err := validateIdentifier(tt.value)
			if tt.wantError && err == nil {
				t.Fatalf("validateIdentifier(%q) expected error, got nil", tt.value)
			}
			if !tt.wantError && err != nil {
				t.Fatalf("validateIdentifier(%q) unexpected error: %v", tt.value, err)
			}
		})
	}
}

func TestQuoteIdentifier(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"simple", "catalog", `"catalog"`},
		{"with_dash", "my-catalog", `"my-catalog"`},
		{"with_dollar", "table$name", `"table$name"`},
		{"with_underscore", "schema_name", `"schema_name"`},
		{"with_double_quote", `has"quote`, `"has""quote"`},
		{"multiple_quotes", `a"b"c`, `"a""b""c"`},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			got := quoteIdentifier(tt.input)
			if got != tt.want {
				t.Fatalf("quoteIdentifier(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestEscapeStringLiteral(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"simple", "hello", "hello"},
		{"with_single_quote", "it's", "it''s"},
		{"multiple_quotes", "it's user's", "it''s user''s"},
		{"no_escape_needed", "hello world", "hello world"},
		{"empty", "", ""},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			got := escapeStringLiteral(tt.input)
			if got != tt.want {
				t.Fatalf("escapeStringLiteral(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestFormatValue(t *testing.T) {
	fixedTime := time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC)

	cases := []struct {
		name  string
		input interface{}
		want  interface{}
	}{
		{"nil", nil, nil},
		{"string", "hello", "hello"},
		{"int", 42, 42},
		{"float64", 3.14, 3.14},
		{"bool_true", true, true},
		{"bool_false", false, false},
		{"bytes", []byte("binary"), "binary"},
		{"time", fixedTime, "2024-01-15T10:30:00Z"},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			got := formatValue(tt.input)
			if got != tt.want {
				t.Fatalf("formatValue(%v) = %v (%T), want %v (%T)", tt.input, got, got, tt.want, tt.want)
			}
		})
	}
}

func TestEscapeSearchQuery(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"simple_text", "users", "users"},
		{"single_quote", "user's", "user''s"},
		{"percent_sign", "100%", "100\\%"},
		{"underscore", "user_name", "user\\_name"},
		{"multiple_special", "user's_data%", "user''s\\_data\\%"},
		{"empty_string", "", ""},
		{"multiple_quotes", "it's user's data", "it''s user''s data"},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			got := escapeSearchQuery(tt.input)
			if got != tt.want {
				t.Fatalf("escapeSearchQuery(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
