BEGIN;

ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE knowledge
SET name = 'Knowledge ' || id
WHERE name IS NULL OR name = '';

ALTER TABLE knowledge ALTER COLUMN name SET NOT NULL;

COMMIT;
