package services

import (
	"context"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/models"
)

// CachedTrinoService wraps TrinoService with caching capability
type CachedTrinoService struct {
	trino *TrinoService
	cache *QueryCacheService // nil if caching is disabled
	cfg   *config.CacheConfig
}

// NewCachedTrinoService creates a new cached Trino service
func NewCachedTrinoService(trino *TrinoService, cache *QueryCacheService, cfg *config.CacheConfig) *CachedTrinoService {
	return &CachedTrinoService{
		trino: trino,
		cache: cache,
		cfg:   cfg,
	}
}

// ExecuteQueryWithCache executes a query with caching support
// If caching is disabled or cache is nil, it falls back to direct execution
// priority: 1=Low (ad-hoc), 2=Normal (widget), 3=High (scheduled)
func (s *CachedTrinoService) ExecuteQueryWithCache(
	ctx context.Context,
	query, catalog, schema string,
	priority int,
	savedQueryID *uuid.UUID,
) (*models.QueryResult, error) {
	// If caching is disabled, execute directly
	if s.cache == nil {
		return s.trino.ExecuteQuery(ctx, query, catalog, schema)
	}

	// Generate cache key
	key := GenerateCacheKey(s.cfg.KeyPrefix, query, catalog, schema, nil)

	// Check cache
	if result, ok := s.cache.Get(ctx, key); ok {
		return result, nil // Cache hit
	}

	// Cache miss - execute query
	result, err := s.trino.ExecuteQuery(ctx, query, catalog, schema)
	if err != nil {
		return nil, err
	}

	// Store in cache (convert int to CachePriority)
	s.cache.Set(ctx, key, result, CachePriority(priority))

	// Register association with saved query (for invalidation)
	if savedQueryID != nil {
		if regErr := s.cache.RegisterSavedQueryCache(ctx, *savedQueryID, key); regErr != nil {
			// Log but don't fail the request
			// The cache will still work, just won't be invalidated on query update
		}
	}

	return result, nil
}

// ExecuteQuery executes a query without caching (for backward compatibility)
func (s *CachedTrinoService) ExecuteQuery(ctx context.Context, query, catalog, schema string) (*models.QueryResult, error) {
	return s.trino.ExecuteQuery(ctx, query, catalog, schema)
}

// GetCatalogs delegates to the underlying Trino service
func (s *CachedTrinoService) GetCatalogs(ctx context.Context) ([]string, error) {
	return s.trino.GetCatalogs(ctx)
}

// GetSchemas delegates to the underlying Trino service
func (s *CachedTrinoService) GetSchemas(ctx context.Context, catalog string) ([]string, error) {
	return s.trino.GetSchemas(ctx, catalog)
}

// GetTables delegates to the underlying Trino service
func (s *CachedTrinoService) GetTables(ctx context.Context, catalog, schema string) ([]string, error) {
	return s.trino.GetTables(ctx, catalog, schema)
}
