package worker

import (
	"context"
	"fmt"
	"log"
	"strings"

	"ai-workspace-platform/worker/internal/llm"
	"ai-workspace-platform/worker/internal/repo"
)

type RunProcessor struct {
	Runs     *repo.RunRepoPG
	Messages *repo.MessageRepoPG
	Context  *repo.ContextRepoPG
	Stream   *repo.StreamRepoPG
	LLM      llm.Client
}

func NewRunProcessor(r *repo.RunRepoPG, m *repo.MessageRepoPG, c *repo.ContextRepoPG, s *repo.StreamRepoPG, l llm.Client) *RunProcessor {
	return &RunProcessor{Runs: r, Messages: m, Context: c, Stream: s, LLM: l}
}

func (p *RunProcessor) ProcessRun(ctx context.Context, runID, threadID int64) error {
	log.Printf("run %d started: thread=%d", runID, threadID)
	ok, err := p.Runs.UpdateStatusCAS(ctx, runID, threadID, repo.RunQueued, repo.RunRunning)
	if err != nil {
		return err
	}
	if !ok {
		r, err := p.Runs.Get(ctx, runID)
		if err != nil {
			return err
		}
		log.Printf("run %d current status=%s, skipping state change", runID, r.Status)
		return nil
	}

	if p.Context == nil || p.Messages == nil || p.LLM == nil || p.Stream == nil {
		_ = p.failRun(ctx, runID, threadID, fmt.Errorf("missing dependencies"))
		return fmt.Errorf("missing dependencies")
	}

	ctxInfo, err := p.Context.GetByThreadID(ctx, threadID)
	if err != nil {
		_ = p.failRun(ctx, runID, threadID, err)
		return err
	}
	if !ctxInfo.LLMEnabled {
		reply := "LLM is disabled for this workspace."
		_, err = p.Runs.UpdateStatusCAS(ctx, runID, threadID, repo.RunRunning, repo.RunSucceeded)
		if err != nil {
			return err
		}
		if err := p.Messages.Create(ctx, threadID, &runID, "assistant", reply); err != nil {
			log.Printf("insert assistant message failed: %v", err)
		}
		log.Printf("run %d completed: llm disabled", runID)
		return nil
	}

	history, err := p.Messages.ListByThread(ctx, threadID, 4)
	if err != nil {
		_ = p.failRun(ctx, runID, threadID, err)
		return err
	}
	// 時系列順に直す
	for i, j := 0, len(history)-1; i < j; i, j = i+1, j-1 {
		history[i], history[j] = history[j], history[i]
	}

	msgs := make([]llm.ChatMessage, 0, 2+len(history))
	if ctxInfo.SystemPrompt != nil && strings.TrimSpace(*ctxInfo.SystemPrompt) != "" {
		msgs = append(msgs, llm.ChatMessage{Role: "system", Content: *ctxInfo.SystemPrompt})
	}
	if ctxInfo.KnowledgeContent != nil && strings.TrimSpace(*ctxInfo.KnowledgeContent) != "" {
		kn := strings.TrimSpace(*ctxInfo.KnowledgeContent)
		kname := ""
		if ctxInfo.KnowledgeName != nil && strings.TrimSpace(*ctxInfo.KnowledgeName) != "" {
			kname = strings.TrimSpace(*ctxInfo.KnowledgeName)
		}
		if kname != "" {
			msgs = append(msgs, llm.ChatMessage{Role: "system", Content: "Knowledge (" + kname + "):\n" + kn})
		} else {
			msgs = append(msgs, llm.ChatMessage{Role: "system", Content: "Knowledge:\n" + kn})
		}
	}
	for _, m := range history {
		role := strings.ToLower(strings.TrimSpace(m.Role))
		if role != "user" && role != "assistant" && role != "system" {
			continue
		}
		msgs = append(msgs, llm.ChatMessage{Role: role, Content: m.Content})
	}

	reply, err := p.LLM.Stream(ctx, msgs, func(current string) {
		_ = p.Stream.NotifyStream(ctx, runID, threadID, current)
	})
	if err != nil {
		_ = p.failRun(ctx, runID, threadID, err)
		return err
	}
	if strings.TrimSpace(reply) == "" {
		err = fmt.Errorf("empty response from LLM")
		_ = p.failRun(ctx, runID, threadID, err)
		return err
	}

	_, err = p.Runs.UpdateStatusCAS(ctx, runID, threadID, repo.RunRunning, repo.RunSucceeded)
	if err != nil {
		return err
	}
	if err := p.Messages.Create(ctx, threadID, &runID, "assistant", reply); err != nil {
		log.Printf("insert assistant message failed: %v", err)
	}
	log.Printf("run %d completed: succeeded", runID)
	return nil
}

func (p *RunProcessor) failRun(ctx context.Context, runID, threadID int64, err error) error {
	_, _ = p.Runs.UpdateStatusCAS(ctx, runID, threadID, repo.RunRunning, repo.RunFailed)
	log.Printf("run %d failed: %v", runID, err)
	return err
}
