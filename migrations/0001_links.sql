CREATE TABLE IF NOT EXISTS issued_links (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  customer_label TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'claimed', 'completed')),
  answers_json TEXT NOT NULL DEFAULT '[]',
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_opened_at TEXT,
  expires_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_issued_links_token_hash ON issued_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_issued_links_expires_at ON issued_links(expires_at);