package repo

import (
    "context"

    "ai-workspace-platform/api/internal/domain"
    "github.com/jackc/pgx/v5/pgxpool"
)

type MessageRepoPG struct { DB *pgxpool.Pool }

func NewMessageRepoPG(db *pgxpool.Pool) *MessageRepoPG { return &MessageRepoPG{DB: db} }

func (r *MessageRepoPG) Create(ctx context.Context, threadID int64, runID *int64, role domain.Role, content string) (*domain.Message, error) {
    var m domain.Message
    var roleStr string
    err := r.DB.QueryRow(ctx,
        `INSERT INTO messages (thread_id, run_id, role, content) VALUES ($1,$2,$3,$4)
         RETURNING id, thread_id, run_id, role, content, created_at`,
        threadID, runID, string(role), content,
    ).Scan(&m.ID, &m.ThreadID, &m.RunID, &roleStr, &m.Content, &m.CreatedAt)
    m.Role = domain.Role(roleStr)
    if err != nil { return nil, err }
    return &m, nil
}

func (r *MessageRepoPG) ListByThread(ctx context.Context, threadID int64, limit int) ([]*domain.Message, error) {
    if limit <= 0 || limit > 200 { limit = 100 }
    rows, err := r.DB.Query(ctx,
        `SELECT id, thread_id, run_id, role, content, created_at
         FROM messages WHERE thread_id=$1 ORDER BY id ASC LIMIT $2`, threadID, limit,
    )
    if err != nil { return nil, err }
    defer rows.Close()
    out := make([]*domain.Message, 0, limit)
    for rows.Next() {
        var m domain.Message
        var roleStr string
        if err := rows.Scan(&m.ID, &m.ThreadID, &m.RunID, &roleStr, &m.Content, &m.CreatedAt); err != nil { return nil, err }
        m.Role = domain.Role(roleStr)
        out = append(out, &m)
    }
    return out, rows.Err()
}
