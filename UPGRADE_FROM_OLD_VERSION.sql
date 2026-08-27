-- Use this only when upgrading an existing database from the original schema.
ALTER TABLE issued_links ADD COLUMN first_opened_at TEXT;
ALTER TABLE issued_links ADD COLUMN expires_at TEXT;
CREATE INDEX IF NOT EXISTS idx_issued_links_expires_at ON issued_links(expires_at);
