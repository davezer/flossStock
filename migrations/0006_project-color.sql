-- Migration number: 0006 	 2025-11-15T19:37:13.021Z
-- Create new table with full correct schema
CREATE TABLE project_color_new (
  project_id  TEXT NOT NULL,
  color_id    TEXT NOT NULL,
  assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),

  PRIMARY KEY (project_id, color_id),

  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (color_id)   REFERENCES color(id)
);

-- Copy existing data over (no assigned_at yet — default will handle it)
INSERT INTO project_color_new (project_id, color_id)
SELECT project_id, color_id FROM project_color;

-- Swap tables
DROP TABLE project_color;
ALTER TABLE project_color_new RENAME TO project_color;

-- Re-create indexes
CREATE INDEX idx_project_color_color ON project_color (color_id);
CREATE INDEX idx_project_color_project ON project_color (project_id);
