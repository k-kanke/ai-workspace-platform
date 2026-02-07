package repo

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type WorkspaceContext struct {
	WorkspaceID      int64
	SystemPrompt     *string
	LLMEnabled       bool
	KnowledgeName    *string
	KnowledgeContent *string
}

type ContextRepoPG struct{ DB *pgxpool.Pool }

func NewContextRepoPG(db *pgxpool.Pool) *ContextRepoPG { return &ContextRepoPG{DB: db} }

func (r *ContextRepoPG) GetByThreadID(ctx context.Context, threadID int64) (*WorkspaceContext, error) {
	var c WorkspaceContext
	err := r.DB.QueryRow(ctx,
		`SELECT w.id, w.system_prompt, w.llm_enabled, k.name, k.content
         FROM threads t
         JOIN workspaces w ON w.id = t.workspace_id
         LEFT JOIN LATERAL (
           SELECT k.name, k.content
           FROM workspace_knowledge_links wkl
           JOIN knowledge k ON k.id = wkl.knowledge_id
           WHERE wkl.workspace_id = w.id
           ORDER BY wkl.created_at DESC
           LIMIT 1
         ) k ON true
         WHERE t.id = $1`,
		threadID,
	).Scan(&c.WorkspaceID, &c.SystemPrompt, &c.LLMEnabled, &c.KnowledgeName, &c.KnowledgeContent)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
