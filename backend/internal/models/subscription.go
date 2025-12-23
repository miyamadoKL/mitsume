package models

import (
	"time"

	"github.com/google/uuid"
)

// SubscriptionFormat represents the export format for subscriptions
type SubscriptionFormat string

const (
	SubscriptionFormatPDF   SubscriptionFormat = "pdf"
	SubscriptionFormatImage SubscriptionFormat = "image"
)

// DashboardSubscription represents a scheduled dashboard delivery
type DashboardSubscription struct {
	ID          uuid.UUID          `json:"id"`
	UserID      uuid.UUID          `json:"user_id"`
	DashboardID uuid.UUID          `json:"dashboard_id"`
	Name        string             `json:"name"`
	ScheduleCron string            `json:"schedule_cron"`
	Timezone    string             `json:"timezone"`
	Format      SubscriptionFormat `json:"format"`
	IsActive    bool               `json:"is_active"`
	LastSentAt  *time.Time         `json:"last_sent_at"`
	NextRunAt   *time.Time         `json:"next_run_at"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
	ChannelIDs  []uuid.UUID        `json:"channel_ids,omitempty"`
}

// CreateSubscriptionRequest is the request body for creating a subscription
type CreateSubscriptionRequest struct {
	DashboardID  uuid.UUID          `json:"dashboard_id" binding:"required"`
	Name         string             `json:"name" binding:"required"`
	ScheduleCron string             `json:"schedule_cron" binding:"required"`
	Timezone     string             `json:"timezone"`
	Format       SubscriptionFormat `json:"format"`
	ChannelIDs   []uuid.UUID        `json:"channel_ids" binding:"required"`
}

// UpdateSubscriptionRequest is the request body for updating a subscription
type UpdateSubscriptionRequest struct {
	Name         string             `json:"name,omitempty"`
	ScheduleCron string             `json:"schedule_cron,omitempty"`
	Timezone     string             `json:"timezone,omitempty"`
	Format       SubscriptionFormat `json:"format,omitempty"`
	IsActive     *bool              `json:"is_active,omitempty"`
	ChannelIDs   []uuid.UUID        `json:"channel_ids,omitempty"`
}
