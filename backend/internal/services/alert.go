package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mitsume/backend/internal/models"
)

// AlertService manages query alerts
type AlertService struct {
	pool                *pgxpool.Pool
	trinoService        *CachedTrinoService
	notificationService *NotificationService
	queryService        *QueryService
}

// NewAlertService creates a new alert service
func NewAlertService(pool *pgxpool.Pool, trinoService *CachedTrinoService, notificationService *NotificationService, queryService *QueryService) *AlertService {
	return &AlertService{
		pool:                pool,
		trinoService:        trinoService,
		notificationService: notificationService,
		queryService:        queryService,
	}
}

// GetAlerts returns all alerts for a user
func (s *AlertService) GetAlerts(ctx context.Context, userID uuid.UUID) ([]models.QueryAlert, error) {
	query := `
		SELECT id, user_id, query_id, name, description, condition_column, condition_operator,
		       condition_value, aggregation, check_interval_minutes, cooldown_minutes, is_active,
		       last_checked_at, last_triggered_at, next_check_at, created_at, updated_at
		FROM query_alerts
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := s.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query alerts: %w", err)
	}
	defer rows.Close()

	var alerts []models.QueryAlert
	for rows.Next() {
		var a models.QueryAlert
		var aggregation *string
		if err := rows.Scan(&a.ID, &a.UserID, &a.QueryID, &a.Name, &a.Description, &a.ConditionColumn,
			&a.ConditionOperator, &a.ConditionValue, &aggregation, &a.CheckIntervalMinutes, &a.CooldownMinutes,
			&a.IsActive, &a.LastCheckedAt, &a.LastTriggeredAt, &a.NextCheckAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan alert: %w", err)
		}
		if aggregation != nil {
			agg := models.Aggregation(*aggregation)
			a.Aggregation = &agg
		}

		// Get channel IDs
		channelIDs, err := s.getAlertChannelIDs(ctx, a.ID)
		if err != nil {
			return nil, err
		}
		a.ChannelIDs = channelIDs

		alerts = append(alerts, a)
	}

	return alerts, nil
}

// GetAlertByID returns an alert by ID
func (s *AlertService) GetAlertByID(ctx context.Context, id uuid.UUID) (*models.QueryAlert, error) {
	query := `
		SELECT id, user_id, query_id, name, description, condition_column, condition_operator,
		       condition_value, aggregation, check_interval_minutes, cooldown_minutes, is_active,
		       last_checked_at, last_triggered_at, next_check_at, created_at, updated_at
		FROM query_alerts
		WHERE id = $1
	`

	var a models.QueryAlert
	var aggregation *string
	err := s.pool.QueryRow(ctx, query, id).Scan(&a.ID, &a.UserID, &a.QueryID, &a.Name, &a.Description,
		&a.ConditionColumn, &a.ConditionOperator, &a.ConditionValue, &aggregation,
		&a.CheckIntervalMinutes, &a.CooldownMinutes, &a.IsActive, &a.LastCheckedAt,
		&a.LastTriggeredAt, &a.NextCheckAt, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert: %w", err)
	}

	if aggregation != nil {
		agg := models.Aggregation(*aggregation)
		a.Aggregation = &agg
	}

	// Get channel IDs
	channelIDs, err := s.getAlertChannelIDs(ctx, a.ID)
	if err != nil {
		return nil, err
	}
	a.ChannelIDs = channelIDs

	return &a, nil
}

// CreateAlert creates a new alert
func (s *AlertService) CreateAlert(ctx context.Context, userID uuid.UUID, req *models.CreateAlertRequest) (*models.QueryAlert, error) {
	// Set defaults
	checkInterval := req.CheckIntervalMinutes
	if checkInterval <= 0 {
		checkInterval = 60
	}
	cooldown := req.CooldownMinutes
	if cooldown <= 0 {
		cooldown = 60
	}

	nextCheckAt := time.Now().Add(time.Duration(checkInterval) * time.Minute)

	var aggregation *string
	if req.Aggregation != nil {
		agg := string(*req.Aggregation)
		aggregation = &agg
	}

	query := `
		INSERT INTO query_alerts (user_id, query_id, name, description, condition_column, condition_operator,
		                          condition_value, aggregation, check_interval_minutes, cooldown_minutes, next_check_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, user_id, query_id, name, description, condition_column, condition_operator,
		          condition_value, aggregation, check_interval_minutes, cooldown_minutes, is_active,
		          last_checked_at, last_triggered_at, next_check_at, created_at, updated_at
	`

	var a models.QueryAlert
	var returnedAggregation *string
	err := s.pool.QueryRow(ctx, query, userID, req.QueryID, req.Name, req.Description, req.ConditionColumn,
		req.ConditionOperator, req.ConditionValue, aggregation, checkInterval, cooldown, nextCheckAt).Scan(
		&a.ID, &a.UserID, &a.QueryID, &a.Name, &a.Description, &a.ConditionColumn, &a.ConditionOperator,
		&a.ConditionValue, &returnedAggregation, &a.CheckIntervalMinutes, &a.CooldownMinutes, &a.IsActive,
		&a.LastCheckedAt, &a.LastTriggeredAt, &a.NextCheckAt, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create alert: %w", err)
	}

	if returnedAggregation != nil {
		agg := models.Aggregation(*returnedAggregation)
		a.Aggregation = &agg
	}

	// Add channel associations
	if err := s.setAlertChannels(ctx, a.ID, req.ChannelIDs); err != nil {
		return nil, err
	}
	a.ChannelIDs = req.ChannelIDs

	return &a, nil
}

// UpdateAlert updates an alert
func (s *AlertService) UpdateAlert(ctx context.Context, id uuid.UUID, userID uuid.UUID, req *models.UpdateAlertRequest) (*models.QueryAlert, error) {
	existing, err := s.GetAlertByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if existing.UserID != userID {
		return nil, fmt.Errorf("not authorized to update this alert")
	}

	// Apply updates
	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Description != nil {
		existing.Description = req.Description
	}
	if req.ConditionColumn != "" {
		existing.ConditionColumn = req.ConditionColumn
	}
	if req.ConditionOperator != "" {
		existing.ConditionOperator = req.ConditionOperator
	}
	if req.ConditionValue != "" {
		existing.ConditionValue = req.ConditionValue
	}
	if req.Aggregation != nil {
		existing.Aggregation = req.Aggregation
	}
	if req.CheckIntervalMinutes > 0 {
		existing.CheckIntervalMinutes = req.CheckIntervalMinutes
	}
	if req.CooldownMinutes > 0 {
		existing.CooldownMinutes = req.CooldownMinutes
	}
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}

	var aggregation *string
	if existing.Aggregation != nil {
		agg := string(*existing.Aggregation)
		aggregation = &agg
	}

	query := `
		UPDATE query_alerts
		SET name = $1, description = $2, condition_column = $3, condition_operator = $4,
		    condition_value = $5, aggregation = $6, check_interval_minutes = $7, cooldown_minutes = $8,
		    is_active = $9, updated_at = CURRENT_TIMESTAMP
		WHERE id = $10
		RETURNING id, user_id, query_id, name, description, condition_column, condition_operator,
		          condition_value, aggregation, check_interval_minutes, cooldown_minutes, is_active,
		          last_checked_at, last_triggered_at, next_check_at, created_at, updated_at
	`

	var a models.QueryAlert
	var returnedAggregation *string
	err = s.pool.QueryRow(ctx, query, existing.Name, existing.Description, existing.ConditionColumn,
		existing.ConditionOperator, existing.ConditionValue, aggregation, existing.CheckIntervalMinutes,
		existing.CooldownMinutes, existing.IsActive, id).Scan(
		&a.ID, &a.UserID, &a.QueryID, &a.Name, &a.Description, &a.ConditionColumn, &a.ConditionOperator,
		&a.ConditionValue, &returnedAggregation, &a.CheckIntervalMinutes, &a.CooldownMinutes, &a.IsActive,
		&a.LastCheckedAt, &a.LastTriggeredAt, &a.NextCheckAt, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to update alert: %w", err)
	}

	if returnedAggregation != nil {
		agg := models.Aggregation(*returnedAggregation)
		a.Aggregation = &agg
	}

	// Update channel associations if provided
	if len(req.ChannelIDs) > 0 {
		if err := s.setAlertChannels(ctx, a.ID, req.ChannelIDs); err != nil {
			return nil, err
		}
		a.ChannelIDs = req.ChannelIDs
	} else {
		channelIDs, _ := s.getAlertChannelIDs(ctx, a.ID)
		a.ChannelIDs = channelIDs
	}

	return &a, nil
}

// DeleteAlert deletes an alert
func (s *AlertService) DeleteAlert(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM query_alerts WHERE id = $1 AND user_id = $2`

	result, err := s.pool.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete alert: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("alert not found or not authorized")
	}

	return nil
}

// TestAlert runs the alert query and checks the condition
func (s *AlertService) TestAlert(ctx context.Context, id uuid.UUID, userID uuid.UUID) (bool, string, error) {
	alert, err := s.GetAlertByID(ctx, id)
	if err != nil {
		return false, "", err
	}

	if alert.UserID != userID {
		return false, "", fmt.Errorf("not authorized to test this alert")
	}

	return s.EvaluateAlert(ctx, alert)
}

// EvaluateAlert runs the query and checks the condition
func (s *AlertService) EvaluateAlert(ctx context.Context, alert *models.QueryAlert) (bool, string, error) {
	// Get the saved query
	savedQuery, err := s.queryService.GetSavedQueryByID(ctx, alert.QueryID)
	if err != nil {
		return false, "", fmt.Errorf("failed to get saved query: %w", err)
	}

	// Get catalog and schema from saved query
	catalog := ""
	schema := ""
	if savedQuery.Catalog != nil {
		catalog = *savedQuery.Catalog
	}
	if savedQuery.SchemaName != nil {
		schema = *savedQuery.SchemaName
	}

	// Execute the query with caching (HIGH priority for scheduled alerts)
	result, err := s.trinoService.ExecuteQueryWithCache(ctx, savedQuery.QueryText, catalog, schema, int(CachePriorityHigh), &alert.QueryID)
	if err != nil {
		return false, "", fmt.Errorf("failed to execute query: %w", err)
	}

	if len(result.Rows) == 0 {
		return false, "", nil // No data, no alert
	}

	// Find column index
	colIdx := -1
	for i, col := range result.Columns {
		if col == alert.ConditionColumn {
			colIdx = i
			break
		}
	}
	if colIdx == -1 {
		return false, "", fmt.Errorf("column %s not found in query results", alert.ConditionColumn)
	}

	// Get value to check (with optional aggregation)
	value, err := s.aggregateValue(result.Rows, colIdx, alert.Aggregation)
	if err != nil {
		return false, "", fmt.Errorf("failed to aggregate value: %w", err)
	}

	// Check condition
	triggered := s.checkCondition(value, alert.ConditionOperator, alert.ConditionValue)
	return triggered, fmt.Sprintf("%v", value), nil
}

// GetDueAlerts returns alerts that are due for checking
func (s *AlertService) GetDueAlerts(ctx context.Context) ([]models.QueryAlert, error) {
	query := `
		SELECT id, user_id, query_id, name, description, condition_column, condition_operator,
		       condition_value, aggregation, check_interval_minutes, cooldown_minutes, is_active,
		       last_checked_at, last_triggered_at, next_check_at, created_at, updated_at
		FROM query_alerts
		WHERE is_active = TRUE AND (next_check_at IS NULL OR next_check_at <= CURRENT_TIMESTAMP)
		ORDER BY next_check_at ASC
		LIMIT 100
	`

	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query due alerts: %w", err)
	}
	defer rows.Close()

	var alerts []models.QueryAlert
	for rows.Next() {
		var a models.QueryAlert
		var aggregation *string
		if err := rows.Scan(&a.ID, &a.UserID, &a.QueryID, &a.Name, &a.Description, &a.ConditionColumn,
			&a.ConditionOperator, &a.ConditionValue, &aggregation, &a.CheckIntervalMinutes, &a.CooldownMinutes,
			&a.IsActive, &a.LastCheckedAt, &a.LastTriggeredAt, &a.NextCheckAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan alert: %w", err)
		}
		if aggregation != nil {
			agg := models.Aggregation(*aggregation)
			a.Aggregation = &agg
		}

		// Get channel IDs
		channelIDs, _ := s.getAlertChannelIDs(ctx, a.ID)
		a.ChannelIDs = channelIDs

		alerts = append(alerts, a)
	}

	return alerts, nil
}

// UpdateAlertAfterCheck updates alert timestamps after checking
func (s *AlertService) UpdateAlertAfterCheck(ctx context.Context, alertID uuid.UUID, triggered bool, nextCheckAt time.Time) error {
	var query string
	if triggered {
		query = `
			UPDATE query_alerts
			SET last_checked_at = CURRENT_TIMESTAMP, last_triggered_at = CURRENT_TIMESTAMP, next_check_at = $2
			WHERE id = $1
		`
	} else {
		query = `
			UPDATE query_alerts
			SET last_checked_at = CURRENT_TIMESTAMP, next_check_at = $2
			WHERE id = $1
		`
	}

	_, err := s.pool.Exec(ctx, query, alertID, nextCheckAt)
	return err
}

// RecordAlertHistory records an alert trigger event
func (s *AlertService) RecordAlertHistory(ctx context.Context, alertID uuid.UUID, conditionValue string, status string, details map[string]interface{}, errorMsg *string) error {
	detailsJSON, _ := json.Marshal(details)

	query := `
		INSERT INTO alert_history (alert_id, condition_met_value, notification_status, notification_details, error_message)
		VALUES ($1, $2, $3, $4, $5)
	`

	_, err := s.pool.Exec(ctx, query, alertID, conditionValue, status, detailsJSON, errorMsg)
	return err
}

// GetAlertHistory returns the history of triggered alerts
func (s *AlertService) GetAlertHistory(ctx context.Context, alertID uuid.UUID, limit int) ([]models.AlertHistory, error) {
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT id, alert_id, triggered_at, condition_met_value, notification_status, notification_details, error_message
		FROM alert_history
		WHERE alert_id = $1
		ORDER BY triggered_at DESC
		LIMIT $2
	`

	rows, err := s.pool.Query(ctx, query, alertID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query alert history: %w", err)
	}
	defer rows.Close()

	var history []models.AlertHistory
	for rows.Next() {
		var h models.AlertHistory
		if err := rows.Scan(&h.ID, &h.AlertID, &h.TriggeredAt, &h.ConditionMetValue,
			&h.NotificationStatus, &h.NotificationDetails, &h.ErrorMessage); err != nil {
			return nil, fmt.Errorf("failed to scan alert history: %w", err)
		}
		history = append(history, h)
	}

	return history, nil
}

// GetAlertChannels returns the notification channels associated with an alert
func (s *AlertService) GetAlertChannels(ctx context.Context, alertID uuid.UUID) ([]models.NotificationChannel, error) {
	query := `
		SELECT nc.id, nc.user_id, nc.name, nc.channel_type, nc.config, nc.is_verified, nc.created_at, nc.updated_at
		FROM notification_channels nc
		INNER JOIN alert_channels ac ON nc.id = ac.channel_id
		WHERE ac.alert_id = $1
	`
	rows, err := s.pool.Query(ctx, query, alertID)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert channels: %w", err)
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

func (s *AlertService) getAlertChannelIDs(ctx context.Context, alertID uuid.UUID) ([]uuid.UUID, error) {
	query := `SELECT channel_id FROM alert_channels WHERE alert_id = $1`
	rows, err := s.pool.Query(ctx, query, alertID)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert channels: %w", err)
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

func (s *AlertService) setAlertChannels(ctx context.Context, alertID uuid.UUID, channelIDs []uuid.UUID) error {
	// Delete existing associations
	_, err := s.pool.Exec(ctx, "DELETE FROM alert_channels WHERE alert_id = $1", alertID)
	if err != nil {
		return fmt.Errorf("failed to clear alert channels: %w", err)
	}

	// Insert new associations
	for _, channelID := range channelIDs {
		_, err := s.pool.Exec(ctx, "INSERT INTO alert_channels (alert_id, channel_id) VALUES ($1, $2)", alertID, channelID)
		if err != nil {
			return fmt.Errorf("failed to add alert channel: %w", err)
		}
	}

	return nil
}

func (s *AlertService) aggregateValue(rows [][]interface{}, colIdx int, agg *models.Aggregation) (interface{}, error) {
	if agg == nil || *agg == models.AggregationFirst {
		return rows[0][colIdx], nil
	}

	// Extract numeric values
	var values []float64
	for _, row := range rows {
		val := row[colIdx]
		if val == nil {
			continue
		}
		switch v := val.(type) {
		case float64:
			values = append(values, v)
		case float32:
			values = append(values, float64(v))
		case int:
			values = append(values, float64(v))
		case int64:
			values = append(values, float64(v))
		case int32:
			values = append(values, float64(v))
		case string:
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				values = append(values, f)
			}
		}
	}

	if len(values) == 0 {
		return nil, fmt.Errorf("no numeric values found for aggregation")
	}

	switch *agg {
	case models.AggregationSum:
		var sum float64
		for _, v := range values {
			sum += v
		}
		return sum, nil
	case models.AggregationAvg:
		var sum float64
		for _, v := range values {
			sum += v
		}
		return sum / float64(len(values)), nil
	case models.AggregationCount:
		return float64(len(values)), nil
	case models.AggregationMin:
		min := values[0]
		for _, v := range values[1:] {
			if v < min {
				min = v
			}
		}
		return min, nil
	case models.AggregationMax:
		max := values[0]
		for _, v := range values[1:] {
			if v > max {
				max = v
			}
		}
		return max, nil
	default:
		return values[0], nil
	}
}

func (s *AlertService) checkCondition(value interface{}, op models.ConditionOperator, threshold string) bool {
	if value == nil {
		return false
	}

	// Try numeric comparison
	var numValue float64
	switch v := value.(type) {
	case float64:
		numValue = v
	case float32:
		numValue = float64(v)
	case int:
		numValue = float64(v)
	case int64:
		numValue = float64(v)
	case int32:
		numValue = float64(v)
	case string:
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			numValue = f
		} else {
			// String comparison for contains
			if op == models.OperatorContains {
				return strings.Contains(v, threshold)
			}
			// String equality
			if op == models.OperatorEquals {
				return v == threshold
			}
			if op == models.OperatorNotEquals {
				return v != threshold
			}
			return false
		}
	default:
		return false
	}

	thresholdNum, err := strconv.ParseFloat(threshold, 64)
	if err != nil {
		return false
	}

	switch op {
	case models.OperatorGreaterThan:
		return numValue > thresholdNum
	case models.OperatorLessThan:
		return numValue < thresholdNum
	case models.OperatorEquals:
		return numValue == thresholdNum
	case models.OperatorGreaterOrEqual:
		return numValue >= thresholdNum
	case models.OperatorLessOrEqual:
		return numValue <= thresholdNum
	case models.OperatorNotEquals:
		return numValue != thresholdNum
	default:
		return false
	}
}
