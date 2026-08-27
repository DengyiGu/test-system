-- Run this only for projects that already used the earlier 0001 migration. New projects do not need it.
ALTER TABLE issued_links ADD COLUMN first_opened_at TEXT;
ALTER TABLE issued_links ADD COLUMN expires_at TEXT;
CREATE INDEX IF NOT EXISTS idx_issued_links_expires_at ON issued_links(expires_at);
