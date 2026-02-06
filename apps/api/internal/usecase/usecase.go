package usecase

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"ai-workspace-platform/api/internal/domain"
	"ai-workspace-platform/api/internal/infra/queue"
	repopg "ai-workspace-platform/api/internal/infra/repo"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Usecase struct {
	Workspace domain.WorkspaceRepository
	Knowledge domain.WorkspaceKnowledgeRepository
	KBase     domain.KnowledgeRepository
	WKLinks   domain.WorkspaceKnowledgeLinkRepository
	Threads   domain.ThreadRepository
	Messages  domain.MessageRepository
	Runs      domain.RunRepository
	Publisher queue.Publisher
}

var ErrInvalidName = errors.New("invalid name")
var ErrInvalidTitle = errors.New("invalid title")
var ErrInvalidContent = errors.New("invalid content")

func New(db *pgxpool.Pool, pub queue.Publisher) *Usecase {
	return &Usecase{
		Workspace: repopg.NewWorkspaceRepoPG(db),
		Knowledge: repopg.NewWorkspaceKnowledgeRepoPG(db),
		KBase:     repopg.NewKnowledgeRepoPG(db),
		WKLinks:   repopg.NewWorkspaceKnowledgeLinkRepoPG(db),
		Threads:   repopg.NewThreadRepoPG(db),
		Messages:  repopg.NewMessageRepoPG(db),
		Runs:      repopg.NewRunRepoPG(db),
		Publisher: pub,
	}
}

func normalizeOptionalText(v *string) *string {
	if v == nil {
		return nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return nil
	}
	return &s
}

func (u *Usecase) CreateWorkspace(ctx context.Context, name *string, systemPrompt *string) (*domain.Workspace, error) {
	if name == nil || strings.TrimSpace(*name) == "" {
		n := "Workspace"
		ts := time.Now().Format("20060102-150405")
		composed := n + " " + ts
		name = &composed
	}
	return u.Workspace.Create(ctx, name, normalizeOptionalText(systemPrompt))
}

func (u *Usecase) CreateThread(ctx context.Context, workspaceID int64, title *string) (*domain.Thread, error) {
	return u.Threads.Create(ctx, workspaceID, title)
}

func (u *Usecase) ListWorkspaces(ctx context.Context, limit, offset int) ([]*domain.Workspace, error) {
	return u.Workspace.List(ctx, limit, offset)
}

func (u *Usecase) UpdateWorkspaceSystemPrompt(ctx context.Context, workspaceID int64, systemPrompt *string) (*domain.Workspace, error) {
	return u.Workspace.UpdateSystemPrompt(ctx, workspaceID, normalizeOptionalText(systemPrompt))
}

func (u *Usecase) GetWorkspaceKnowledge(ctx context.Context, workspaceID int64) (*domain.WorkspaceKnowledge, error) {
	return u.Knowledge.GetByWorkspaceID(ctx, workspaceID)
}

func (u *Usecase) UpsertWorkspaceKnowledge(ctx context.Context, workspaceID int64, content string) (*domain.WorkspaceKnowledge, error) {
	return u.Knowledge.Upsert(ctx, workspaceID, content)
}

func (u *Usecase) ListKnowledge(ctx context.Context, limit, offset int) ([]*domain.Knowledge, error) {
	return u.KBase.List(ctx, limit, offset)
}

func (u *Usecase) CreateKnowledge(ctx context.Context, content string) (*domain.Knowledge, error) {
	if strings.TrimSpace(content) == "" {
		return nil, ErrInvalidContent
	}
	return u.KBase.Create(ctx, content)
}

func (u *Usecase) UpdateKnowledge(ctx context.Context, knowledgeID int64, content string) (*domain.Knowledge, error) {
	if strings.TrimSpace(content) == "" {
		return nil, ErrInvalidContent
	}
	return u.KBase.Update(ctx, knowledgeID, content)
}

func (u *Usecase) ListWorkspaceKnowledgeLinks(ctx context.Context, workspaceID int64) ([]*domain.Knowledge, error) {
	return u.WKLinks.ListByWorkspace(ctx, workspaceID)
}

func (u *Usecase) LinkWorkspaceKnowledge(ctx context.Context, workspaceID, knowledgeID int64) error {
	return u.WKLinks.Link(ctx, workspaceID, knowledgeID)
}

func (u *Usecase) UnlinkWorkspaceKnowledge(ctx context.Context, workspaceID, knowledgeID int64) error {
	return u.WKLinks.Unlink(ctx, workspaceID, knowledgeID)
}

func (u *Usecase) UpdateWorkspaceName(ctx context.Context, workspaceID int64, name *string) (*domain.Workspace, error) {
	normalized := normalizeOptionalText(name)
	if normalized == nil {
		return nil, ErrInvalidName
	}
	return u.Workspace.UpdateName(ctx, workspaceID, normalized)
}

func (u *Usecase) DeleteWorkspace(ctx context.Context, workspaceID int64) error {
	return u.Workspace.Delete(ctx, workspaceID)
}

func (u *Usecase) UpdateThreadTitle(ctx context.Context, threadID int64, title *string) (*domain.Thread, error) {
	normalized := normalizeOptionalText(title)
	if normalized == nil {
		return nil, ErrInvalidTitle
	}
	return u.Threads.UpdateTitle(ctx, threadID, normalized)
}

func (u *Usecase) DeleteThread(ctx context.Context, threadID int64) error {
	return u.Threads.Delete(ctx, threadID)
}

func (u *Usecase) ListThreadsByWorkspace(ctx context.Context, wsID int64, limit, offset int) ([]*domain.Thread, error) {
	return u.Threads.ListByWorkspace(ctx, wsID, limit, offset)
}

func (u *Usecase) PostMessageAndEnqueueRun(ctx context.Context, threadID int64, content string) (*domain.Run, error) {
	if _, err := u.Messages.Create(ctx, threadID, nil, domain.RoleUser, content); err != nil {
		return nil, err
	}
	run, err := u.Runs.Create(ctx, threadID, domain.RunQueued)
	if err != nil {
		return nil, err
	}
	if u.Publisher != nil {
		_ = u.Publisher.PublishRunQueued(ctx, run.ID, threadID)
	}
	return run, nil
}

func (u *Usecase) ListMessages(ctx context.Context, threadID int64, limit int) ([]*domain.Message, error) {
	return u.Messages.ListByThread(ctx, threadID, limit)
}

func (u *Usecase) GetRun(ctx context.Context, runID int64) (*domain.Run, error) {
	return u.Runs.Get(ctx, runID)
}

func ParseID(s string) (int64, error) {
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid id")
	}
	return id, nil
}
