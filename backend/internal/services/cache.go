package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/models"
	"github.com/redis/go-redis/v9"
)

// CachePriority represents the priority level for cached query results
type CachePriority int

const (
	CachePriorityLow    CachePriority = 1 // Ad-hoc queries (short TTL)
	CachePriorityNormal CachePriority = 2 // Widget data (medium TTL)
	CachePriorityHigh   CachePriority = 3 // Scheduled queries (long TTL)
)

// TTL returns the TTL duration based on the cache priority
func (p CachePriority) TTL(cfg *config.CacheConfig) time.Duration {
	switch p {
	case CachePriorityHigh:
		return time.Duration(cfg.TTLHighSeconds) * time.Second
	case CachePriorityNormal:
		return time.Duration(cfg.TTLNormalSeconds) * time.Second
	default:
		return time.Duration(cfg.TTLLowSeconds) * time.Second
	}
}

// CachedQueryResult wraps QueryResult with cache metadata
type CachedQueryResult struct {
	*models.QueryResult
	CachedAt time.Time `json:"cached_at"`
}

// QueryCacheService manages query result caching using Redis
type QueryCacheService struct {
	cfg    *config.CacheConfig
	client *redis.Client
}

// NewQueryCacheService creates a new cache service instance
// Returns nil, nil if caching is disabled
func NewQueryCacheService(cfg *config.CacheConfig) (*QueryCacheService, error) {
	if !cfg.Enabled {
		return nil, nil
	}

	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.RedisHost, cfg.RedisPort),
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Printf("Connected to Redis at %s:%d", cfg.RedisHost, cfg.RedisPort)

	return &QueryCacheService{
		cfg:    cfg,
		client: client,
	}, nil
}

// GenerateCacheKey creates a cache key from query parameters
func GenerateCacheKey(prefix, queryText, catalog, schema string, params map[string]string) string {
	// Sort parameters for consistent key generation
	var paramStr string
	if len(params) > 0 {
		keys := make([]string, 0, len(params))
		for k := range params {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			paramStr += k + "=" + params[k] + "&"
		}
	}

	data := queryText + "|" + catalog + "|" + schema + "|" + paramStr
	hash := sha256.Sum256([]byte(data))
	return prefix + "query:" + hex.EncodeToString(hash[:])
}

// savedQueryKeySetKey returns the Redis key for the set of cache keys associated with a saved query
func (s *QueryCacheService) savedQueryKeySetKey(savedQueryID uuid.UUID) string {
	return s.cfg.KeyPrefix + "saved_query:" + savedQueryID.String() + ":keys"
}

// Get retrieves a cached query result
func (s *QueryCacheService) Get(ctx context.Context, key string) (*models.QueryResult, bool) {
	data, err := s.client.Get(ctx, key).Bytes()
	if err != nil {
		if err != redis.Nil {
			log.Printf("Cache get error for key %s: %v", key, err)
		}
		return nil, false
	}

	var cached CachedQueryResult
	if err := json.Unmarshal(data, &cached); err != nil {
		log.Printf("Cache unmarshal error for key %s: %v", key, err)
		return nil, false
	}

	return cached.QueryResult, true
}

// Set stores a query result in the cache with the specified priority
func (s *QueryCacheService) Set(ctx context.Context, key string, result *models.QueryResult, priority CachePriority) {
	cached := CachedQueryResult{
		QueryResult: result,
		CachedAt:    time.Now(),
	}

	data, err := json.Marshal(cached)
	if err != nil {
		log.Printf("Cache marshal error for key %s: %v", key, err)
		return
	}

	ttl := priority.TTL(s.cfg)
	if err := s.client.Set(ctx, key, data, ttl).Err(); err != nil {
		log.Printf("Cache set error for key %s: %v", key, err)
	}
}

// Delete removes a specific key from the cache
func (s *QueryCacheService) Delete(ctx context.Context, key string) error {
	return s.client.Del(ctx, key).Err()
}

// RegisterSavedQueryCache associates a cache key with a saved query ID
// This allows invalidating all cache entries when the saved query is updated
func (s *QueryCacheService) RegisterSavedQueryCache(ctx context.Context, savedQueryID uuid.UUID, cacheKey string) error {
	setKey := s.savedQueryKeySetKey(savedQueryID)

	// Add the cache key to the saved query's key set
	if err := s.client.SAdd(ctx, setKey, cacheKey).Err(); err != nil {
		return fmt.Errorf("failed to register cache key for saved query: %w", err)
	}

	// Set expiration on the set (longer than any individual cache TTL)
	// This ensures the set gets cleaned up eventually
	maxTTL := time.Duration(s.cfg.TTLHighSeconds*2) * time.Second
	if err := s.client.Expire(ctx, setKey, maxTTL).Err(); err != nil {
		log.Printf("Failed to set expiration on saved query key set: %v", err)
	}

	return nil
}

// InvalidateSavedQueryCaches removes all cached results associated with a saved query
func (s *QueryCacheService) InvalidateSavedQueryCaches(ctx context.Context, savedQueryID uuid.UUID) error {
	setKey := s.savedQueryKeySetKey(savedQueryID)

	// Get all cache keys associated with this saved query
	cacheKeys, err := s.client.SMembers(ctx, setKey).Result()
	if err != nil {
		if err == redis.Nil {
			return nil // No cached keys for this query
		}
		return fmt.Errorf("failed to get cache keys for saved query: %w", err)
	}

	if len(cacheKeys) == 0 {
		return nil
	}

	// Delete all cache entries
	if err := s.client.Del(ctx, cacheKeys...).Err(); err != nil {
		log.Printf("Failed to delete some cache keys: %v", err)
	}

	// Delete the set itself
	if err := s.client.Del(ctx, setKey).Err(); err != nil {
		log.Printf("Failed to delete saved query key set: %v", err)
	}

	log.Printf("Invalidated %d cache entries for saved query %s", len(cacheKeys), savedQueryID)
	return nil
}

// Close closes the Redis connection
func (s *QueryCacheService) Close() error {
	if s.client != nil {
		return s.client.Close()
	}
	return nil
}
