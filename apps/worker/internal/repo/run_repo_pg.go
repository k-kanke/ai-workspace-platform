package repo

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type RunStatus string

const (
    RunQueued    RunStatus = "queued"
    RunRunning   RunStatus = "running"
    RunSucceeded RunStatus = "succeeded"
    RunFailed    RunStatus = "failed"
    RunCancelled RunStatus = "cancelled"
)

type Run struct {
    ID       int64
    ThreadID int64
    Status   RunStatus
}

type RunRepoPG struct{ DB *pgxpool.Pool }

func NewRunRepoPG(db *pgxpool.Pool) *RunRepoPG { return &RunRepoPG{DB: db} }

func (r *RunRepoPG) Get(ctx context.Context, id int64) (*Run, error) {
    var run Run
    var status string
    err := r.DB.QueryRow(ctx,
        `SELECT id, thread_id, status FROM runs WHERE id=$1`, id,
    ).Scan(&run.ID, &run.ThreadID, &status)
    if err != nil { return nil, err }
    run.Status = RunStatus(status)
    return &run, nil
}

func (r *RunRepoPG) UpdateStatusCAS(ctx context.Context, id, threadID int64, expect, next RunStatus) (bool, error) {
    ct, err := r.DB.Exec(ctx,
        `UPDATE runs SET status=$1, updated_at=NOW() WHERE id=$2 AND thread_id=$3 AND status=$4`,
        string(next), id, threadID, string(expect),
    )
    if err != nil { return false, err }
    return ct.RowsAffected() > 0, nil
}

