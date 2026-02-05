package repo

import (
	"ai-workspace-platform/api/internal/domain"
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type WorkspaceRepoPG struct{ DB *pgxpool.Pool }

func NewWorkspaceRepoPG(db *pgxpool.Pool) *WorkspaceRepoPG { return &WorkspaceRepoPG{DB: db} }

func (r *WorkspaceRepoPG) Create(ctx context.Context, name *string, systemPrompt *string) (*domain.Workspace, error) {
	var w domain.Workspace
	err := r.DB.QueryRow(ctx,
		`INSERT INTO workspaces (name, system_prompt) VALUES ($1, $2) RETURNING id, name, system_prompt, created_at`,
		name, systemPrompt,
	).Scan(&w.ID, &w.Name, &w.SystemPrompt, &w.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *WorkspaceRepoPG) Get(ctx context.Context, id int64) (*domain.Workspace, error) {
	var w domain.Workspace
	err := r.DB.QueryRow(ctx,
		`SELECT id, name, system_prompt, created_at FROM workspaces WHERE id=$1`, id,
	).Scan(&w.ID, &w.Name, &w.SystemPrompt, &w.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *WorkspaceRepoPG) List(ctx context.Context, limit, offset int) ([]*domain.Workspace, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := r.DB.Query(ctx,
		`SELECT id, name, system_prompt, created_at FROM workspaces ORDER BY id DESC LIMIT $1 OFFSET $2`, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*domain.Workspace, 0, limit)
	for rows.Next() {
		var w domain.Workspace
		if err := rows.Scan(&w.ID, &w.Name, &w.SystemPrompt, &w.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, &w)
	}
	return out, rows.Err()
}

func (r *WorkspaceRepoPG) UpdateSystemPrompt(ctx context.Context, id int64, systemPrompt *string) (*domain.Workspace, error) {
	var w domain.Workspace
	err := r.DB.QueryRow(ctx,
		`UPDATE workspaces SET system_prompt=$2 WHERE id=$1 RETURNING id, name, system_prompt, created_at`,
		id, systemPrompt,
	).Scan(&w.ID, &w.Name, &w.SystemPrompt, &w.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &w, nil
}
