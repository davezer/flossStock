-- =========================================================
-- FlossStock — Cloudflare D1 schema (Lucia v3 + App tables)
-- Safe to re-run (IF NOT EXISTS everywhere)
-- =========================================================

PRAGMA foreign_keys = ON;

-- ========== Lucia auth tables (Cloudflare D1) ==========

CREATE TABLE IF NOT EXISTS user (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  username   TEXT,                          -- NEW: app username
  avatar_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- NEW: enforce uniqueness for non-null usernames
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username ON user(username);

CREATE TABLE IF NOT EXISTS user_key (
  id              TEXT PRIMARY KEY,              -- e.g. "email:<email>" or "oauth:<provider>:<id>"
  user_id         TEXT NOT NULL,
  hashed_password TEXT,                          -- NULL for OAuth keys
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_key_user_id ON user_key(user_id);

-- Lucia D1 expects active_expires + idle_expires (NOT expires_at)
CREATE TABLE IF NOT EXISTS session (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  active_expires  INTEGER NOT NULL,
  idle_expires    INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);

-- ========== Catalog ==========

CREATE TABLE IF NOT EXISTS brand (
  id    TEXT PRIMARY KEY,          -- e.g. 'dmc'
  slug  TEXT UNIQUE NOT NULL,      -- e.g. 'dmc'
  name  TEXT NOT NULL              -- e.g. 'DMC'
);

CREATE TABLE IF NOT EXISTS line (
  id        TEXT PRIMARY KEY,      -- e.g. 'dmc:default'
  brand_id  TEXT NOT NULL,
  slug      TEXT NOT NULL,         -- e.g. 'default' or 'six-strand'
  name      TEXT NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE CASCADE,
  UNIQUE (brand_id, slug)
);

-- Aligns with your seed: line_id is required; full_code is optional
CREATE TABLE IF NOT EXISTS color (
  id         TEXT PRIMARY KEY,                           -- e.g. 'dmc:default:310'
  line_id    TEXT NOT NULL REFERENCES line(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,                              -- '310'
  full_code  TEXT,                                       -- e.g. 'B5200' (nullable)
  name       TEXT NOT NULL,                              -- 'Black'
  hex        TEXT NOT NULL,                              -- '#000000'
  r          INTEGER,
  g          INTEGER,
  b          INTEGER,
  status     TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (line_id, code)                                 -- fast lookup per line
);

CREATE INDEX IF NOT EXISTS idx_color_name ON color(name);

-- Convenience view to expose brand_id without storing it twice
CREATE VIEW IF NOT EXISTS v_color_with_brand AS
SELECT c.*, l.brand_id
FROM color c
JOIN line  l ON l.id = c.line_id;

-- ========== Inventory / "stash" ==========

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
  COUNT(*)                    AS distinct_colors,
  COALESCE(SUM(i.quantity), 0) AS total_skeins
FROM inventory i
GROUP BY i.user_id;

-- ========== Shopping list / wishlist ==========
CREATE TABLE IF NOT EXISTS wishlist (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id)   ON DELETE CASCADE,
  color_id    TEXT NOT NULL REFERENCES color(id) ON DELETE CASCADE,
  desired_qty INTEGER NOT NULL DEFAULT 1,
  notes       TEXT,                               -- <— add this
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, color_id)
);

CREATE VIEW IF NOT EXISTS v_user_wishlist_counts AS
SELECT
  w.user_id,
  COUNT(*) AS distinct_colors,
  COALESCE(SUM(w.desired_qty), 0) AS total_desired
FROM wishlist w
GROUP BY w.user_id;
