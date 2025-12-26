package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mitsume/backend/internal/models"
)

type LayoutTemplateRepository interface {
	GetAll(ctx context.Context, userID uuid.UUID) ([]models.LayoutTemplate, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.LayoutTemplate, error)
	Create(ctx context.Context, userID uuid.UUID, req *models.CreateLayoutTemplateRequest) (*models.LayoutTemplate, error)
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}

type PostgresLayoutTemplateRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresLayoutTemplateRepository(pool *pgxpool.Pool) *PostgresLayoutTemplateRepository {
	return &PostgresLayoutTemplateRepository{pool: pool}
}

// GetAll returns all layout templates (system + user's custom)
func (r *PostgresLayoutTemplateRepository) GetAll(ctx context.Context, userID uuid.UUID) ([]models.LayoutTemplate, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, name, description, layout, is_system, created_at
		FROM layout_templates
		WHERE is_system = true OR user_id = $1
		ORDER BY is_system DESC, created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []models.LayoutTemplate
	for rows.Next() {
		var t models.LayoutTemplate
		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &t.Description, &t.Layout, &t.IsSystem, &t.CreatedAt); err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}

	return templates, rows.Err()
}

// GetByID returns a layout template by ID
func (r *PostgresLayoutTemplateRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.LayoutTemplate, error) {
	var t models.LayoutTemplate
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, name, description, layout, is_system, created_at
		FROM layout_templates
		WHERE id = $1
	`, id).Scan(&t.ID, &t.UserID, &t.Name, &t.Description, &t.Layout, &t.IsSystem, &t.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}

// Create creates a new custom layout template for a user
func (r *PostgresLayoutTemplateRepository) Create(ctx context.Context, userID uuid.UUID, req *models.CreateLayoutTemplateRequest) (*models.LayoutTemplate, error) {
	var t models.LayoutTemplate
	err := r.pool.QueryRow(ctx, `
		INSERT INTO layout_templates (user_id, name, description, layout, is_system)
		VALUES ($1, $2, $3, $4, false)
		RETURNING id, user_id, name, description, layout, is_system, created_at
	`, userID, req.Name, req.Description, req.Layout).Scan(
		&t.ID, &t.UserID, &t.Name, &t.Description, &t.Layout, &t.IsSystem, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// Delete deletes a custom layout template (only if user owns it and it's not a system template)
func (r *PostgresLayoutTemplateRepository) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	result, err := r.pool.Exec(ctx, `
		DELETE FROM layout_templates
		WHERE id = $1 AND user_id = $2 AND is_system = false
	`, id, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
