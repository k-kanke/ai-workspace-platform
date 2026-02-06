package domain

import "time"

type Workspace struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	SystemPrompt *string   `json:"system_prompt"`
	CreatedAt    time.Time `json:"created_at"`
}

type WorkspaceKnowledge struct {
	WorkspaceID int64     `json:"workspace_id"`
	KnowledgeID int64     `json:"knowledge_id"`
	Content     string    `json:"content"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Knowledge struct {
	ID        int64     `json:"id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Thread struct {
	ID          int64     `json:"id"`
	WorkspaceID int64     `json:"workspace_id"`
	Title       *string   `json:"title"`
	CreatedAt   time.Time `json:"created_at"`
}

type RunStatus string

const (
	RunQueued    RunStatus = "queued"
	RunRunning   RunStatus = "running"
	RunSucceeded RunStatus = "succeeded"
	RunFailed    RunStatus = "failed"
	RunCancelled RunStatus = "cancelled"
)

type Run struct {
	ID        int64     `json:"id"`
	ThreadID  int64     `json:"thread_id"`
	Status    RunStatus `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Role string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

type Message struct {
	ID        int64     `json:"id"`
	ThreadID  int64     `json:"thread_id"`
	RunID     *int64    `json:"run_id"`
	Role      Role      `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}
