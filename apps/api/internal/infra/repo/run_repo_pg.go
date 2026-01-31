package repo

import (
    "context"

    "ai-workspace-platform/api/internal/domain"
    "github.com/jackc/pgx/v5/pgxpool"
)

type RunRepoPG struct { DB *pgxpool.Pool }

func NewRunRepoPG(db *pgxpool.Pool) *RunRepoPG { return &RunRepoPG{DB: db} }

func (r *RunRepoPG) Create(ctx context.Context, threadID int64, status domain.RunStatus) (*domain.Run, error) {
    var run domain.Run
    var statusStr string
    err := r.DB.QueryRow(ctx,
        `INSERT INTO runs (thread_id, status) VALUES ($1,$2)
         RETURNING id, thread_id, status, created_at, updated_at`,
        threadID, string(status),
    ).Scan(&run.ID, &run.ThreadID, &statusStr, &run.CreatedAt, &run.UpdatedAt)
    run.Status = domain.RunStatus(statusStr)
    if err != nil { return nil, err }
    return &run, nil
}

func (r *RunRepoPG) Get(ctx context.Context, id int64) (*domain.Run, error) {
    var run domain.Run
    var statusStr string
    err := r.DB.QueryRow(ctx,
        `SELECT id, thread_id, status, created_at, updated_at FROM runs WHERE id=$1`, id,
    ).Scan(&run.ID, &run.ThreadID, &statusStr, &run.CreatedAt, &run.UpdatedAt)
    run.Status = domain.RunStatus(statusStr)
    if err != nil { return nil, err }
    return &run, nil
}
