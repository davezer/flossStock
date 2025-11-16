-- 005_project_color.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS project_color (
  project_id  TEXT NOT NULL,
  color_id    TEXT NOT NULL,
  assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),

  PRIMARY KEY (project_id, color_id),

  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (color_id)   REFERENCES color(id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_project_color_color
  ON project_color (color_id);

CREATE INDEX IF NOT EXISTS idx_project_color_project
  ON project_color (project_id);
