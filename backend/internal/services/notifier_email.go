package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/smtp"
	"net/textproto"
	"strings"

	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/models"
)

// EmailNotifier handles email notifications via SMTP
type EmailNotifier struct {
	smtpConfig *config.SMTPConfig
}

// NewEmailNotifier creates a new email notifier
func NewEmailNotifier(cfg *config.SMTPConfig) *EmailNotifier {
	return &EmailNotifier{
		smtpConfig: cfg,
	}
}

// Send sends an email notification
func (n *EmailNotifier) Send(ctx context.Context, configData json.RawMessage, msg models.NotificationMessage) error {
	if n.smtpConfig.Host == "" {
		return fmt.Errorf("SMTP not configured")
	}

	var channelConfig models.EmailChannelConfig
	if err := json.Unmarshal(configData, &channelConfig); err != nil {
		return fmt.Errorf("failed to parse email config: %w", err)
	}

	if len(channelConfig.Recipients) == 0 {
		return fmt.Errorf("no recipients specified")
	}

	// Build email content
	var emailBody bytes.Buffer

	// Create multipart writer for attachments support
	writer := multipart.NewWriter(&emailBody)

	// Headers
	headers := make(map[string]string)
	headers["From"] = n.smtpConfig.From
	headers["To"] = strings.Join(channelConfig.Recipients, ", ")
	headers["Subject"] = msg.Title
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = fmt.Sprintf("multipart/mixed; boundary=%s", writer.Boundary())

	// Write headers
	var headerBuf bytes.Buffer
	for k, v := range headers {
		headerBuf.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	headerBuf.WriteString("\r\n")

	// Write text part
	textHeader := make(textproto.MIMEHeader)
	textHeader.Set("Content-Type", "text/plain; charset=utf-8")
	textPart, err := writer.CreatePart(textHeader)
	if err != nil {
		return fmt.Errorf("failed to create text part: %w", err)
	}
	textPart.Write([]byte(msg.Body))

	// Write attachments
	for _, att := range msg.Attachments {
		attHeader := make(textproto.MIMEHeader)
		attHeader.Set("Content-Type", att.ContentType)
		attHeader.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", att.Filename))
		attHeader.Set("Content-Transfer-Encoding", "base64")

		attPart, err := writer.CreatePart(attHeader)
		if err != nil {
			return fmt.Errorf("failed to create attachment part: %w", err)
		}

		encoded := base64.StdEncoding.EncodeToString(att.Data)
		attPart.Write([]byte(encoded))
	}

	writer.Close()

	// Combine headers and body
	var fullEmail bytes.Buffer
	fullEmail.Write(headerBuf.Bytes())
	fullEmail.Write(emailBody.Bytes())

	// Send email
	addr := fmt.Sprintf("%s:%s", n.smtpConfig.Host, n.smtpConfig.Port)
	auth := smtp.PlainAuth("", n.smtpConfig.Username, n.smtpConfig.Password, n.smtpConfig.Host)

	err = smtp.SendMail(addr, auth, n.smtpConfig.From, channelConfig.Recipients, fullEmail.Bytes())
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// ValidateConfig validates the email channel configuration
func (n *EmailNotifier) ValidateConfig(configData json.RawMessage) error {
	var config models.EmailChannelConfig
	if err := json.Unmarshal(configData, &config); err != nil {
		return fmt.Errorf("failed to parse email config: %w", err)
	}

	if len(config.Recipients) == 0 {
		return fmt.Errorf("at least one recipient is required")
	}

	// Basic email format validation
	for _, email := range config.Recipients {
		if !strings.Contains(email, "@") || !strings.Contains(email, ".") {
			return fmt.Errorf("invalid email address: %s", email)
		}
	}

	return nil
}
