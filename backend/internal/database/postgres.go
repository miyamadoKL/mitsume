package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mitsume/backend/internal/config"
)

var pool *pgxpool.Pool

func Connect(cfg *config.DatabaseConfig) error {
	connString := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.DBName, cfg.SSLMode,
	)

	var err error
	pool, err = pgxpool.New(context.Background(), connString)
	if err != nil {
		return fmt.Errorf("unable to connect to database: %w", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		return fmt.Errorf("unable to ping database: %w", err)
	}

	return nil
}

func GetPool() *pgxpool.Pool {
	return pool
}

// SetPool allows injecting a custom pool for testing purposes
func SetPool(p *pgxpool.Pool) {
	pool = p
}

func Close() {
	if pool != nil {
		pool.Close()
	}
}

func RunMigrations() error {
	ctx := context.Background()

	migrations := []string{
		`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255),
			name VARCHAR(255) NOT NULL,
			auth_provider VARCHAR(50) DEFAULT 'local',
			google_id VARCHAR(255),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS saved_queries (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			query_text TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS query_history (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			query_text TEXT NOT NULL,
			status VARCHAR(50) NOT NULL,
			execution_time_ms INTEGER,
			row_count INTEGER,
			error_message TEXT,
			executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS dashboards (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			layout JSONB NOT NULL DEFAULT '[]',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS dashboard_widgets (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			query_id UUID REFERENCES saved_queries(id) ON DELETE SET NULL,
			chart_type VARCHAR(50) NOT NULL,
			chart_config JSONB,
			position JSONB NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE INDEX IF NOT EXISTS idx_saved_queries_user_id ON saved_queries(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_query_history_user_id ON query_history(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_query_history_executed_at ON query_history(executed_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard_id ON dashboard_widgets(dashboard_id)`,

		// Notification channels (Slack, Email, Google Chat)
		`CREATE TABLE IF NOT EXISTS notification_channels (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			channel_type VARCHAR(50) NOT NULL,
			config JSONB NOT NULL,
			is_verified BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		// Dashboard subscriptions for scheduled delivery
		`CREATE TABLE IF NOT EXISTS dashboard_subscriptions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			schedule_cron VARCHAR(100) NOT NULL,
			timezone VARCHAR(100) DEFAULT 'Asia/Tokyo',
			format VARCHAR(50) DEFAULT 'pdf',
			is_active BOOLEAN DEFAULT TRUE,
			last_sent_at TIMESTAMP,
			next_run_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		// Subscription notification channels (many-to-many)
		`CREATE TABLE IF NOT EXISTS subscription_channels (
			subscription_id UUID REFERENCES dashboard_subscriptions(id) ON DELETE CASCADE,
			channel_id UUID REFERENCES notification_channels(id) ON DELETE CASCADE,
			PRIMARY KEY(subscription_id, channel_id)
		)`,

		// Query alerts for threshold monitoring
		`CREATE TABLE IF NOT EXISTS query_alerts (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			query_id UUID REFERENCES saved_queries(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			condition_column VARCHAR(255) NOT NULL,
			condition_operator VARCHAR(20) NOT NULL,
			condition_value TEXT NOT NULL,
			aggregation VARCHAR(20),
			check_interval_minutes INTEGER DEFAULT 60,
			cooldown_minutes INTEGER DEFAULT 60,
			is_active BOOLEAN DEFAULT TRUE,
			last_checked_at TIMESTAMP,
			last_triggered_at TIMESTAMP,
			next_check_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		// Alert notification channels (many-to-many)
		`CREATE TABLE IF NOT EXISTS alert_channels (
			alert_id UUID REFERENCES query_alerts(id) ON DELETE CASCADE,
			channel_id UUID REFERENCES notification_channels(id) ON DELETE CASCADE,
			PRIMARY KEY(alert_id, channel_id)
		)`,

		// Alert history for tracking triggered alerts
		`CREATE TABLE IF NOT EXISTS alert_history (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			alert_id UUID REFERENCES query_alerts(id) ON DELETE CASCADE,
			triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			condition_met_value TEXT,
			notification_status VARCHAR(50),
			notification_details JSONB,
			error_message TEXT
		)`,

		// Indexes for new tables
		`CREATE INDEX IF NOT EXISTS idx_notification_channels_user_id ON notification_channels(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON dashboard_subscriptions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_next_run ON dashboard_subscriptions(next_run_at) WHERE is_active = TRUE`,
		`CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON query_alerts(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_alerts_next_check ON query_alerts(next_check_at) WHERE is_active = TRUE`,
		`CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON alert_history(alert_id)`,
		`CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_history(triggered_at DESC)`,

		// Roles table for RBAC
		`CREATE TABLE IF NOT EXISTS roles (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) UNIQUE NOT NULL,
			description TEXT,
			is_system BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		// User-Role assignments (many-to-many)
		`CREATE TABLE IF NOT EXISTS user_roles (
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
			assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
			PRIMARY KEY(user_id, role_id)
		)`,

		// Role-Catalog permissions
		`CREATE TABLE IF NOT EXISTS role_catalog_permissions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
			catalog_name VARCHAR(255) NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(role_id, catalog_name)
		)`,

		// Indexes for RBAC tables
		`CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)`,
		`CREATE INDEX IF NOT EXISTS idx_role_catalog_permissions_role_id ON role_catalog_permissions(role_id)`,

		// Seed the admin role
		`INSERT INTO roles (name, description, is_system)
		VALUES ('admin', 'システム管理者（全カタログアクセス可能）', TRUE)
		ON CONFLICT (name) DO NOTHING`,

		// Dashboard permissions table for View/Edit sharing
		`CREATE TABLE IF NOT EXISTS dashboard_permissions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
			permission_level VARCHAR(10) NOT NULL CHECK (permission_level IN ('view', 'edit')),
			granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
			CONSTRAINT dashboard_perm_one_target CHECK (
				(user_id IS NOT NULL AND role_id IS NULL) OR
				(user_id IS NULL AND role_id IS NOT NULL)
			)
		)`,

		// Unique constraints for dashboard_permissions
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_perm_user_unique
		 ON dashboard_permissions(dashboard_id, user_id) WHERE user_id IS NOT NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_perm_role_unique
		 ON dashboard_permissions(dashboard_id, role_id) WHERE role_id IS NOT NULL`,

		// Add is_public column to dashboards for public sharing
		`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE`,

		// Indexes for dashboard_permissions
		`CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_dashboard_id ON dashboard_permissions(dashboard_id)`,
		`CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_user_id ON dashboard_permissions(user_id) WHERE user_id IS NOT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_role_id ON dashboard_permissions(role_id) WHERE role_id IS NOT NULL`,

		// Add catalog and schema to saved_queries for widget data execution
		`ALTER TABLE saved_queries ADD COLUMN IF NOT EXISTS catalog VARCHAR(255)`,
		`ALTER TABLE saved_queries ADD COLUMN IF NOT EXISTS schema_name VARCHAR(255)`,

		// Layout templates for dashboard creation
		`CREATE TABLE IF NOT EXISTS layout_templates (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			layout JSONB NOT NULL,
			is_system BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE INDEX IF NOT EXISTS idx_layout_templates_user_id ON layout_templates(user_id) WHERE user_id IS NOT NULL`,

		// Add parameters JSONB column to dashboards for typed parameter definitions
		`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '[]'`,

		// Add responsive_positions to dashboard_widgets for per-breakpoint layouts
		// Structure: {"lg": {x, y, w, h}, "md": {x, y, w, h}, "sm": {x, y, w, h}, "xs": {x, y, w, h}}
		`ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS responsive_positions JSONB`,

		// Add is_draft and draft_of columns for persistent draft functionality
		`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS draft_of UUID REFERENCES dashboards(id) ON DELETE CASCADE`,
		`CREATE INDEX IF NOT EXISTS idx_dashboards_draft_of ON dashboards(draft_of) WHERE draft_of IS NOT NULL`,

		// Phase 0.1: Ensure all drafts are private (fix any existing public drafts)
		// Only update rows that are actually public to avoid unnecessary writes on every startup
		`UPDATE dashboards SET is_public = false
		 WHERE COALESCE(is_draft, false) = true AND COALESCE(is_public, false) = true`,

		// Phase 0.2: Delete duplicate drafts (keep only the latest one per original dashboard)
		// This must run before the unique index creation
		`DELETE FROM dashboards d
		 USING (
		   SELECT id,
		          ROW_NUMBER() OVER (PARTITION BY draft_of ORDER BY updated_at DESC, created_at DESC) AS rn
		   FROM dashboards
		   WHERE COALESCE(is_draft, false) = true AND draft_of IS NOT NULL
		 ) x
		 WHERE d.id = x.id AND x.rn > 1`,

		// Phase 0.2: Add unique constraint to ensure only one draft per dashboard
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboards_draft_of_unique
		 ON dashboards(draft_of)
		 WHERE COALESCE(is_draft, false) = true AND draft_of IS NOT NULL`,

		// Ensure first user has admin role (safety net if auto-assign failed)
		// Only runs if there are users but no admin assignments
		`INSERT INTO user_roles (user_id, role_id, assigned_at)
		 SELECT u.id, r.id, NOW()
		 FROM users u
		 CROSS JOIN roles r
		 WHERE r.name = 'admin'
		   AND NOT EXISTS (SELECT 1 FROM user_roles ur INNER JOIN roles r2 ON ur.role_id = r2.id WHERE r2.name = 'admin')
		 ORDER BY u.created_at ASC
		 LIMIT 1
		 ON CONFLICT (user_id, role_id) DO NOTHING`,

		// Add username column for admin users (who don't have email)
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE`,

		// Make email nullable for admin users
		`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`,

		// User status for admin approval system
		// status: 'pending' (waiting for approval), 'active' (approved), 'disabled' (deactivated)
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL`,

		// Set existing users to 'active' status (migration safety)
		`UPDATE users SET status = 'active' WHERE status IS NULL`,

		// Add index for status queries
		`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`,
	}

	for _, migration := range migrations {
		if _, err := pool.Exec(ctx, migration); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	return nil
}
