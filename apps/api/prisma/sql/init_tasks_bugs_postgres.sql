ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS project_type VARCHAR(40);

CREATE TABLE IF NOT EXISTS project_members (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_project_members_role CHECK (role IN ('ADMIN', 'MEMBER')),
  CONSTRAINT uq_project_members UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

CREATE TABLE IF NOT EXISTS project_item_sequences (
  project_id VARCHAR(36) PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_item_sequences_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_invitations (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  inviter_user_id VARCHAR(36) NOT NULL,
  invited_user_id VARCHAR(36),
  invited_email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  CONSTRAINT fk_project_invitations_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_invitations_inviter FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_invitations_invited_user FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_project_invitations_role CHECK (role IN ('ADMIN', 'MEMBER')),
  CONSTRAINT chk_project_invitations_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_project_invitations_invited_email ON project_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_invited_user ON project_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON project_invitations(status);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  project_id VARCHAR(36),
  entity_type VARCHAR(20),
  entity_id VARCHAR(36),
  action_type VARCHAR(40),
  action_id VARCHAR(36),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS sprints (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  sequence INTEGER NOT NULL,
  name VARCHAR(60) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sprints_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_sprints_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_sprints_status CHECK (status IN ('ACTIVE', 'CLOSED')),
  CONSTRAINT uq_sprints_project_sequence UNIQUE (project_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project_id);

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY,
  item_key VARCHAR(80),
  project_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(20) NOT NULL DEFAULT 'TODO',
  section VARCHAR(30) NOT NULL DEFAULT 'GENERAL_BACKLOG',
  position INTEGER NOT NULL DEFAULT 0,
  assigned_to VARCHAR(36),
  due_date TIMESTAMP,
  sprint_id VARCHAR(36),
  completed_in_sprint_id VARCHAR(36),
  rollover_from_sprint_id VARCHAR(36),
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_tasks_priority CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  CONSTRAINT chk_tasks_status CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
  CONSTRAINT chk_tasks_section CHECK (section IN ('NEXT_SPRINT', 'GENERAL_BACKLOG', 'SPRINT_BOARD'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_section_position ON tasks(project_id, section, position);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_item_key ON tasks(item_key);

ALTER TABLE tasks
  ALTER COLUMN assigned_to TYPE VARCHAR(36);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sprint_id VARCHAR(36),
  ADD COLUMN IF NOT EXISTS completed_in_sprint_id VARCHAR(36),
  ADD COLUMN IF NOT EXISTS rollover_from_sprint_id VARCHAR(36);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tasks' AND constraint_name = 'fk_tasks_sprint'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_sprint
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tasks' AND constraint_name = 'fk_tasks_completed_in_sprint'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_completed_in_sprint
      FOREIGN KEY (completed_in_sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tasks' AND constraint_name = 'fk_tasks_rollover_from_sprint'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_rollover_from_sprint
      FOREIGN KEY (rollover_from_sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE tasks t
SET assigned_to = NULL
WHERE assigned_to IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = t.assigned_to
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'tasks'
      AND constraint_name = 'fk_tasks_assigned_to'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_assigned_to
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS bugs (
  id VARCHAR(36) PRIMARY KEY,
  item_key VARCHAR(80),
  project_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  section VARCHAR(30) NOT NULL DEFAULT 'GENERAL_BACKLOG',
  position INTEGER NOT NULL DEFAULT 0,
  environment VARCHAR(120),
  expected_result TEXT,
  actual_result TEXT,
  sprint_id VARCHAR(36),
  completed_in_sprint_id VARCHAR(36),
  rollover_from_sprint_id VARCHAR(36),
  reported_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bugs_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_bugs_reported_by FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_bugs_priority CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  CONSTRAINT chk_bugs_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  CONSTRAINT chk_bugs_section CHECK (section IN ('NEXT_SPRINT', 'GENERAL_BACKLOG', 'SPRINT_BOARD'))
);

CREATE INDEX IF NOT EXISTS idx_bugs_project ON bugs(project_id);
CREATE INDEX IF NOT EXISTS idx_bugs_project_section_position ON bugs(project_id, section, position);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bugs_item_key ON bugs(item_key);

ALTER TABLE bugs
  ADD COLUMN IF NOT EXISTS sprint_id VARCHAR(36),
  ADD COLUMN IF NOT EXISTS completed_in_sprint_id VARCHAR(36),
  ADD COLUMN IF NOT EXISTS rollover_from_sprint_id VARCHAR(36);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'bugs' AND constraint_name = 'fk_bugs_sprint'
  ) THEN
    ALTER TABLE bugs
      ADD CONSTRAINT fk_bugs_sprint
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'bugs' AND constraint_name = 'fk_bugs_completed_in_sprint'
  ) THEN
    ALTER TABLE bugs
      ADD CONSTRAINT fk_bugs_completed_in_sprint
      FOREIGN KEY (completed_in_sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'bugs' AND constraint_name = 'fk_bugs_rollover_from_sprint'
  ) THEN
    ALTER TABLE bugs
      ADD CONSTRAINT fk_bugs_rollover_from_sprint
      FOREIGN KEY (rollover_from_sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS work_item_attachments (
  id VARCHAR(36) PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  storage_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attach_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_attach_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_attach_entity_type CHECK (entity_type IN ('TASK', 'BUG'))
);

CREATE INDEX IF NOT EXISTS idx_attach_entity ON work_item_attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attach_project ON work_item_attachments(project_id);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS item_key VARCHAR(80);
ALTER TABLE bugs ADD COLUMN IF NOT EXISTS item_key VARCHAR(80);
