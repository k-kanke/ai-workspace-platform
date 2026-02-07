package domain

import "context"

type WorkspaceRepository interface {
	Create(ctx context.Context, name *string, systemPrompt *string) (*Workspace, error)
	Get(ctx context.Context, id int64) (*Workspace, error)
	List(ctx context.Context, limit, offset int) ([]*Workspace, error)
	UpdateSystemPrompt(ctx context.Context, id int64, systemPrompt *string) (*Workspace, error)
	UpdateName(ctx context.Context, id int64, name *string) (*Workspace, error)
	UpdateLLMEnabled(ctx context.Context, id int64, enabled bool) (*Workspace, error)
	Delete(ctx context.Context, id int64) error
}

type WorkspaceKnowledgeRepository interface {
	GetByWorkspaceID(ctx context.Context, workspaceID int64) (*WorkspaceKnowledge, error)
	Upsert(ctx context.Context, workspaceID int64, content string) (*WorkspaceKnowledge, error)
}

type KnowledgeRepository interface {
	CreateWithName(ctx context.Context, name, content string) (*Knowledge, error)
	Get(ctx context.Context, id int64) (*Knowledge, error)
	List(ctx context.Context, limit, offset int) ([]*Knowledge, error)
	Update(ctx context.Context, id int64, name, content string) (*Knowledge, error)
}

type WorkspaceKnowledgeLinkRepository interface {
	ListByWorkspace(ctx context.Context, workspaceID int64) ([]*Knowledge, error)
	Link(ctx context.Context, workspaceID, knowledgeID int64) error
	Unlink(ctx context.Context, workspaceID, knowledgeID int64) error
}

type ThreadRepository interface {
	Create(ctx context.Context, workspaceID int64, title *string) (*Thread, error)
	Get(ctx context.Context, id int64) (*Thread, error)
	ListByWorkspace(ctx context.Context, workspaceID int64, limit, offset int) ([]*Thread, error)
	UpdateTitle(ctx context.Context, id int64, title *string) (*Thread, error)
	Delete(ctx context.Context, id int64) error
}

type MessageRepository interface {
	Create(ctx context.Context, threadID int64, runID *int64, role Role, content string) (*Message, error)
	ListByThread(ctx context.Context, threadID int64, limit int) ([]*Message, error)
	// FindAssistantByRun returns the first assistant message associated with the run, if any.
	FindAssistantByRun(ctx context.Context, runID int64) (*Message, error)
}

type RunRepository interface {
	Create(ctx context.Context, threadID int64, status RunStatus) (*Run, error)
	Get(ctx context.Context, id int64) (*Run, error)
}
