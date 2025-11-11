PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS user_session_v3 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

INSERT INTO user_session_v3 (id, user_id, expires_at)
SELECT
  id,
  user_id,
  COALESCE(
    expires_at,
    CAST(strftime('%s','now') + 60*60*24*30 AS INTEGER)
  )
FROM user_session
WHERE id IS NOT NULL AND user_id IS NOT NULL;

DROP TABLE user_session;
ALTER TABLE user_session_v3 RENAME TO user_session;

CREATE INDEX IF NOT EXISTS idx_user_session_user_id ON user_session(user_id);

COMMIT;
PRAGMA foreign_keys=on;
