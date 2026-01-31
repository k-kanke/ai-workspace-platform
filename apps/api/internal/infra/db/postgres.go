package db

import (
    "context"
    "fmt"

    "github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
    if dsn == "" {
        return nil, fmt.Errorf("DATABASE_URL is empty")
    }
    cfg, err := pgxpool.ParseConfig(dsn)
    if err != nil {
        return nil, err
    }
    pool, err := pgxpool.NewWithConfig(ctx, cfg)
    if err != nil {
        return nil, err
    }
    if err := pool.Ping(ctx); err != nil {
        pool.Close()
        return nil, err
    }
    return pool, nil
}
