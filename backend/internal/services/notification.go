package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/models"
)

// Notifier interface for sending notifications
type Notifier interface {
	Send(ctx context.Context, config json.RawMessage, msg models.NotificationMessage) error
	ValidateConfig(config json.RawMessage) error
}

// NotificationService manages notification channels and sending
type NotificationService struct {
	pool               *pgxpool.Pool
	slackNotifier      *SlackNotifier
	emailNotifier      *EmailNotifier
	googleChatNotifier *GoogleChatNotifier
}

// NewNotificationService creates a new notification service
func NewNotificationService(pool *pgxpool.Pool, cfg *config.NotificationConfig) *NotificationService {
	return &NotificationService{
		pool:               pool,
		slackNotifier:      NewSlackNotifier(),
		emailNotifier:      NewEmailNotifier(&cfg.SMTP),
		googleChatNotifier: NewGoogleChatNotifier(),
	}
}

// GetChannels returns all notification channels for a user
func (s *NotificationService) GetChannels(ctx context.Context, userID uuid.UUID) ([]models.NotificationChannel, error) {
	query := `
		SELECT id, user_id, name, channel_type, config, is_verified, created_at, updated_at
		FROM notification_channels
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := s.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query notification channels: %w", err)
	}
	defer rows.Close()

	var channels []models.NotificationChannel
	for rows.Next() {
		var ch models.NotificationChannel
		if err := rows.Scan(&ch.ID, &ch.UserID, &ch.Name, &ch.ChannelType, &ch.Config, &ch.IsVerified, &ch.CreatedAt, &ch.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan notification channel: %w", err)
		}
		channels = append(channels, ch)
	}

	return channels, nil
}

// GetChannelByID returns a notification channel by ID
func (s *NotificationService) GetChannelByID(ctx context.Context, id uuid.UUID) (*models.NotificationChannel, error) {
	query := `
		SELECT id, user_id, name, channel_type, config, is_verified, created_at, updated_at
		FROM notification_channels
		WHERE id = $1
	`

	var ch models.NotificationChannel
	err := s.pool.QueryRow(ctx, query, id).Scan(&ch.ID, &ch.UserID, &ch.Name, &ch.ChannelType, &ch.Config, &ch.IsVerified, &ch.CreatedAt, &ch.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to get notification channel: %w", err)
	}

	return &ch, nil
}

// CreateChannel creates a new notification channel
func (s *NotificationService) CreateChannel(ctx context.Context, userID uuid.UUID, req *models.CreateNotificationChannelRequest) (*models.NotificationChannel, error) {
	// Validate config based on channel type
	if err := s.validateChannelConfig(req.ChannelType, req.Config); err != nil {
		return nil, fmt.Errorf("invalid channel config: %w", err)
	}

	query := `
		INSERT INTO notification_channels (user_id, name, channel_type, config)
		VALUES ($1, $2, $3, $4)
		RETURNING id, user_id, name, channel_type, config, is_verified, created_at, updated_at
	`

	var ch models.NotificationChannel
	err := s.pool.QueryRow(ctx, query, userID, req.Name, req.ChannelType, req.Config).Scan(
		&ch.ID, &ch.UserID, &ch.Name, &ch.ChannelType, &ch.Config, &ch.IsVerified, &ch.CreatedAt, &ch.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create notification channel: %w", err)
	}

	return &ch, nil
}

// UpdateChannel updates a notification channel
func (s *NotificationService) UpdateChannel(ctx context.Context, id uuid.UUID, userID uuid.UUID, req *models.UpdateNotificationChannelRequest) (*models.NotificationChannel, error) {
	// Get existing channel to check ownership and get channel type
	existing, err := s.GetChannelByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if existing.UserID != userID {
		return nil, fmt.Errorf("not authorized to update this channel")
	}

	// Validate config if provided
	if req.Config != nil {
		if err := s.validateChannelConfig(existing.ChannelType, req.Config); err != nil {
			return nil, fmt.Errorf("invalid channel config: %w", err)
		}
	}

	name := existing.Name
	if req.Name != "" {
		name = req.Name
	}

	config := existing.Config
	if req.Config != nil {
		config = req.Config
	}

	query := `
		UPDATE notification_channels
		SET name = $1, config = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
		RETURNING id, user_id, name, channel_type, config, is_verified, created_at, updated_at
	`

	var ch models.NotificationChannel
	err = s.pool.QueryRow(ctx, query, name, config, id).Scan(
		&ch.ID, &ch.UserID, &ch.Name, &ch.ChannelType, &ch.Config, &ch.IsVerified, &ch.CreatedAt, &ch.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update notification channel: %w", err)
	}

	return &ch, nil
}

// DeleteChannel deletes a notification channel
func (s *NotificationService) DeleteChannel(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM notification_channels WHERE id = $1 AND user_id = $2`

	result, err := s.pool.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete notification channel: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("notification channel not found or not authorized")
	}

	return nil
}

// TestChannel sends a test notification to a channel
func (s *NotificationService) TestChannel(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	channel, err := s.GetChannelByID(ctx, id)
	if err != nil {
		return err
	}

	if channel.UserID != userID {
		return fmt.Errorf("not authorized to test this channel")
	}

	msg := models.NotificationMessage{
		Title: "Mitsume Test Notification",
		Body:  fmt.Sprintf("This is a test notification from Mitsume sent at %s", time.Now().Format(time.RFC3339)),
	}

	if err := s.Send(ctx, channel, msg); err != nil {
		return fmt.Errorf("test notification failed: %w", err)
	}

	// Mark channel as verified
	_, err = s.pool.Exec(ctx, "UPDATE notification_channels SET is_verified = TRUE WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to mark channel as verified: %w", err)
	}

	return nil
}

// Send sends a notification to a channel
func (s *NotificationService) Send(ctx context.Context, channel *models.NotificationChannel, msg models.NotificationMessage) error {
	switch channel.ChannelType {
	case models.ChannelTypeSlack:
		return s.slackNotifier.Send(ctx, channel.Config, msg)
	case models.ChannelTypeEmail:
		return s.emailNotifier.Send(ctx, channel.Config, msg)
	case models.ChannelTypeGoogleChat:
		return s.googleChatNotifier.Send(ctx, channel.Config, msg)
	default:
		return fmt.Errorf("unsupported channel type: %s", channel.ChannelType)
	}
}

// SendToChannels sends a notification to multiple channels
func (s *NotificationService) SendToChannels(ctx context.Context, channelIDs []uuid.UUID, msg models.NotificationMessage) map[uuid.UUID]error {
	results := make(map[uuid.UUID]error)

	for _, channelID := range channelIDs {
		channel, err := s.GetChannelByID(ctx, channelID)
		if err != nil {
			results[channelID] = err
			continue
		}

		if err := s.Send(ctx, channel, msg); err != nil {
			results[channelID] = err
		} else {
			results[channelID] = nil
		}
	}

	return results
}

func (s *NotificationService) validateChannelConfig(channelType models.ChannelType, config json.RawMessage) error {
	switch channelType {
	case models.ChannelTypeSlack:
		return s.slackNotifier.ValidateConfig(config)
	case models.ChannelTypeEmail:
		return s.emailNotifier.ValidateConfig(config)
	case models.ChannelTypeGoogleChat:
		return s.googleChatNotifier.ValidateConfig(config)
	default:
		return fmt.Errorf("unsupported channel type: %s", channelType)
	}
}
