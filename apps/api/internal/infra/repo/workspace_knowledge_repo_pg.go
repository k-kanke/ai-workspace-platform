package repo

import (
	"context"

	"ai-workspace-platform/api/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WorkspaceKnowledgeRepoPG struct{ DB *pgxpool.Pool }

func NewWorkspaceKnowledgeRepoPG(db *pgxpool.Pool) *WorkspaceKnowledgeRepoPG {
	return &WorkspaceKnowledgeRepoPG{DB: db}
}

func (r *WorkspaceKnowledgeRepoPG) GetByWorkspaceID(ctx context.Context, workspaceID int64) (*domain.WorkspaceKnowledge, error) {
	var k domain.WorkspaceKnowledge
	err := r.DB.QueryRow(ctx,
		`SELECT workspace_id, content, updated_at FROM workspace_knowledge WHERE workspace_id=$1`,
		workspaceID,
	).Scan(&k.WorkspaceID, &k.Content, &k.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &k, nil
}

func (r *WorkspaceKnowledgeRepoPG) Upsert(ctx context.Context, workspaceID int64, content string) (*domain.WorkspaceKnowledge, error) {
	var k domain.WorkspaceKnowledge
	err := r.DB.QueryRow(ctx,
		`INSERT INTO workspace_knowledge (workspace_id, content, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (workspace_id)
         DO UPDATE SET content=EXCLUDED.content, updated_at=NOW()
         RETURNING workspace_id, content, updated_at`,
		workspaceID, content,
	).Scan(&k.WorkspaceID, &k.Content, &k.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &k, nil
}
