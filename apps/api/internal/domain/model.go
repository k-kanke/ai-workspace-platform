package domain

import "time"

type Workspace struct {
    ID        int64
    Name      string
    CreatedAt time.Time
}

type Thread struct {
    ID          int64
    WorkspaceID int64
    Title       *string
    CreatedAt   time.Time
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
    ID        int64
    ThreadID  int64
    Status    RunStatus
    CreatedAt time.Time
    UpdatedAt time.Time
}

type Role string

const (
    RoleUser      Role = "user"
    RoleAssistant Role = "assistant"
)

type Message struct {
    ID        int64
    ThreadID  int64
    RunID     *int64
    Role      Role
    Content   string
    CreatedAt time.Time
}

