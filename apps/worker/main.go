package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"ai-workspace-platform/worker/internal/db"
	"ai-workspace-platform/worker/internal/queue"
	"ai-workspace-platform/worker/internal/repo"
	workerpkg "ai-workspace-platform/worker/internal/worker"
)

func main() {
    ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer cancel()

    dsn := os.Getenv("DATABASE_URL")
    pool, err := db.Connect(ctx, dsn)
    if err != nil {
        log.Fatalf("failed to connect db: %v", err)
    }
    defer pool.Close()

    q, err := queue.NewSQSClient(ctx)
    if err != nil {
        log.Fatalf("failed to init SQS: %v", err)
    }
    log.Printf("worker started: queue=%s", q.QueueURL)

    runRepo := repo.NewRunRepoPG(pool)
    processor := workerpkg.NewRunProcessor(runRepo)

    if err := workerpkg.Consume(ctx, q, processor); err != nil {
        log.Printf("worker stopped with error: %v", err)
    } else {
        log.Printf("worker stopped")
    }
}
