package repo

import (
	"context"

	"ai-workspace-platform/api/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ThreadRepoPG struct{ DB *pgxpool.Pool }

func NewThreadRepoPG(db *pgxpool.Pool) *ThreadRepoPG { return &ThreadRepoPG{DB: db} }

func (r *ThreadRepoPG) Create(ctx context.Context, workspaceID int64, title *string) (*domain.Thread, error) {
	var t domain.Thread
	err := r.DB.QueryRow(ctx,
		`INSERT INTO threads (workspace_id, title) VALUES ($1, $2) RETURNING id, workspace_id, title, created_at`,
		workspaceID, title,
	).Scan(&t.ID, &t.WorkspaceID, &t.Title, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *ThreadRepoPG) Get(ctx context.Context, id int64) (*domain.Thread, error) {
	var t domain.Thread
	err := r.DB.QueryRow(ctx,
		`SELECT id, workspace_id, title, created_at FROM threads WHERE id=$1`, id,
	).Scan(&t.ID, &t.WorkspaceID, &t.Title, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *ThreadRepoPG) ListByWorkspace(ctx context.Context, workspaceID int64, limit, offset int) ([]*domain.Thread, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := r.DB.Query(ctx,
		`SELECT id, workspace_id, title, created_at FROM threads
         WHERE workspace_id=$1
         ORDER BY id DESC
         LIMIT $2 OFFSET $3`, workspaceID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*domain.Thread, 0, limit)
	for rows.Next() {
		var t domain.Thread
		if err := rows.Scan(&t.ID, &t.WorkspaceID, &t.Title, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, &t)
	}
	return out, rows.Err()
}

func (r *ThreadRepoPG) UpdateTitle(ctx context.Context, id int64, title *string) (*domain.Thread, error) {
	var t domain.Thread
	err := r.DB.QueryRow(ctx,
		`UPDATE threads SET title=$2 WHERE id=$1 RETURNING id, workspace_id, title, created_at`,
		id, title,
	).Scan(&t.ID, &t.WorkspaceID, &t.Title, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *ThreadRepoPG) Delete(ctx context.Context, id int64) error {
	cmd, err := r.DB.Exec(ctx, `DELETE FROM threads WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
