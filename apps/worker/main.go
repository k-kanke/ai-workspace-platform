package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"ai-workspace-platform/worker/internal/queue"
	workerpkg "ai-workspace-platform/worker/internal/worker"
)

func main() {
    ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer cancel()

    q, err := queue.NewSQSClient(ctx)
    if err != nil {
        log.Fatalf("failed to init SQS: %v", err)
    }
    log.Printf("worker started: queue=%s", q.QueueURL)

    if err := workerpkg.Consume(ctx, q); err != nil {
        log.Printf("worker stopped with error: %v", err)
    } else {
        log.Printf("worker stopped")
    }
}
