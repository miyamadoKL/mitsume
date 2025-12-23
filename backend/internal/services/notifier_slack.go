package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/mitsume/backend/internal/models"
)

// SlackNotifier handles Slack webhook notifications
type SlackNotifier struct {
	client *http.Client
}

// NewSlackNotifier creates a new Slack notifier
func NewSlackNotifier() *SlackNotifier {
	return &SlackNotifier{
		client: &http.Client{},
	}
}

// slackMessage represents a Slack webhook message
type slackMessage struct {
	Text        string            `json:"text,omitempty"`
	Blocks      []slackBlock      `json:"blocks,omitempty"`
	Attachments []slackAttachment `json:"attachments,omitempty"`
}

type slackBlock struct {
	Type string      `json:"type"`
	Text *slackText  `json:"text,omitempty"`
}

type slackText struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type slackAttachment struct {
	Color  string `json:"color,omitempty"`
	Title  string `json:"title,omitempty"`
	Text   string `json:"text,omitempty"`
	Footer string `json:"footer,omitempty"`
}

// Send sends a notification to Slack
func (n *SlackNotifier) Send(ctx context.Context, configData json.RawMessage, msg models.NotificationMessage) error {
	var config models.SlackChannelConfig
	if err := json.Unmarshal(configData, &config); err != nil {
		return fmt.Errorf("failed to parse Slack config: %w", err)
	}

	// Build Slack message with blocks for better formatting
	slackMsg := slackMessage{
		Blocks: []slackBlock{
			{
				Type: "header",
				Text: &slackText{
					Type: "plain_text",
					Text: msg.Title,
				},
			},
			{
				Type: "section",
				Text: &slackText{
					Type: "mrkdwn",
					Text: msg.Body,
				},
			},
		},
	}

	// Add attachments info if present
	if len(msg.Attachments) > 0 {
		attachmentNames := make([]string, len(msg.Attachments))
		for i, att := range msg.Attachments {
			attachmentNames[i] = att.Filename
		}
		slackMsg.Blocks = append(slackMsg.Blocks, slackBlock{
			Type: "context",
			Text: &slackText{
				Type: "mrkdwn",
				Text: fmt.Sprintf("_Attachments: %s_", strings.Join(attachmentNames, ", ")),
			},
		})
	}

	body, err := json.Marshal(slackMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal Slack message: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", config.WebhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send Slack notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Slack webhook returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// ValidateConfig validates the Slack channel configuration
func (n *SlackNotifier) ValidateConfig(configData json.RawMessage) error {
	var config models.SlackChannelConfig
	if err := json.Unmarshal(configData, &config); err != nil {
		return fmt.Errorf("failed to parse Slack config: %w", err)
	}

	if config.WebhookURL == "" {
		return fmt.Errorf("webhook_url is required")
	}

	if !strings.HasPrefix(config.WebhookURL, "https://hooks.slack.com/") {
		return fmt.Errorf("invalid Slack webhook URL format")
	}

	return nil
}
