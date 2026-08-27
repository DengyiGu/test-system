-- 已经部署过旧版 0001 的项目需要这一步；新项目不会执行到这里。
ALTER TABLE issued_links ADD COLUMN first_opened_at TEXT;
ALTER TABLE issued_links ADD COLUMN expires_at TEXT;
CREATE INDEX IF NOT EXISTS idx_issued_links_expires_at ON issued_links(expires_at);