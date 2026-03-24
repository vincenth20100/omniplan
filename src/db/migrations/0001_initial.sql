-- 0001_initial.sql
-- Full schema DDL for OmniPlan PostgreSQL database.
-- Run 0000_extensions.sql first to enable uuid-ossp and vector extensions.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('active', 'archived', 'template');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('owner', 'editor', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE link_type AS ENUM ('FS', 'SS', 'FF', 'SF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  status      project_status NOT NULL DEFAULT 'active',
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- project_members  (composite PK: project_id + user_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_members (
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  role         member_role NOT NULL,
  display_name TEXT,
  photo_url    TEXT,
  permissions  JSONB,
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_project_idx ON project_members (project_id);
CREATE INDEX IF NOT EXISTS project_members_user_idx    ON project_members (user_id);

-- ---------------------------------------------------------------------------
-- calendars
-- Defined before tasks so tasks can reference calendar_id.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendars (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  definition  JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS calendars_project_idx ON calendars (project_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id            UUID REFERENCES tasks(id) ON DELETE SET NULL,
  name                 TEXT NOT NULL,
  start_date           TIMESTAMP,
  finish_date          TIMESTAMP,
  duration             REAL,
  duration_unit        TEXT,
  work                 REAL,
  scheduling_type      TEXT,
  constraint_type      TEXT,
  constraint_date      TIMESTAMP,
  deadline             TIMESTAMP,
  percent_complete     INTEGER NOT NULL DEFAULT 0,
  status               TEXT,
  is_milestone         BOOLEAN NOT NULL DEFAULT FALSE,
  is_summary           BOOLEAN NOT NULL DEFAULT FALSE,
  is_collapsed         BOOLEAN NOT NULL DEFAULT FALSE,
  is_on_critical_path  BOOLEAN NOT NULL DEFAULT FALSE,
  total_float          REAL,
  free_float           REAL,
  wbs                  TEXT,
  outline_level        INTEGER NOT NULL DEFAULT 0,
  calendar_id          UUID REFERENCES calendars(id) ON DELETE SET NULL,
  notes                TEXT,
  custom_fields        JSONB NOT NULL DEFAULT '{}',
  "order"              INTEGER,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  -- pgvector embedding — nullable; populated only when AI embedding is enabled
  embedding            vector(1536)
);

CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_parent_idx  ON tasks (parent_id);

-- ---------------------------------------------------------------------------
-- links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type         link_type NOT NULL DEFAULT 'FS',
  lag               REAL DEFAULT 0,
  lag_unit          TEXT DEFAULT 'days',
  source_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  target_project_id UUID REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS links_project_idx ON links (project_id);
CREATE INDEX IF NOT EXISTS links_source_idx  ON links (source_task_id);
CREATE INDEX IF NOT EXISTS links_target_idx  ON links (target_task_id);

-- ---------------------------------------------------------------------------
-- resources
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  initials     TEXT,
  type         TEXT NOT NULL DEFAULT 'Work',
  category     TEXT,
  max_units    REAL DEFAULT 1,
  cost_per_hour REAL DEFAULT 0,
  availability REAL DEFAULT 1,
  email        TEXT,
  calendar_id  UUID REFERENCES calendars(id) ON DELETE SET NULL,
  "order"      INTEGER
);

CREATE INDEX IF NOT EXISTS resources_project_idx ON resources (project_id);

-- ---------------------------------------------------------------------------
-- assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  resource_id  UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  units        REAL DEFAULT 1,
  work         REAL
);

-- ---------------------------------------------------------------------------
-- baselines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS baselines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  snapshot    JSONB NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS baselines_project_idx ON baselines (project_id);

-- ---------------------------------------------------------------------------
-- history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL,
  action              TEXT NOT NULL,
  payload_description TEXT,
  diff                JSONB,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS history_project_time_idx ON history (project_id, created_at);
CREATE INDEX IF NOT EXISTS history_user_idx         ON history (user_id);

-- ---------------------------------------------------------------------------
-- pg_notify trigger function for SSE real-time updates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_project_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'omniplan_project_' || COALESCE(NEW.project_id, OLD.project_id)::text,
    json_build_object(
      'table', TG_TABLE_NAME,
      'op',    TG_OP,
      'id',    COALESCE(NEW.id, OLD.id)
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tasks_notify
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_project_change();

CREATE OR REPLACE TRIGGER links_notify
  AFTER INSERT OR UPDATE OR DELETE ON links
  FOR EACH ROW EXECUTE FUNCTION notify_project_change();
