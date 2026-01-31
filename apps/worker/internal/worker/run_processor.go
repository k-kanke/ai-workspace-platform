package worker

import (
	"context"
	"log"
	"time"

	"ai-workspace-platform/worker/internal/repo"
)

type RunProcessor struct {
    Runs *repo.RunRepoPG
}

func NewRunProcessor(r *repo.RunRepoPG) *RunProcessor { return &RunProcessor{Runs: r} }

func (p *RunProcessor) ProcessRun(ctx context.Context, runID, threadID int64) error {
    ok, err := p.Runs.UpdateStatusCAS(ctx, runID, threadID, repo.RunQueued, repo.RunRunning)
    if err != nil { return err }
    if !ok {
        r, err := p.Runs.Get(ctx, runID)
        if err != nil { return err }
        log.Printf("run %d current status=%s, skipping state change", runID, r.Status)
        return nil
    }

    // ここでコンテキスト作成やLLMに問い合わせてストリーム生成を行う
    time.Sleep(500 * time.Millisecond)

    _, err = p.Runs.UpdateStatusCAS(ctx, runID, threadID, repo.RunRunning, repo.RunSucceeded)
    if err != nil { return err }
    log.Printf("run %d completed: succeeded", runID)
    return nil
}

