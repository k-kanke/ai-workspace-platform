BEGIN;

-- Add surrogate key and created_at to existing workspace_knowledge, then rename to knowledge
ALTER TABLE workspace_knowledge ADD COLUMN IF NOT EXISTS id SERIAL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_knowledge_pkey'
  ) THEN
    ALTER TABLE workspace_knowledge DROP CONSTRAINT workspace_knowledge_pkey;
  END IF;
END $$;

ALTER TABLE workspace_knowledge ADD CONSTRAINT workspace_knowledge_pkey PRIMARY KEY (id);

ALTER TABLE workspace_knowledge
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE workspace_knowledge RENAME TO knowledge;

-- Create link table (many-to-many)
CREATE TABLE IF NOT EXISTS workspace_knowledge_links (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  knowledge_id INTEGER NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, knowledge_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_knowledge_links_workspace_id ON workspace_knowledge_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_knowledge_links_knowledge_id ON workspace_knowledge_links(knowledge_id);

-- Backfill links from existing knowledge rows
INSERT INTO workspace_knowledge_links (workspace_id, knowledge_id)
SELECT workspace_id, id FROM knowledge
WHERE workspace_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop old FK column now that links exist
ALTER TABLE knowledge DROP COLUMN IF EXISTS workspace_id;

COMMIT;
