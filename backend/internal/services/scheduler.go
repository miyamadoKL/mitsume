package services

import (
	"context"
	"log"
	"time"

	"github.com/go-co-op/gocron/v2"
	"github.com/mitsume/backend/internal/models"
)

// Scheduler manages background jobs for alerts and subscriptions
type Scheduler struct {
	scheduler           gocron.Scheduler
	alertService        *AlertService
	subscriptionService *SubscriptionService
	notificationService *NotificationService
}

// NewScheduler creates a new scheduler instance
func NewScheduler(alertService *AlertService, subscriptionService *SubscriptionService, notificationService *NotificationService) (*Scheduler, error) {
	scheduler, err := gocron.NewScheduler()
	if err != nil {
		return nil, err
	}

	return &Scheduler{
		scheduler:           scheduler,
		alertService:        alertService,
		subscriptionService: subscriptionService,
		notificationService: notificationService,
	}, nil
}

// Start begins the scheduler
func (s *Scheduler) Start() error {
	// Process alerts every minute
	_, err := s.scheduler.NewJob(
		gocron.DurationJob(1*time.Minute),
		gocron.NewTask(s.processAlerts),
		gocron.WithName("process-alerts"),
	)
	if err != nil {
		return err
	}

	// Process subscriptions every minute
	_, err = s.scheduler.NewJob(
		gocron.DurationJob(1*time.Minute),
		gocron.NewTask(s.processSubscriptions),
		gocron.WithName("process-subscriptions"),
	)
	if err != nil {
		return err
	}

	s.scheduler.Start()
	log.Println("Scheduler started")
	return nil
}

// Stop gracefully stops the scheduler
func (s *Scheduler) Stop() error {
	return s.scheduler.Shutdown()
}

func (s *Scheduler) processAlerts() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	alerts, err := s.alertService.GetDueAlerts(ctx)
	if err != nil {
		log.Printf("Failed to get due alerts: %v", err)
		return
	}

	for i := range alerts {
		s.processAlert(ctx, &alerts[i])
	}
}

func (s *Scheduler) processAlert(ctx context.Context, alert *models.QueryAlert) {
	// Evaluate the alert
	triggered, value, err := s.alertService.EvaluateAlert(ctx, alert)
	if err != nil {
		log.Printf("Failed to evaluate alert %s: %v", alert.ID, err)
		errMsg := err.Error()
		_ = s.alertService.RecordAlertHistory(ctx, alert.ID, "", "error", nil, &errMsg)
		return
	}

	// Calculate next check time
	nextCheckAt := time.Now().Add(time.Duration(alert.CheckIntervalMinutes) * time.Minute)

	if triggered {
		// Check cooldown
		if alert.LastTriggeredAt != nil {
			cooldownEnd := alert.LastTriggeredAt.Add(time.Duration(alert.CooldownMinutes) * time.Minute)
			if time.Now().Before(cooldownEnd) {
				// Still in cooldown, skip notification but update check time
				_ = s.alertService.UpdateAlertAfterCheck(ctx, alert.ID, false, nextCheckAt)
				return
			}
		}

		// Get channels and send notifications
		channels, err := s.alertService.GetAlertChannels(ctx, alert.ID)
		if err != nil {
			log.Printf("Failed to get alert channels for %s: %v", alert.ID, err)
			errMsg := err.Error()
			_ = s.alertService.RecordAlertHistory(ctx, alert.ID, value, "error", nil, &errMsg)
			return
		}

		// Send notification to all channels
		notificationDetails := make(map[string]interface{})
		var notificationErr error

		for _, ch := range channels {
			msg := buildAlertMessage(alert, value)
			if err := s.notificationService.Send(ctx, &ch, msg); err != nil {
				log.Printf("Failed to send alert %s to channel %s: %v", alert.ID, ch.ID, err)
				notificationDetails[ch.ID.String()] = map[string]interface{}{
					"status": "failed",
					"error":  err.Error(),
				}
				notificationErr = err
			} else {
				notificationDetails[ch.ID.String()] = map[string]interface{}{
					"status": "sent",
				}
			}
		}

		// Record history
		status := "sent"
		var errMsg *string
		if notificationErr != nil {
			status = "partial"
			msg := notificationErr.Error()
			errMsg = &msg
		}
		_ = s.alertService.RecordAlertHistory(ctx, alert.ID, value, status, notificationDetails, errMsg)
	}

	// Update alert timestamps
	_ = s.alertService.UpdateAlertAfterCheck(ctx, alert.ID, triggered, nextCheckAt)
}

func (s *Scheduler) processSubscriptions() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	subscriptions, err := s.subscriptionService.GetDueSubscriptions(ctx)
	if err != nil {
		log.Printf("Failed to get due subscriptions: %v", err)
		return
	}

	for i := range subscriptions {
		s.processSubscription(ctx, &subscriptions[i])
	}
}

func (s *Scheduler) processSubscription(ctx context.Context, sub *models.DashboardSubscription) {
	err := s.subscriptionService.ExecuteSubscription(ctx, sub)
	if err != nil {
		log.Printf("Failed to execute subscription %s: %v", sub.ID, err)
	}

	// Update next run time
	_ = s.subscriptionService.UpdateSubscriptionAfterRun(ctx, sub.ID, sub.ScheduleCron, sub.Timezone)
}

func buildAlertMessage(alert *models.QueryAlert, value string) models.NotificationMessage {
	return models.NotificationMessage{
		Title: "Alert Triggered: " + alert.Name,
		Body:  buildAlertBody(alert, value),
	}
}

func buildAlertBody(alert *models.QueryAlert, value string) string {
	description := ""
	if alert.Description != nil {
		description = *alert.Description + "\n\n"
	}
	return description + "Condition: " + alert.ConditionColumn + " " + string(alert.ConditionOperator) + " " + alert.ConditionValue + "\nActual Value: " + value
}
