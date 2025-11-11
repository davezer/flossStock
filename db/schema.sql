-- =========================================================
-- FlossStock — Cloudflare D1 schema (Lucia v3 + App tables)
-- Safe to re-run (IF NOT EXISTS everywhere)
-- =========================================================

PRAGMA foreign_keys = ON;

-- ========== Lucia auth tables (Cloudflare D1) ==========
CREATE TABLE IF NOT EXISTS user (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS user_key (
  id              TEXT PRIMARY KEY,              -- e.g. "email:<email>" or "oauth:<provider>:<id>"
  user_id         TEXT NOT NULL,
  hashed_password TEXT,                          -- NULL for OAuth keys
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_key_user_id ON user_key(user_id);

-- Lucia D1 expects active_expires + idle_expires (NOT expires_at)
CREATE TABLE IF NOT EXISTS user_session (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  active_expires  INTEGER NOT NULL,
  idle_expires    INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_session_user_id ON user_session(user_id);

-- ========== Catalog ==========
CREATE TABLE IF NOT EXISTS brand (
  id    TEXT PRIMARY KEY,
  slug  TEXT UNIQUE NOT NULL,
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS line (
  id        TEXT PRIMARY KEY,
  brand_id  TEXT NOT NULL,
  slug      TEXT NOT NULL,
  name      TEXT NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE CASCADE,
  UNIQUE (brand_id, slug)
);

-- Colors keyed by (brand_id, code). `line_id` optional.
-- If you previously had `full_code`, you can derive it in queries as: slug||'-'||code
CREATE TABLE IF NOT EXISTS color (
  id         TEXT PRIMARY KEY,                   -- keep your existing ids (e.g. ULID)
  brand_id   TEXT NOT NULL,
  line_id    TEXT,                               -- nullable: not all brands use lines
  code       TEXT NOT NULL,                      -- e.g. "310"
  name       TEXT NOT NULL,                      -- e.g. "Black"
  hex        TEXT NOT NULL,                      -- e.g. "#000000"
  r          INTEGER,
  g          INTEGER,
  b          INTEGER,
  status     TEXT,                               -- optional (e.g. "active"/"discontinued")
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE CASCADE,
  FOREIGN KEY (line_id)  REFERENCES line(id)  ON DELETE SET NULL,
  UNIQUE (brand_id, code)
);
CREATE INDEX IF NOT EXISTS idx_color_brand_code ON color(brand_id, code);
CREATE INDEX IF NOT EXISTS idx_color_name       ON color(name);

-- ========== Inventory / "stash" ==========
-- Composite PK guarantees a single row per (user, color)
CREATE TABLE IF NOT EXISTS inventory (
  user_id    TEXT NOT NULL,
  color_id   TEXT NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 0,
  notes      TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, color_id),
  FOREIGN KEY (user_id)  REFERENCES user(id)   ON DELETE CASCADE,
  FOREIGN KEY (color_id) REFERENCES color(id)  ON DELETE CASCADE
);

-- Touch updated_at on change
CREATE TRIGGER IF NOT EXISTS trg_inventory_touch
AFTER UPDATE ON inventory
FOR EACH ROW
BEGIN
  UPDATE inventory
    SET updated_at = unixepoch()
    WHERE user_id = NEW.user_id AND color_id = NEW.color_id;
END;

-- Helpful rollup view
CREATE VIEW IF NOT EXISTS v_user_inventory_counts AS
SELECT
  i.user_id,
  COUNT(*)              AS distinct_colors,
  COALESCE(SUM(i.quantity), 0) AS total_skeins
FROM inventory i
GROUP BY i.user_id;
