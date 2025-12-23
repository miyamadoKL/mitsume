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

// GoogleChatNotifier handles Google Chat webhook notifications
type GoogleChatNotifier struct {
	client *http.Client
}

// NewGoogleChatNotifier creates a new Google Chat notifier
func NewGoogleChatNotifier() *GoogleChatNotifier {
	return &GoogleChatNotifier{
		client: &http.Client{},
	}
}

// googleChatMessage represents a Google Chat webhook message
type googleChatMessage struct {
	Text  string              `json:"text,omitempty"`
	Cards []googleChatCard    `json:"cards,omitempty"`
}

type googleChatCard struct {
	Header   *googleChatHeader   `json:"header,omitempty"`
	Sections []googleChatSection `json:"sections,omitempty"`
}

type googleChatHeader struct {
	Title    string `json:"title"`
	Subtitle string `json:"subtitle,omitempty"`
}

type googleChatSection struct {
	Widgets []googleChatWidget `json:"widgets,omitempty"`
}

type googleChatWidget struct {
	TextParagraph *googleChatTextParagraph `json:"textParagraph,omitempty"`
}

type googleChatTextParagraph struct {
	Text string `json:"text"`
}

// Send sends a notification to Google Chat
func (n *GoogleChatNotifier) Send(ctx context.Context, configData json.RawMessage, msg models.NotificationMessage) error {
	var config models.GoogleChatChannelConfig
	if err := json.Unmarshal(configData, &config); err != nil {
		return fmt.Errorf("failed to parse Google Chat config: %w", err)
	}

	// Build Google Chat message with card format
	chatMsg := googleChatMessage{
		Cards: []googleChatCard{
			{
				Header: &googleChatHeader{
					Title: msg.Title,
				},
				Sections: []googleChatSection{
					{
						Widgets: []googleChatWidget{
							{
								TextParagraph: &googleChatTextParagraph{
									Text: msg.Body,
								},
							},
						},
					},
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
		chatMsg.Cards[0].Sections = append(chatMsg.Cards[0].Sections, googleChatSection{
			Widgets: []googleChatWidget{
				{
					TextParagraph: &googleChatTextParagraph{
						Text: fmt.Sprintf("<i>Attachments: %s</i>", strings.Join(attachmentNames, ", ")),
					},
				},
			},
		})
	}

	body, err := json.Marshal(chatMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal Google Chat message: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", config.WebhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send Google Chat notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Google Chat webhook returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// ValidateConfig validates the Google Chat channel configuration
func (n *GoogleChatNotifier) ValidateConfig(configData json.RawMessage) error {
	var config models.GoogleChatChannelConfig
	if err := json.Unmarshal(configData, &config); err != nil {
		return fmt.Errorf("failed to parse Google Chat config: %w", err)
	}

	if config.WebhookURL == "" {
		return fmt.Errorf("webhook_url is required")
	}

	if !strings.HasPrefix(config.WebhookURL, "https://chat.googleapis.com/") {
		return fmt.Errorf("invalid Google Chat webhook URL format")
	}

	return nil
}
