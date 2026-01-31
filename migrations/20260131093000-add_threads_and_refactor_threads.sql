-- Add threads table and refactor runs/messages to thread-scoped

BEGIN;

-- 1) Create threads table
CREATE TABLE IF NOT EXISTS threads (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_workspace_id ON threads(workspace_id);

-- 2) Add thread_id columns (nullable for backfill)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS thread_id INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id INTEGER;

-- 3) Backfill: create one default thread per workspace (for existing data)
INSERT INTO threads (workspace_id, title)
SELECT w.id, 'Migrated default thread'
FROM workspaces w
ON CONFLICT DO NOTHING;

-- 4) Backfill: link existing runs/messages to the default thread of their workspace
UPDATE runs r
SET thread_id = t.id
FROM threads t
WHERE t.workspace_id = r.workspace_id
  AND r.thread_id IS NULL;

UPDATE messages m
SET thread_id = t.id
FROM threads t
WHERE t.workspace_id = m.workspace_id
  AND m.thread_id IS NULL;

-- 5) Add FKs and NOT NULL constraints on thread_id
ALTER TABLE runs
  ADD CONSTRAINT runs_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE;

ALTER TABLE messages
  ADD CONSTRAINT messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE;

ALTER TABLE runs ALTER COLUMN thread_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN thread_id SET NOT NULL;

-- 6) Drop workspace_id from runs/messages and related indexes/constraints
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'runs_workspace_id_fkey'
  ) THEN
    ALTER TABLE runs DROP CONSTRAINT runs_workspace_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_workspace_id_fkey'
  ) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_workspace_id_fkey;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_runs_workspace_id;
DROP INDEX IF EXISTS idx_messages_workspace_id;

ALTER TABLE runs DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE messages DROP COLUMN IF EXISTS workspace_id;

-- 7) Add new indexes for thread_id
CREATE INDEX IF NOT EXISTS idx_runs_thread_id ON runs(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);

COMMIT;

