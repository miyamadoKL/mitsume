package config

import (
	"os"
	"testing"
)

func TestLoad_PasswordMinLengthNegative_ReturnsError(t *testing.T) {
	// Set required env vars
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("MITSUME_ADMIN_PASSWORD_MIN_LENGTH", "-1")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("MITSUME_ADMIN_PASSWORD_MIN_LENGTH")

	_, err := Load()
	if err == nil {
		t.Error("Expected error for negative password min length, got nil")
	}

	if err != nil && !contains(err.Error(), "non-negative") {
		t.Errorf("Expected error message to contain 'non-negative', got: %v", err)
	}
}

func TestLoad_PasswordMinLengthInvalidString_ReturnsError(t *testing.T) {
	// Set required env vars
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("MITSUME_ADMIN_PASSWORD_MIN_LENGTH", "abc")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("MITSUME_ADMIN_PASSWORD_MIN_LENGTH")

	_, err := Load()
	if err == nil {
		t.Error("Expected error for non-numeric password min length, got nil")
	}

	if err != nil && !contains(err.Error(), "valid integer") {
		t.Errorf("Expected error message to contain 'valid integer', got: %v", err)
	}
}

func TestLoad_PasswordMinLengthValidZero_Succeeds(t *testing.T) {
	// Set required env vars
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("MITSUME_ADMIN_PASSWORD_MIN_LENGTH", "0")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("MITSUME_ADMIN_PASSWORD_MIN_LENGTH")

	cfg, err := Load()
	if err != nil {
		t.Errorf("Expected no error for 0 password min length, got: %v", err)
	}

	if cfg.Admin.PasswordMinLength != 0 {
		t.Errorf("Expected PasswordMinLength to be 0, got: %d", cfg.Admin.PasswordMinLength)
	}
}

func TestLoad_PasswordMinLengthValidPositive_Succeeds(t *testing.T) {
	// Set required env vars
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("MITSUME_ADMIN_PASSWORD_MIN_LENGTH", "8")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("MITSUME_ADMIN_PASSWORD_MIN_LENGTH")

	cfg, err := Load()
	if err != nil {
		t.Errorf("Expected no error for positive password min length, got: %v", err)
	}

	if cfg.Admin.PasswordMinLength != 8 {
		t.Errorf("Expected PasswordMinLength to be 8, got: %d", cfg.Admin.PasswordMinLength)
	}
}

func TestLoad_PasswordMinLengthNotSet_UsesDefault(t *testing.T) {
	// Set required env vars
	os.Setenv("JWT_SECRET", "test-secret")
	os.Unsetenv("MITSUME_ADMIN_PASSWORD_MIN_LENGTH")
	defer os.Unsetenv("JWT_SECRET")

	cfg, err := Load()
	if err != nil {
		t.Errorf("Expected no error when password min length not set, got: %v", err)
	}

	if cfg.Admin.PasswordMinLength != 0 {
		t.Errorf("Expected default PasswordMinLength to be 0, got: %d", cfg.Admin.PasswordMinLength)
	}
}

func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
