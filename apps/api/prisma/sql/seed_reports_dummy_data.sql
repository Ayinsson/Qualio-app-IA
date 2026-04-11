DO $$
DECLARE
  v_owner_id VARCHAR(36);
  v_project_id CONSTANT VARCHAR(36) := 'f9a2d5e3-7b30-4f34-932f-0d5e8af78a11';
  v_sprint_1_id CONSTANT VARCHAR(36) := '4f30aa11-8a9f-4b9f-a001-61db2506ab11';
  v_sprint_2_id CONSTANT VARCHAR(36) := '4f30aa11-8a9f-4b9f-a001-61db2506ab22';
  v_sprint_3_id CONSTANT VARCHAR(36) := '4f30aa11-8a9f-4b9f-a001-61db2506ab33';
  v_sprint_4_id CONSTANT VARCHAR(36) := '4f30aa11-8a9f-4b9f-a001-61db2506ab44';
BEGIN
  SELECT id
  INTO v_owner_id
  FROM users
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuarios para crear dataset.';
  END IF;

  DELETE FROM projects WHERE id = v_project_id;

  INSERT INTO projects (id, name, owner_id, status, created_at, updated_at)
  VALUES (
    v_project_id,
    'Proyecto QA Reportes Demo',
    v_owner_id,
    'ACTIVE',
    NOW() - INTERVAL '95 days',
    NOW()
  );

  INSERT INTO project_members (id, project_id, user_id, role, created_at)
  VALUES (
    '7e420d9b-f5f9-4a8d-99a3-f7d7c851b0aa',
    v_project_id,
    v_owner_id,
    'ADMIN',
    NOW() - INTERVAL '95 days'
  )
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO sprints (id, project_id, sequence, name, status, started_at, closed_at, created_by, created_at)
  VALUES
    (v_sprint_1_id, v_project_id, 1, 'Sprint 1', 'CLOSED', NOW() - INTERVAL '82 days', NOW() - INTERVAL '68 days', v_owner_id, NOW() - INTERVAL '82 days'),
    (v_sprint_2_id, v_project_id, 2, 'Sprint 2', 'CLOSED', NOW() - INTERVAL '67 days', NOW() - INTERVAL '53 days', v_owner_id, NOW() - INTERVAL '67 days'),
    (v_sprint_3_id, v_project_id, 3, 'Sprint 3', 'CLOSED', NOW() - INTERVAL '52 days', NOW() - INTERVAL '35 days', v_owner_id, NOW() - INTERVAL '52 days'),
    (v_sprint_4_id, v_project_id, 4, 'Sprint 4', 'ACTIVE', NOW() - INTERVAL '12 days', NULL, v_owner_id, NOW() - INTERVAL '12 days');

  INSERT INTO tasks (
    id, item_key, project_id, title, description, priority, status, section, position,
    assigned_to, due_date, sprint_id, completed_in_sprint_id, rollover_from_sprint_id,
    created_by, updated_by, last_change_note, created_at, updated_at
  )
  SELECT
    '20000000-0000-0000-0000-' || LPAD(g::text, 12, '0') AS id,
    'RPTD-T' || LPAD(g::text, 3, '0') AS item_key,
    v_project_id,
    'Tarea demo #' || g,
    'Seed dataset para reportes.',
    CASE WHEN g % 4 = 0 THEN 'HIGH' WHEN g % 2 = 0 THEN 'MEDIUM' ELSE 'LOW' END,
    CASE
      WHEN g <= 6 THEN 'DONE'
      WHEN g <= 10 THEN 'DONE'
      WHEN g <= 13 THEN 'DONE'
      WHEN g <= 16 THEN 'IN_PROGRESS'
      ELSE 'TODO'
    END,
    CASE
      WHEN g <= 16 THEN 'SPRINT_BOARD'
      ELSE 'GENERAL_BACKLOG'
    END,
    g,
    NULL,
    NOW() + INTERVAL '10 days',
    CASE
      WHEN g <= 6 THEN v_sprint_1_id
      WHEN g <= 10 THEN v_sprint_2_id
      WHEN g <= 16 THEN v_sprint_4_id
      ELSE NULL
    END,
    CASE
      WHEN g <= 6 THEN v_sprint_1_id
      WHEN g <= 10 THEN v_sprint_2_id
      WHEN g <= 13 THEN v_sprint_3_id
      ELSE NULL
    END,
    CASE WHEN g IN (15, 16) THEN v_sprint_3_id ELSE NULL END,
    v_owner_id,
    v_owner_id,
    'Seed dataset reportes QA',
    NOW() - ((90 - g * 2) || ' days')::interval,
    NOW() - ((78 - g * 2) || ' days')::interval
  FROM generate_series(1, 18) AS g;

  INSERT INTO bugs (
    id, item_key, project_id, title, description, priority, status, section, position,
    environment, expected_result, actual_result, sprint_id, completed_in_sprint_id, rollover_from_sprint_id,
    reported_by, updated_by, last_change_note, created_at, updated_at
  )
  SELECT
    '30000000-0000-0000-0000-' || LPAD(g::text, 12, '0') AS id,
    'RPTD-B' || LPAD(g::text, 3, '0') AS item_key,
    v_project_id,
    'Bug demo #' || g,
    'Seed dataset para reportes.',
    CASE WHEN g % 3 = 0 THEN 'HIGH' WHEN g % 2 = 0 THEN 'MEDIUM' ELSE 'LOW' END,
    CASE
      WHEN g <= 4 THEN 'CLOSED'
      WHEN g <= 7 THEN 'RESOLVED'
      WHEN g <= 10 THEN 'CLOSED'
      WHEN g <= 12 THEN 'IN_PROGRESS'
      ELSE 'OPEN'
    END,
    CASE
      WHEN g <= 12 THEN 'SPRINT_BOARD'
      ELSE 'GENERAL_BACKLOG'
    END,
    g,
    'QA demo',
    'No debe fallar',
    'Presenta falla controlada',
    CASE
      WHEN g <= 4 THEN v_sprint_1_id
      WHEN g <= 7 THEN v_sprint_2_id
      WHEN g <= 12 THEN v_sprint_4_id
      ELSE NULL
    END,
    CASE
      WHEN g <= 4 THEN v_sprint_1_id
      WHEN g <= 7 THEN v_sprint_2_id
      WHEN g <= 10 THEN v_sprint_3_id
      ELSE NULL
    END,
    CASE WHEN g IN (11, 12) THEN v_sprint_3_id ELSE NULL END,
    v_owner_id,
    v_owner_id,
    'Seed dataset reportes QA',
    NOW() - ((88 - g * 2) || ' days')::interval,
    NOW() - ((76 - g * 2) || ' days')::interval
  FROM generate_series(1, 14) AS g;

  INSERT INTO work_item_history (
    id, entity_type, entity_id, project_id, changed_by, field_name, old_value, new_value, change_note, created_at
  ) VALUES
    ('91000000-0000-0000-0000-000000000001', 'TASK', '20000000-0000-0000-0000-000000000005', v_project_id, v_owner_id, 'status', 'DONE', 'TODO', 'Seed dataset reportes QA', NOW() - INTERVAL '17 days'),
    ('91000000-0000-0000-0000-000000000002', 'BUG', '30000000-0000-0000-0000-000000000004', v_project_id, v_owner_id, 'status', 'CLOSED', 'OPEN', 'Seed dataset reportes QA', NOW() - INTERVAL '8 days'),
    ('91000000-0000-0000-0000-000000000003', 'TASK', '20000000-0000-0000-0000-000000000011', v_project_id, v_owner_id, 'status', 'DONE', 'IN_PROGRESS', 'Seed dataset reportes QA', NOW() - INTERVAL '4 days');
END $$;
