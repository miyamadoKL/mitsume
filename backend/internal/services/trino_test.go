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
		{"empty", "", true},
		{"has_dash", "bad-name", true},
		{"has_space", "bad name", true},
		{"has_symbol", "bad$name", true},
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
