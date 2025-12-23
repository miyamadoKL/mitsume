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

	return &Config{
		Server: ServerConfig{
			Port:        getEnv("SERVER_PORT", "8080"),
			Mode:        getEnv("GIN_MODE", "debug"),
			FrontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),
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

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}
