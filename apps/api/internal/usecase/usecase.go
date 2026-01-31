package usecase

import (
	"context"
	"errors"
	"strconv"

	"ai-workspace-platform/api/internal/domain"
	repopg "ai-workspace-platform/api/internal/infra/repo"
    "ai-workspace-platform/api/internal/infra/queue"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Usecase struct {
    Workspace domain.WorkspaceRepository
    Threads  domain.ThreadRepository
    Messages domain.MessageRepository
    Runs     domain.RunRepository
    Publisher queue.Publisher
}

func New(db *pgxpool.Pool, pub queue.Publisher) *Usecase {
    return &Usecase{
        Workspace: repopg.NewWorkspaceRepoPG(db),
        Threads:  repopg.NewThreadRepoPG(db),
        Messages: repopg.NewMessageRepoPG(db),
        Runs:     repopg.NewRunRepoPG(db),
        Publisher: pub,
    }
}

func (u *Usecase) CreateWorkspace(ctx context.Context, name *string) (*domain.Workspace, error) {
    return u.Workspace.Create(ctx, name)
}

func (u *Usecase) CreateThread(ctx context.Context, workspaceID int64, title *string) (*domain.Thread, error) {
    return u.Threads.Create(ctx, workspaceID, title)
}

func (u *Usecase) PostMessageAndEnqueueRun(ctx context.Context, threadID int64, content string) (*domain.Run, error) {
    if _, err := u.Messages.Create(ctx, threadID, nil, domain.RoleUser, content); err != nil {
        return nil, err
    }
    run, err := u.Runs.Create(ctx, threadID, domain.RunQueued)
    if err != nil { return nil, err }
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
