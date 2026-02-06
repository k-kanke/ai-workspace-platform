package repo

import (
	"context"

	"ai-workspace-platform/api/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WorkspaceKnowledgeLinkRepoPG struct{ DB *pgxpool.Pool }

func NewWorkspaceKnowledgeLinkRepoPG(db *pgxpool.Pool) *WorkspaceKnowledgeLinkRepoPG {
	return &WorkspaceKnowledgeLinkRepoPG{DB: db}
}

func (r *WorkspaceKnowledgeLinkRepoPG) ListByWorkspace(ctx context.Context, workspaceID int64) ([]*domain.Knowledge, error) {
	rows, err := r.DB.Query(ctx,
		`SELECT k.id, k.content, k.created_at, k.updated_at
         FROM workspace_knowledge_links wkl
         JOIN knowledge k ON k.id = wkl.knowledge_id
         WHERE wkl.workspace_id=$1
         ORDER BY wkl.created_at DESC`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*domain.Knowledge
	for rows.Next() {
		var k domain.Knowledge
		if err := rows.Scan(&k.ID, &k.Content, &k.CreatedAt, &k.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, &k)
	}
	return out, rows.Err()
}

func (r *WorkspaceKnowledgeLinkRepoPG) Link(ctx context.Context, workspaceID, knowledgeID int64) error {
	_, err := r.DB.Exec(ctx,
		`INSERT INTO workspace_knowledge_links (workspace_id, knowledge_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
		workspaceID, knowledgeID,
	)
	return err
}

func (r *WorkspaceKnowledgeLinkRepoPG) Unlink(ctx context.Context, workspaceID, knowledgeID int64) error {
	cmd, err := r.DB.Exec(ctx,
		`DELETE FROM workspace_knowledge_links WHERE workspace_id=$1 AND knowledge_id=$2`,
		workspaceID, knowledgeID,
	)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
