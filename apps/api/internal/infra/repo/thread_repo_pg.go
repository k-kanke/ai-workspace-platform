package repo

import (
    "context"

    "ai-workspace-platform/api/internal/domain"
    "github.com/jackc/pgx/v5/pgxpool"
)

type ThreadRepoPG struct { DB *pgxpool.Pool }

func NewThreadRepoPG(db *pgxpool.Pool) *ThreadRepoPG { return &ThreadRepoPG{DB: db} }

func (r *ThreadRepoPG) Create(ctx context.Context, workspaceID int64, title *string) (*domain.Thread, error) {
    var t domain.Thread
    err := r.DB.QueryRow(ctx,
        `INSERT INTO threads (workspace_id, title) VALUES ($1, $2) RETURNING id, workspace_id, title, created_at`,
        workspaceID, title,
    ).Scan(&t.ID, &t.WorkspaceID, &t.Title, &t.CreatedAt)
    if err != nil { return nil, err }
    return &t, nil
}

func (r *ThreadRepoPG) Get(ctx context.Context, id int64) (*domain.Thread, error) {
    var t domain.Thread
    err := r.DB.QueryRow(ctx,
        `SELECT id, workspace_id, title, created_at FROM threads WHERE id=$1`, id,
    ).Scan(&t.ID, &t.WorkspaceID, &t.Title, &t.CreatedAt)
    if err != nil { return nil, err }
    return &t, nil
}
