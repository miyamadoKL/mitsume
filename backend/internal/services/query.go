package services

import (
	"context"
	"errors"
	"log"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/mitsume/backend/internal/database"
	"github.com/mitsume/backend/internal/models"
)

type QueryService struct {
	cache *QueryCacheService // nil if caching is disabled
}

func NewQueryService(cache *QueryCacheService) *QueryService {
	return &QueryService{
		cache: cache,
	}
}

// SavedQuery CRUD operations

func (s *QueryService) GetSavedQueries(ctx context.Context, userID uuid.UUID) ([]models.SavedQuery, error) {
	pool := database.GetPool()

	rows, err := pool.Query(ctx,
		`SELECT id, user_id, name, description, query_text, catalog, schema_name, created_at, updated_at
		 FROM saved_queries WHERE user_id = $1 ORDER BY updated_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var queries []models.SavedQuery
	for rows.Next() {
		var q models.SavedQuery
		if err := rows.Scan(&q.ID, &q.UserID, &q.Name, &q.Description, &q.QueryText, &q.Catalog, &q.SchemaName, &q.CreatedAt, &q.UpdatedAt); err != nil {
			return nil, err
		}
		queries = append(queries, q)
	}

	return queries, nil
}

func (s *QueryService) GetSavedQuery(ctx context.Context, id, userID uuid.UUID) (*models.SavedQuery, error) {
	pool := database.GetPool()

	var q models.SavedQuery
	err := pool.QueryRow(ctx,
		`SELECT id, user_id, name, description, query_text, catalog, schema_name, created_at, updated_at
		 FROM saved_queries WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&q.ID, &q.UserID, &q.Name, &q.Description, &q.QueryText, &q.Catalog, &q.SchemaName, &q.CreatedAt, &q.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &q, nil
}

// GetSavedQueryByID returns a saved query by ID only (used by alert service and widget data)
func (s *QueryService) GetSavedQueryByID(ctx context.Context, id uuid.UUID) (*models.SavedQuery, error) {
	pool := database.GetPool()

	var q models.SavedQuery
	err := pool.QueryRow(ctx,
		`SELECT id, user_id, name, description, query_text, catalog, schema_name, created_at, updated_at
		 FROM saved_queries WHERE id = $1`,
		id,
	).Scan(&q.ID, &q.UserID, &q.Name, &q.Description, &q.QueryText, &q.Catalog, &q.SchemaName, &q.CreatedAt, &q.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &q, nil
}

func (s *QueryService) CreateSavedQuery(ctx context.Context, userID uuid.UUID, req *models.SaveQueryRequest) (*models.SavedQuery, error) {
	pool := database.GetPool()

	var q models.SavedQuery
	err := pool.QueryRow(ctx,
		`INSERT INTO saved_queries (user_id, name, description, query_text, catalog, schema_name)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, user_id, name, description, query_text, catalog, schema_name, created_at, updated_at`,
		userID, req.Name, req.Description, req.QueryText, req.Catalog, req.SchemaName,
	).Scan(&q.ID, &q.UserID, &q.Name, &q.Description, &q.QueryText, &q.Catalog, &q.SchemaName, &q.CreatedAt, &q.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &q, nil
}

func (s *QueryService) UpdateSavedQuery(ctx context.Context, id, userID uuid.UUID, req *models.UpdateQueryRequest) (*models.SavedQuery, error) {
	pool := database.GetPool()

	var q models.SavedQuery
	err := pool.QueryRow(ctx,
		`UPDATE saved_queries
		 SET name = COALESCE(NULLIF($3, ''), name),
		     description = COALESCE($4, description),
		     query_text = COALESCE(NULLIF($5, ''), query_text),
		     catalog = COALESCE($6, catalog),
		     schema_name = COALESCE($7, schema_name),
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, name, description, query_text, catalog, schema_name, created_at, updated_at`,
		id, userID, req.Name, req.Description, req.QueryText, req.Catalog, req.SchemaName,
	).Scan(&q.ID, &q.UserID, &q.Name, &q.Description, &q.QueryText, &q.Catalog, &q.SchemaName, &q.CreatedAt, &q.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	// Invalidate cache for this saved query
	if s.cache != nil {
		if cacheErr := s.cache.InvalidateSavedQueryCaches(ctx, id); cacheErr != nil {
			log.Printf("Failed to invalidate cache for saved query %s: %v", id, cacheErr)
			// Continue anyway - cache invalidation failure shouldn't fail the update
		}
	}

	return &q, nil
}

func (s *QueryService) DeleteSavedQuery(ctx context.Context, id, userID uuid.UUID) error {
	// Invalidate cache before deleting (so we can still look up the query ID)
	if s.cache != nil {
		if cacheErr := s.cache.InvalidateSavedQueryCaches(ctx, id); cacheErr != nil {
			log.Printf("Failed to invalidate cache for saved query %s: %v", id, cacheErr)
			// Continue anyway - cache invalidation failure shouldn't fail the delete
		}
	}

	pool := database.GetPool()

	result, err := pool.Exec(ctx,
		`DELETE FROM saved_queries WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// Query History operations

func (s *QueryService) SaveQueryHistory(ctx context.Context, userID uuid.UUID, queryText, status string, executionTimeMs int64, rowCount int, errorMsg *string) error {
	pool := database.GetPool()

	execTime := int(executionTimeMs)
	_, err := pool.Exec(ctx,
		`INSERT INTO query_history (user_id, query_text, status, execution_time_ms, row_count, error_message)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		userID, queryText, status, execTime, rowCount, errorMsg,
	)

	return err
}

func (s *QueryService) GetQueryHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.QueryHistory, error) {
	pool := database.GetPool()

	// Use Go 1.21+ min/max builtins for cleaner limit clamping
	if limit <= 0 {
		limit = 50
	}
	limit = min(limit, 200)

	rows, err := pool.Query(ctx,
		`SELECT id, user_id, query_text, status, execution_time_ms, row_count, error_message, executed_at
		 FROM query_history
		 WHERE user_id = $1
		 ORDER BY executed_at DESC
		 LIMIT $2 OFFSET $3`,
		userID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []models.QueryHistory
	for rows.Next() {
		var h models.QueryHistory
		if err := rows.Scan(&h.ID, &h.UserID, &h.QueryText, &h.Status, &h.ExecutionTimeMs, &h.RowCount, &h.ErrorMessage, &h.ExecutedAt); err != nil {
			return nil, err
		}
		history = append(history, h)
	}

	return history, nil
}
