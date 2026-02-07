package repo

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
)

type StreamRepoPG struct{ DB *pgxpool.Pool }

func NewStreamRepoPG(db *pgxpool.Pool) *StreamRepoPG { return &StreamRepoPG{DB: db} }

type streamPayload struct {
	RunID    int64  `json:"run_id"`
	ThreadID int64  `json:"thread_id"`
	Content  string `json:"content"`
}

func (r *StreamRepoPG) NotifyStream(ctx context.Context, runID, threadID int64, content string) error {
	payload := streamPayload{RunID: runID, ThreadID: threadID, Content: content}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = r.DB.Exec(ctx, "SELECT pg_notify('assistant_stream', $1)", string(b))
	return err
}
