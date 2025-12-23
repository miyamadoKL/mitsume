package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ConditionOperator represents alert condition operators
type ConditionOperator string

const (
	OperatorGreaterThan    ConditionOperator = "gt"
	OperatorLessThan       ConditionOperator = "lt"
	OperatorEquals         ConditionOperator = "eq"
	OperatorGreaterOrEqual ConditionOperator = "gte"
	OperatorLessOrEqual    ConditionOperator = "lte"
	OperatorNotEquals      ConditionOperator = "neq"
	OperatorContains       ConditionOperator = "contains"
)

// Aggregation represents how to aggregate query results
type Aggregation string

const (
	AggregationSum   Aggregation = "sum"
	AggregationAvg   Aggregation = "avg"
	AggregationCount Aggregation = "count"
	AggregationMin   Aggregation = "min"
	AggregationMax   Aggregation = "max"
	AggregationFirst Aggregation = "first"
)

// QueryAlert represents a threshold-based alert
type QueryAlert struct {
	ID                   uuid.UUID         `json:"id"`
	UserID               uuid.UUID         `json:"user_id"`
	QueryID              uuid.UUID         `json:"query_id"`
	Name                 string            `json:"name"`
	Description          *string           `json:"description"`
	ConditionColumn      string            `json:"condition_column"`
	ConditionOperator    ConditionOperator `json:"condition_operator"`
	ConditionValue       string            `json:"condition_value"`
	Aggregation          *Aggregation      `json:"aggregation"`
	CheckIntervalMinutes int               `json:"check_interval_minutes"`
	CooldownMinutes      int               `json:"cooldown_minutes"`
	IsActive             bool              `json:"is_active"`
	LastCheckedAt        *time.Time        `json:"last_checked_at"`
	LastTriggeredAt      *time.Time        `json:"last_triggered_at"`
	NextCheckAt          *time.Time        `json:"next_check_at"`
	CreatedAt            time.Time         `json:"created_at"`
	UpdatedAt            time.Time         `json:"updated_at"`
	ChannelIDs           []uuid.UUID       `json:"channel_ids,omitempty"`
}

// CreateAlertRequest is the request body for creating an alert
type CreateAlertRequest struct {
	QueryID              uuid.UUID         `json:"query_id" binding:"required"`
	Name                 string            `json:"name" binding:"required"`
	Description          *string           `json:"description"`
	ConditionColumn      string            `json:"condition_column" binding:"required"`
	ConditionOperator    ConditionOperator `json:"condition_operator" binding:"required"`
	ConditionValue       string            `json:"condition_value" binding:"required"`
	Aggregation          *Aggregation      `json:"aggregation"`
	CheckIntervalMinutes int               `json:"check_interval_minutes"`
	CooldownMinutes      int               `json:"cooldown_minutes"`
	ChannelIDs           []uuid.UUID       `json:"channel_ids" binding:"required"`
}

// UpdateAlertRequest is the request body for updating an alert
type UpdateAlertRequest struct {
	Name                 string            `json:"name,omitempty"`
	Description          *string           `json:"description,omitempty"`
	ConditionColumn      string            `json:"condition_column,omitempty"`
	ConditionOperator    ConditionOperator `json:"condition_operator,omitempty"`
	ConditionValue       string            `json:"condition_value,omitempty"`
	Aggregation          *Aggregation      `json:"aggregation,omitempty"`
	CheckIntervalMinutes int               `json:"check_interval_minutes,omitempty"`
	CooldownMinutes      int               `json:"cooldown_minutes,omitempty"`
	IsActive             *bool             `json:"is_active,omitempty"`
	ChannelIDs           []uuid.UUID       `json:"channel_ids,omitempty"`
}

// AlertHistory records triggered alert events
type AlertHistory struct {
	ID                  uuid.UUID       `json:"id"`
	AlertID             uuid.UUID       `json:"alert_id"`
	TriggeredAt         time.Time       `json:"triggered_at"`
	ConditionMetValue   string          `json:"condition_met_value"`
	NotificationStatus  string          `json:"notification_status"`
	NotificationDetails json.RawMessage `json:"notification_details"`
	ErrorMessage        *string         `json:"error_message"`
}

// NotificationMessage represents a notification payload
type NotificationMessage struct {
	Title       string
	Body        string
	Attachments []NotificationAttachment
}

// NotificationAttachment represents a file attachment for notifications
type NotificationAttachment struct {
	Filename    string
	ContentType string
	Data        []byte
}
