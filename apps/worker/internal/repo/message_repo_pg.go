package repo

import (
    "context"

    "github.com/jackc/pgx/v5/pgxpool"
)

type MessageRepoPG struct{ DB *pgxpool.Pool }

func NewMessageRepoPG(db *pgxpool.Pool) *MessageRepoPG { return &MessageRepoPG{DB: db} }

func (r *MessageRepoPG) Create(ctx context.Context, threadID int64, runID *int64, role string, content string) error {
    _, err := r.DB.Exec(ctx,
        `INSERT INTO messages (thread_id, run_id, role, content) VALUES ($1,$2,$3,$4)`,
        threadID, runID, role, content,
    )
    return err
}

