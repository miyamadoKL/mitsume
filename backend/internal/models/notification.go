package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ChannelType represents the type of notification channel
type ChannelType string

const (
	ChannelTypeSlack      ChannelType = "slack"
	ChannelTypeEmail      ChannelType = "email"
	ChannelTypeGoogleChat ChannelType = "google_chat"
)

// NotificationChannel represents a configured notification destination
type NotificationChannel struct {
	ID          uuid.UUID       `json:"id"`
	UserID      uuid.UUID       `json:"user_id"`
	Name        string          `json:"name"`
	ChannelType ChannelType     `json:"channel_type"`
	Config      json.RawMessage `json:"config"`
	IsVerified  bool            `json:"is_verified"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// SlackChannelConfig for Slack webhook configuration
type SlackChannelConfig struct {
	WebhookURL string `json:"webhook_url"`
	Channel    string `json:"channel,omitempty"`
}

// EmailChannelConfig for email notification configuration
type EmailChannelConfig struct {
	Recipients []string `json:"recipients"`
	Subject    string   `json:"subject,omitempty"`
}

// GoogleChatChannelConfig for Google Chat webhook configuration
type GoogleChatChannelConfig struct {
	WebhookURL string `json:"webhook_url"`
}

// CreateNotificationChannelRequest is the request body for creating a notification channel
type CreateNotificationChannelRequest struct {
	Name        string          `json:"name" binding:"required"`
	ChannelType ChannelType     `json:"channel_type" binding:"required"`
	Config      json.RawMessage `json:"config" binding:"required"`
}

// UpdateNotificationChannelRequest is the request body for updating a notification channel
type UpdateNotificationChannelRequest struct {
	Name   string          `json:"name,omitempty"`
	Config json.RawMessage `json:"config,omitempty"`
}
