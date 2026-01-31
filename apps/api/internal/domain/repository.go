package domain

import "context"

type WorkspaceRepository interface {
    Create(ctx context.Context, name *string) (*Workspace, error)
    Get(ctx context.Context, id int64) (*Workspace, error)
}

type ThreadRepository interface {
    Create(ctx context.Context, workspaceID int64, title *string) (*Thread, error)
    Get(ctx context.Context, id int64) (*Thread, error)
}

type MessageRepository interface {
    Create(ctx context.Context, threadID int64, runID *int64, role Role, content string) (*Message, error)
    ListByThread(ctx context.Context, threadID int64, limit int) ([]*Message, error)
}

type RunRepository interface {
    Create(ctx context.Context, threadID int64, status RunStatus) (*Run, error)
    Get(ctx context.Context, id int64) (*Run, error)
}
