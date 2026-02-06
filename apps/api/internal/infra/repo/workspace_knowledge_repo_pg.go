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
		`SELECT wkl.workspace_id, k.id, k.content, k.updated_at
         FROM workspace_knowledge_links wkl
         JOIN knowledge k ON k.id = wkl.knowledge_id
         WHERE wkl.workspace_id=$1
         ORDER BY wkl.created_at DESC
         LIMIT 1`,
		workspaceID,
	).Scan(&k.WorkspaceID, &k.KnowledgeID, &k.Content, &k.UpdatedAt)
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
	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var knowledgeID int64
	err = tx.QueryRow(ctx,
		`SELECT k.id
         FROM workspace_knowledge_links wkl
         JOIN knowledge k ON k.id = wkl.knowledge_id
         WHERE wkl.workspace_id=$1
         ORDER BY wkl.created_at DESC
         LIMIT 1`,
		workspaceID,
	).Scan(&knowledgeID)
	if err != nil && err != pgx.ErrNoRows {
		return nil, err
	}

	if err == pgx.ErrNoRows {
		err = tx.QueryRow(ctx,
			`INSERT INTO knowledge (content, created_at, updated_at)
             VALUES ($1, NOW(), NOW())
             RETURNING id, content, updated_at`,
			content,
		).Scan(&k.KnowledgeID, &k.Content, &k.UpdatedAt)
		if err != nil {
			return nil, err
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO workspace_knowledge_links (workspace_id, knowledge_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
			workspaceID, k.KnowledgeID,
		)
		if err != nil {
			return nil, err
		}
	} else {
		err = tx.QueryRow(ctx,
			`UPDATE knowledge SET content=$2, updated_at=NOW()
             WHERE id=$1
             RETURNING id, content, updated_at`,
			knowledgeID, content,
		).Scan(&k.KnowledgeID, &k.Content, &k.UpdatedAt)
		if err != nil {
			return nil, err
		}
	}
	k.WorkspaceID = workspaceID
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &k, nil
}
