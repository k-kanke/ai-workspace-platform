package repo

import (
	"context"

	"ai-workspace-platform/api/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type KnowledgeRepoPG struct{ DB *pgxpool.Pool }

func NewKnowledgeRepoPG(db *pgxpool.Pool) *KnowledgeRepoPG { return &KnowledgeRepoPG{DB: db} }

func (r *KnowledgeRepoPG) Create(ctx context.Context, content string) (*domain.Knowledge, error) {
	var k domain.Knowledge
	err := r.DB.QueryRow(ctx,
		`INSERT INTO knowledge (content, created_at, updated_at)
         VALUES ($1, NOW(), NOW())
         RETURNING id, content, created_at, updated_at`,
		content,
	).Scan(&k.ID, &k.Content, &k.CreatedAt, &k.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &k, nil
}

func (r *KnowledgeRepoPG) Get(ctx context.Context, id int64) (*domain.Knowledge, error) {
	var k domain.Knowledge
	err := r.DB.QueryRow(ctx,
		`SELECT id, content, created_at, updated_at FROM knowledge WHERE id=$1`, id,
	).Scan(&k.ID, &k.Content, &k.CreatedAt, &k.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &k, nil
}

func (r *KnowledgeRepoPG) List(ctx context.Context, limit, offset int) ([]*domain.Knowledge, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := r.DB.Query(ctx,
		`SELECT id, content, created_at, updated_at
         FROM knowledge
         ORDER BY id DESC
         LIMIT $1 OFFSET $2`, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*domain.Knowledge, 0, limit)
	for rows.Next() {
		var k domain.Knowledge
		if err := rows.Scan(&k.ID, &k.Content, &k.CreatedAt, &k.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, &k)
	}
	return out, rows.Err()
}

func (r *KnowledgeRepoPG) Update(ctx context.Context, id int64, content string) (*domain.Knowledge, error) {
	var k domain.Knowledge
	err := r.DB.QueryRow(ctx,
		`UPDATE knowledge SET content=$2, updated_at=NOW()
         WHERE id=$1
         RETURNING id, content, created_at, updated_at`,
		id, content,
	).Scan(&k.ID, &k.Content, &k.CreatedAt, &k.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, err
		}
		return nil, err
	}
	return &k, nil
}
