package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mitsume/backend/internal/models"
	"github.com/robfig/cron/v3"
)

// SubscriptionService manages dashboard subscriptions
type SubscriptionService struct {
	pool                *pgxpool.Pool
	notificationService *NotificationService
	dashboardService    *DashboardService
}

// NewSubscriptionService creates a new subscription service
func NewSubscriptionService(pool *pgxpool.Pool, notificationService *NotificationService, dashboardService *DashboardService) *SubscriptionService {
	return &SubscriptionService{
		pool:                pool,
		notificationService: notificationService,
		dashboardService:    dashboardService,
	}
}

// GetSubscriptions returns all subscriptions for a user
func (s *SubscriptionService) GetSubscriptions(ctx context.Context, userID uuid.UUID) ([]models.DashboardSubscription, error) {
	query := `
		SELECT id, user_id, dashboard_id, name, schedule_cron, timezone, format, is_active,
		       last_sent_at, next_run_at, created_at, updated_at
		FROM dashboard_subscriptions
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := s.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query subscriptions: %w", err)
	}
	defer rows.Close()

	var subscriptions []models.DashboardSubscription
	for rows.Next() {
		var sub models.DashboardSubscription
		if err := rows.Scan(&sub.ID, &sub.UserID, &sub.DashboardID, &sub.Name, &sub.ScheduleCron,
			&sub.Timezone, &sub.Format, &sub.IsActive, &sub.LastSentAt, &sub.NextRunAt,
			&sub.CreatedAt, &sub.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan subscription: %w", err)
		}

		// Get channel IDs
		channelIDs, err := s.getSubscriptionChannelIDs(ctx, sub.ID)
		if err != nil {
			return nil, err
		}
		sub.ChannelIDs = channelIDs

		subscriptions = append(subscriptions, sub)
	}

	return subscriptions, nil
}

// GetSubscriptionByID returns a subscription by ID
func (s *SubscriptionService) GetSubscriptionByID(ctx context.Context, id uuid.UUID) (*models.DashboardSubscription, error) {
	query := `
		SELECT id, user_id, dashboard_id, name, schedule_cron, timezone, format, is_active,
		       last_sent_at, next_run_at, created_at, updated_at
		FROM dashboard_subscriptions
		WHERE id = $1
	`

	var sub models.DashboardSubscription
	err := s.pool.QueryRow(ctx, query, id).Scan(&sub.ID, &sub.UserID, &sub.DashboardID,
		&sub.Name, &sub.ScheduleCron, &sub.Timezone, &sub.Format, &sub.IsActive,
		&sub.LastSentAt, &sub.NextRunAt, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}

	// Get channel IDs
	channelIDs, err := s.getSubscriptionChannelIDs(ctx, sub.ID)
	if err != nil {
		return nil, err
	}
	sub.ChannelIDs = channelIDs

	return &sub, nil
}

// CreateSubscription creates a new subscription
func (s *SubscriptionService) CreateSubscription(ctx context.Context, userID uuid.UUID, req *models.CreateSubscriptionRequest) (*models.DashboardSubscription, error) {
	// Validate cron expression
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	_, err := parser.Parse(req.ScheduleCron)
	if err != nil {
		return nil, fmt.Errorf("invalid cron expression: %w", err)
	}

	// Set defaults
	timezone := req.Timezone
	if timezone == "" {
		timezone = "Asia/Tokyo"
	}
	format := req.Format
	if format == "" {
		format = "pdf"
	}

	// Calculate next run time
	nextRunAt, err := s.calculateNextRun(req.ScheduleCron, timezone)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate next run: %w", err)
	}

	query := `
		INSERT INTO dashboard_subscriptions (user_id, dashboard_id, name, schedule_cron, timezone, format, next_run_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, dashboard_id, name, schedule_cron, timezone, format, is_active,
		          last_sent_at, next_run_at, created_at, updated_at
	`

	var sub models.DashboardSubscription
	err = s.pool.QueryRow(ctx, query, userID, req.DashboardID, req.Name, req.ScheduleCron,
		timezone, format, nextRunAt).Scan(&sub.ID, &sub.UserID, &sub.DashboardID, &sub.Name,
		&sub.ScheduleCron, &sub.Timezone, &sub.Format, &sub.IsActive, &sub.LastSentAt,
		&sub.NextRunAt, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create subscription: %w", err)
	}

	// Add channel associations
	if err := s.setSubscriptionChannels(ctx, sub.ID, req.ChannelIDs); err != nil {
		return nil, err
	}
	sub.ChannelIDs = req.ChannelIDs

	return &sub, nil
}

// UpdateSubscription updates a subscription
func (s *SubscriptionService) UpdateSubscription(ctx context.Context, id uuid.UUID, userID uuid.UUID, req *models.UpdateSubscriptionRequest) (*models.DashboardSubscription, error) {
	existing, err := s.GetSubscriptionByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if existing.UserID != userID {
		return nil, fmt.Errorf("not authorized to update this subscription")
	}

	// Apply updates
	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.ScheduleCron != "" {
		// Validate cron expression
		parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
		if _, err := parser.Parse(req.ScheduleCron); err != nil {
			return nil, fmt.Errorf("invalid cron expression: %w", err)
		}
		existing.ScheduleCron = req.ScheduleCron
	}
	if req.Timezone != "" {
		existing.Timezone = req.Timezone
	}
	if req.Format != "" {
		existing.Format = req.Format
	}
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}

	// Recalculate next run time
	nextRunAt, err := s.calculateNextRun(existing.ScheduleCron, existing.Timezone)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate next run: %w", err)
	}

	query := `
		UPDATE dashboard_subscriptions
		SET name = $1, schedule_cron = $2, timezone = $3, format = $4, is_active = $5,
		    next_run_at = $6, updated_at = CURRENT_TIMESTAMP
		WHERE id = $7
		RETURNING id, user_id, dashboard_id, name, schedule_cron, timezone, format, is_active,
		          last_sent_at, next_run_at, created_at, updated_at
	`

	var sub models.DashboardSubscription
	err = s.pool.QueryRow(ctx, query, existing.Name, existing.ScheduleCron, existing.Timezone,
		existing.Format, existing.IsActive, nextRunAt, id).Scan(&sub.ID, &sub.UserID, &sub.DashboardID,
		&sub.Name, &sub.ScheduleCron, &sub.Timezone, &sub.Format, &sub.IsActive,
		&sub.LastSentAt, &sub.NextRunAt, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to update subscription: %w", err)
	}

	// Update channel associations if provided
	if len(req.ChannelIDs) > 0 {
		if err := s.setSubscriptionChannels(ctx, sub.ID, req.ChannelIDs); err != nil {
			return nil, err
		}
		sub.ChannelIDs = req.ChannelIDs
	} else {
		channelIDs, _ := s.getSubscriptionChannelIDs(ctx, sub.ID)
		sub.ChannelIDs = channelIDs
	}

	return &sub, nil
}

// DeleteSubscription deletes a subscription
func (s *SubscriptionService) DeleteSubscription(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM dashboard_subscriptions WHERE id = $1 AND user_id = $2`

	result, err := s.pool.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete subscription: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("subscription not found or not authorized")
	}

	return nil
}

// TriggerSubscription manually triggers a subscription
func (s *SubscriptionService) TriggerSubscription(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	sub, err := s.GetSubscriptionByID(ctx, id)
	if err != nil {
		return err
	}

	if sub.UserID != userID {
		return fmt.Errorf("not authorized to trigger this subscription")
	}

	return s.ExecuteSubscription(ctx, sub)
}

// ExecuteSubscription sends the dashboard snapshot to subscribed channels
func (s *SubscriptionService) ExecuteSubscription(ctx context.Context, sub *models.DashboardSubscription) error {
	// Get channels
	channels, err := s.GetSubscriptionChannels(ctx, sub.ID)
	if err != nil {
		return fmt.Errorf("failed to get subscription channels: %w", err)
	}

	if len(channels) == 0 {
		return fmt.Errorf("no notification channels configured")
	}

	// Get dashboard info
	dashboard, err := s.dashboardService.GetDashboard(ctx, sub.DashboardID, sub.UserID)
	if err != nil {
		return fmt.Errorf("failed to get dashboard: %w", err)
	}

	// Create notification message
	msg := models.NotificationMessage{
		Title: fmt.Sprintf("Scheduled Report: %s", dashboard.Name),
		Body:  fmt.Sprintf("Dashboard report for '%s' is ready.\nFormat: %s\nSchedule: %s", dashboard.Name, sub.Format, sub.ScheduleCron),
	}

	// Send to all channels
	var lastErr error
	for _, ch := range channels {
		if err := s.notificationService.Send(ctx, &ch, msg); err != nil {
			lastErr = err
		}
	}

	return lastErr
}

// GetDueSubscriptions returns subscriptions that are due for execution
func (s *SubscriptionService) GetDueSubscriptions(ctx context.Context) ([]models.DashboardSubscription, error) {
	query := `
		SELECT id, user_id, dashboard_id, name, schedule_cron, timezone, format, is_active,
		       last_sent_at, next_run_at, created_at, updated_at
		FROM dashboard_subscriptions
		WHERE is_active = TRUE AND (next_run_at IS NULL OR next_run_at <= CURRENT_TIMESTAMP)
		ORDER BY next_run_at ASC
		LIMIT 100
	`

	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query due subscriptions: %w", err)
	}
	defer rows.Close()

	var subscriptions []models.DashboardSubscription
	for rows.Next() {
		var sub models.DashboardSubscription
		if err := rows.Scan(&sub.ID, &sub.UserID, &sub.DashboardID, &sub.Name, &sub.ScheduleCron,
			&sub.Timezone, &sub.Format, &sub.IsActive, &sub.LastSentAt, &sub.NextRunAt,
			&sub.CreatedAt, &sub.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan subscription: %w", err)
		}

		// Get channel IDs
		channelIDs, _ := s.getSubscriptionChannelIDs(ctx, sub.ID)
		sub.ChannelIDs = channelIDs

		subscriptions = append(subscriptions, sub)
	}

	return subscriptions, nil
}

// UpdateSubscriptionAfterRun updates subscription timestamps after execution
func (s *SubscriptionService) UpdateSubscriptionAfterRun(ctx context.Context, subID uuid.UUID, cronExpr, timezone string) error {
	nextRunAt, err := s.calculateNextRun(cronExpr, timezone)
	if err != nil {
		return fmt.Errorf("failed to calculate next run: %w", err)
	}

	query := `
		UPDATE dashboard_subscriptions
		SET last_sent_at = CURRENT_TIMESTAMP, next_run_at = $2
		WHERE id = $1
	`

	_, err = s.pool.Exec(ctx, query, subID, nextRunAt)
	return err
}

// GetSubscriptionChannels returns the notification channels associated with a subscription
func (s *SubscriptionService) GetSubscriptionChannels(ctx context.Context, subID uuid.UUID) ([]models.NotificationChannel, error) {
	query := `
		SELECT nc.id, nc.user_id, nc.name, nc.channel_type, nc.config, nc.is_verified, nc.created_at, nc.updated_at
		FROM notification_channels nc
		INNER JOIN subscription_channels sc ON nc.id = sc.channel_id
		WHERE sc.subscription_id = $1
	`
	rows, err := s.pool.Query(ctx, query, subID)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription channels: %w", err)
	}
	defer rows.Close()

	var channels []models.NotificationChannel
	for rows.Next() {
		var ch models.NotificationChannel
		if err := rows.Scan(&ch.ID, &ch.UserID, &ch.Name, &ch.ChannelType, &ch.Config, &ch.IsVerified, &ch.CreatedAt, &ch.UpdatedAt); err != nil {
			return nil, err
		}
		channels = append(channels, ch)
	}

	return channels, nil
}

func (s *SubscriptionService) getSubscriptionChannelIDs(ctx context.Context, subID uuid.UUID) ([]uuid.UUID, error) {
	query := `SELECT channel_id FROM subscription_channels WHERE subscription_id = $1`
	rows, err := s.pool.Query(ctx, query, subID)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription channels: %w", err)
	}
	defer rows.Close()

	var channelIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		channelIDs = append(channelIDs, id)
	}

	return channelIDs, nil
}

func (s *SubscriptionService) setSubscriptionChannels(ctx context.Context, subID uuid.UUID, channelIDs []uuid.UUID) error {
	// Delete existing associations
	_, err := s.pool.Exec(ctx, "DELETE FROM subscription_channels WHERE subscription_id = $1", subID)
	if err != nil {
		return fmt.Errorf("failed to clear subscription channels: %w", err)
	}

	// Insert new associations
	for _, channelID := range channelIDs {
		_, err := s.pool.Exec(ctx, "INSERT INTO subscription_channels (subscription_id, channel_id) VALUES ($1, $2)", subID, channelID)
		if err != nil {
			return fmt.Errorf("failed to add subscription channel: %w", err)
		}
	}

	return nil
}

func (s *SubscriptionService) calculateNextRun(cronExpr, timezone string) (time.Time, error) {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}

	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	schedule, err := parser.Parse(cronExpr)
	if err != nil {
		return time.Time{}, err
	}

	now := time.Now().In(loc)
	return schedule.Next(now), nil
}
