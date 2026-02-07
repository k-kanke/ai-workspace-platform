package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Client interface {
	Generate(ctx context.Context, messages []ChatMessage) (string, error)
}

type OpenAIClient struct {
	APIKey  string
	Model   string
	BaseURL string
	HTTP    *http.Client
}

func NewOpenAIClient(apiKey, model string) *OpenAIClient {
	if model == "" {
		model = "gpt-4o-mini"
	}
	return &OpenAIClient{
		APIKey:  apiKey,
		Model:   model,
		BaseURL: "https://api.openai.com/v1",
		HTTP:    &http.Client{Timeout: 60 * time.Second},
	}
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float64       `json:"temperature,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

func (c *OpenAIClient) Generate(ctx context.Context, messages []ChatMessage) (string, error) {
	if c == nil || c.HTTP == nil {
		return "", errors.New("openai client is nil")
	}
	if c.APIKey == "" {
		return "", errors.New("OPENAI_API_KEY is empty")
	}
	if c.Model == "" {
		return "", errors.New("OPENAI_MODEL is empty")
	}
	reqBody, err := json.Marshal(chatRequest{
		Model:       c.Model,
		Messages:    messages,
		Temperature: 0.2,
	})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/chat/completions", bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("openai http %d: %s", res.StatusCode, string(body))
	}

	var parsed chatResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", err
	}
	if parsed.Error != nil {
		return "", fmt.Errorf("openai error: %s", parsed.Error.Message)
	}
	if len(parsed.Choices) == 0 {
		return "", errors.New("openai response has no choices")
	}
	return parsed.Choices[0].Message.Content, nil
}
