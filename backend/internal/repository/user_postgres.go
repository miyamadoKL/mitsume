package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mitsume/backend/internal/models"
)

// PostgresUserRepository implements UserRepository using PostgreSQL
type PostgresUserRepository struct {
	pool *pgxpool.Pool
}

// NewPostgresUserRepository creates a new PostgresUserRepository
func NewPostgresUserRepository(pool *pgxpool.Pool) *PostgresUserRepository {
	return &PostgresUserRepository{pool: pool}
}

func (r *PostgresUserRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, username, name, auth_provider, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.Username, &user.Name, &user.AuthProvider, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *PostgresUserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, username, password_hash, name, auth_provider, created_at, updated_at
		 FROM users WHERE email = $1 AND auth_provider = 'local'`,
		email,
	).Scan(&user.ID, &user.Email, &user.Username, &user.PasswordHash, &user.Name, &user.AuthProvider, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *PostgresUserRepository) FindByUsername(ctx context.Context, username string) (*models.User, error) {
	var user models.User
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, username, password_hash, name, auth_provider, created_at, updated_at
		 FROM users WHERE username = $1 AND auth_provider = 'local'`,
		username,
	).Scan(&user.ID, &user.Email, &user.Username, &user.PasswordHash, &user.Name, &user.AuthProvider, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *PostgresUserRepository) FindByEmailOrUsername(ctx context.Context, identifier string) (*models.User, error) {
	var user models.User
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, username, password_hash, name, auth_provider, created_at, updated_at
		 FROM users WHERE (email = $1 OR username = $1) AND auth_provider = 'local'`,
		identifier,
	).Scan(&user.ID, &user.Email, &user.Username, &user.PasswordHash, &user.Name, &user.AuthProvider, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *PostgresUserRepository) FindByGoogleID(ctx context.Context, googleID string) (*models.User, error) {
	var user models.User
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, username, name, auth_provider, created_at, updated_at
		 FROM users WHERE google_id = $1`,
		googleID,
	).Scan(&user.ID, &user.Email, &user.Username, &user.Name, &user.AuthProvider, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *PostgresUserRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (r *PostgresUserRepository) ExistsByUsername(ctx context.Context, username string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)", username).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (r *PostgresUserRepository) Create(ctx context.Context, email, passwordHash, name string) (*models.User, error) {
	var user models.User
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, name, auth_provider)
		 VALUES ($1, $2, $3, 'local')
		 RETURNING id, email, username, name, auth_provider, created_at, updated_at`,
		email, passwordHash, name,
	).Scan(&user.ID, &user.Email, &user.Username, &user.Name, &user.AuthProvider, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *PostgresUserRepository) CreateAdminUser(ctx context.Context, username, passwordHash, name string) (*models.User, error) {
	var user models.User
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (username, password_hash, name, auth_provider)
		 VALUES ($1, $2, $3, 'local')
		 RETURNING id, email, username, name, auth_provider, created_at, updated_at`,
		username, passwordHash, name,
	).Scan(&user.ID, &user.Email, &user.Username, &user.Name, &user.AuthProvider, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *PostgresUserRepository) CreateGoogleUser(ctx context.Context, email, name, googleID string) (*models.User, error) {
	var user models.User
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (email, name, auth_provider, google_id)
		 VALUES ($1, $2, 'google', $3)
		 RETURNING id, email, username, name, auth_provider, created_at, updated_at`,
		email, name, googleID,
	).Scan(&user.ID, &user.Email, &user.Username, &user.Name, &user.AuthProvider, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &user, nil
}
