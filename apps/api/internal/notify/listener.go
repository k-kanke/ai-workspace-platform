package notify

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"ai-workspace-platform/api/internal/stream"

	"github.com/jackc/pgx/v5/pgxpool"
)

type payload struct {
	RunID     int64  `json:"run_id"`
	ThreadID  int64  `json:"thread_id"`
	MessageID int64  `json:"message_id"`
	Content   string `json:"content"`
}

func StartAssistantMessageListener(ctx context.Context, pool *pgxpool.Pool, hub *stream.Hub) {
	go func() {
		backoff := time.Second
		for {
			if ctx.Err() != nil {
				return
			}
			conn, err := pool.Acquire(ctx)
			if err != nil {
				log.Printf("pg LISTEN acquire failed: %v", err)
				select {
				case <-time.After(backoff):
					if backoff < 10*time.Second {
						backoff *= 2
					}
					continue
				case <-ctx.Done():
					return
				}
			}

			backoff = time.Second
			innerCtx, cancel := context.WithCancel(ctx)

			if _, err := conn.Exec(innerCtx, "LISTEN assistant_message"); err != nil {
				log.Printf("pg LISTEN exec failed: %v", err)
				cancel()
				conn.Release()
				select {
				case <-time.After(backoff):
					if backoff < 10*time.Second {
						backoff *= 2
					}
					continue
				case <-ctx.Done():
					return
				}
			}
			if _, err := conn.Exec(innerCtx, "LISTEN assistant_stream"); err != nil {
				log.Printf("pg LISTEN exec failed: %v", err)
				cancel()
				conn.Release()
				select {
				case <-time.After(backoff):
					if backoff < 10*time.Second {
						backoff *= 2
					}
					continue
				case <-ctx.Done():
					return
				}
			}

			log.Printf("LISTEN assistant_message started")

			for {
				n, err := conn.Conn().WaitForNotification(innerCtx)
				if err != nil {
					if innerCtx.Err() == nil {
						log.Printf("pg LISTEN wait error: %v", err)
					}
					break
				}
				var p payload
				if err := json.Unmarshal([]byte(n.Payload), &p); err != nil {
					log.Printf("pg LISTEN payload unmarshal failed: %v payload=%s", err, n.Payload)
					continue
				}
				if n.Channel == "assistant_stream" {
					hub.Publish(stream.RunEvent{RunID: p.RunID, ThreadID: p.ThreadID, Type: "stream", Content: p.Content})
					continue
				}
				log.Printf("NOTIFY assistant_message: run=%d thread=%d message=%d", p.RunID, p.ThreadID, p.MessageID)
				hub.Publish(stream.RunEvent{RunID: p.RunID, ThreadID: p.ThreadID, MessageID: p.MessageID, Type: "done"})
			}

			cancel()
			conn.Release()
		}
	}()
}
