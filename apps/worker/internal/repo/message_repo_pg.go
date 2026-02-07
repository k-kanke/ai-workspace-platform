package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type MessageRepoPG struct{ DB *pgxpool.Pool }

type Message struct {
	ID        int64
	ThreadID  int64
	Role      string
	Content   string
	CreatedAt time.Time
}

func NewMessageRepoPG(db *pgxpool.Pool) *MessageRepoPG { return &MessageRepoPG{DB: db} }

func (r *MessageRepoPG) Create(ctx context.Context, threadID int64, runID *int64, role string, content string) error {
	_, err := r.DB.Exec(ctx,
		`INSERT INTO messages (thread_id, run_id, role, content) VALUES ($1,$2,$3,$4)`,
		threadID, runID, role, content,
	)
	return err
}

func (r *MessageRepoPG) ListByThread(ctx context.Context, threadID int64, limit int) ([]Message, error) {
	if limit <= 0 || limit > 200 {
		limit = 20
	}
	rows, err := r.DB.Query(ctx,
		`SELECT id, thread_id, role, content, created_at
         FROM messages
         WHERE thread_id=$1
         ORDER BY id DESC
         LIMIT $2`, threadID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Message, 0, limit)
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.ThreadID, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
