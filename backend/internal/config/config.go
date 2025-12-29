package config

import (
	"errors"
	"os"
	"strconv"
)

type Config struct {
	Server       ServerConfig
	Database     DatabaseConfig
	Trino        TrinoConfig
	JWT          JWTConfig
	Google       GoogleOAuthConfig
	Notification NotificationConfig
	Cache        CacheConfig
	Admin        AdminConfig
	RateLimit    RateLimitConfig
}

type RateLimitConfig struct {
	Enabled            bool
	RequestsPerMinute  int
	BurstSize          int
	CleanupIntervalSec int
}

type AdminConfig struct {
	Username          string // MITSUME_ADMIN_USERNAME (default: "admin")
	Password          string // MITSUME_ADMIN_PASSWORD (required for creation)
	PasswordMinLength int    // MITSUME_ADMIN_PASSWORD_MIN_LENGTH (default: 0)
}

type CacheConfig struct {
	Enabled          bool
	RedisHost        string
	RedisPort        int
	RedisPassword    string
	RedisDB          int
	TTLHighSeconds   int
	TTLNormalSeconds int
	TTLLowSeconds    int
	KeyPrefix        string
}

type NotificationConfig struct {
	SMTP SMTPConfig
}

type SMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
	UseTLS   bool
}

type ServerConfig struct {
	Port        string
	Mode        string
	FrontendURL string
	MaxBodySize int64 // Maximum request body size in bytes (default: 1MB)
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type TrinoConfig struct {
	Host    string
	Port    string
	User    string
	Catalog string
	Schema  string
}

type JWTConfig struct {
	Secret     string
	ExpireHour int
}

type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

func Load() (*Config, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, errors.New("JWT_SECRET environment variable is required but not set")
	}

	// Validate MITSUME_ADMIN_PASSWORD_MIN_LENGTH
	adminPasswordMinLength, err := getEnvIntValidated("MITSUME_ADMIN_PASSWORD_MIN_LENGTH", 0)
	if err != nil {
		return nil, err
	}

	return &Config{
		Server: ServerConfig{
			Port:        getEnv("SERVER_PORT", "8080"),
			Mode:        getEnv("GIN_MODE", "debug"),
			FrontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),
			MaxBodySize: getEnvInt64("MAX_BODY_SIZE", 1<<20), // Default: 1MB
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "mitsume"),
			Password: getEnv("DB_PASSWORD", "mitsume"),
			DBName:   getEnv("DB_NAME", "mitsume"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		Trino: TrinoConfig{
			Host:    getEnv("TRINO_HOST", "localhost"),
			Port:    getEnv("TRINO_PORT", "8080"),
			User:    getEnv("TRINO_USER", "mitsume"),
			Catalog: getEnv("TRINO_CATALOG", "memory"),
			Schema:  getEnv("TRINO_SCHEMA", "default"),
		},
		JWT: JWTConfig{
			Secret:     jwtSecret,
			ExpireHour: 24,
		},
		Google: GoogleOAuthConfig{
			ClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
			ClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
			RedirectURL:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/auth/google/callback"),
		},
		Notification: NotificationConfig{
			SMTP: SMTPConfig{
				Host:     getEnv("SMTP_HOST", ""),
				Port:     getEnv("SMTP_PORT", "587"),
				Username: getEnv("SMTP_USERNAME", ""),
				Password: getEnv("SMTP_PASSWORD", ""),
				From:     getEnv("SMTP_FROM", ""),
				UseTLS:   getEnv("SMTP_USE_TLS", "true") == "true",
			},
		},
		Cache: CacheConfig{
			Enabled:          getEnvBool("CACHE_ENABLED", false),
			RedisHost:        getEnv("REDIS_HOST", "localhost"),
			RedisPort:        getEnvInt("REDIS_PORT", 6379),
			RedisPassword:    getEnv("REDIS_PASSWORD", ""),
			RedisDB:          getEnvInt("REDIS_DB", 0),
			TTLHighSeconds:   getEnvInt("CACHE_TTL_HIGH_SECONDS", 3600),
			TTLNormalSeconds: getEnvInt("CACHE_TTL_NORMAL_SECONDS", 600),
			TTLLowSeconds:    getEnvInt("CACHE_TTL_LOW_SECONDS", 60),
			KeyPrefix:        getEnv("CACHE_KEY_PREFIX", "mitsume:cache:"),
		},
		Admin: AdminConfig{
			Username:          getEnv("MITSUME_ADMIN_USERNAME", "admin"),
			Password:          os.Getenv("MITSUME_ADMIN_PASSWORD"), // No default - empty means skip
			PasswordMinLength: adminPasswordMinLength,
		},
		RateLimit: RateLimitConfig{
			Enabled:            getEnvBool("RATE_LIMIT_ENABLED", true),
			RequestsPerMinute:  getEnvInt("RATE_LIMIT_REQUESTS_PER_MINUTE", 60),
			BurstSize:          getEnvInt("RATE_LIMIT_BURST_SIZE", 10),
			CleanupIntervalSec: getEnvInt("RATE_LIMIT_CLEANUP_INTERVAL_SEC", 60),
		},
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}

// getEnvIntValidated gets an integer from environment variable with validation.
// Returns an error if the value is not a valid non-negative integer.
func getEnvIntValidated(key string, defaultValue int) (int, error) {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue, nil
	}

	intVal, err := strconv.Atoi(value)
	if err != nil {
		return 0, errors.New(key + " must be a valid integer, got: " + value)
	}

	if intVal < 0 {
		return 0, errors.New(key + " must be a non-negative integer, got: " + value)
	}

	return intVal, nil
}
