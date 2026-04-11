const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  const projectId = 'f9a2d5e3-7b30-4f34-932f-0d5e8af78a11';
  const sprint1 = '4f30aa11-8a9f-4b9f-a001-61db2506ab11';
  const sprint2 = '4f30aa11-8a9f-4b9f-a001-61db2506ab22';
  const sprint3 = '4f30aa11-8a9f-4b9f-a001-61db2506ab33';
  const sprint4 = '4f30aa11-8a9f-4b9f-a001-61db2506ab44';

  const owners = await prisma.$queryRawUnsafe('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
  const ownerId = owners[0]?.id;

  if (!ownerId) {
    throw new Error('No hay usuarios para crear dataset.');
  }

  await prisma.$executeRawUnsafe(`DELETE FROM projects WHERE id = '${projectId}'`);

  await prisma.$executeRawUnsafe(
    `INSERT INTO projects (id, name, owner_id, status, created_at, updated_at)
     VALUES ('${projectId}', 'Proyecto QA Reportes Demo', '${ownerId}', 'ACTIVE', NOW() - INTERVAL '95 days', NOW())`,
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO project_members (id, project_id, user_id, role, created_at)
     VALUES ('7e420d9b-f5f9-4a8d-99a3-f7d7c851b0aa', '${projectId}', '${ownerId}', 'ADMIN', NOW() - INTERVAL '95 days')
     ON CONFLICT (project_id, user_id) DO NOTHING`,
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO sprints (id, project_id, sequence, name, status, started_at, closed_at, created_by, created_at)
     VALUES
     ('${sprint1}', '${projectId}', 1, 'Sprint 1', 'CLOSED', NOW() - INTERVAL '82 days', NOW() - INTERVAL '68 days', '${ownerId}', NOW() - INTERVAL '82 days'),
     ('${sprint2}', '${projectId}', 2, 'Sprint 2', 'CLOSED', NOW() - INTERVAL '67 days', NOW() - INTERVAL '53 days', '${ownerId}', NOW() - INTERVAL '67 days'),
     ('${sprint3}', '${projectId}', 3, 'Sprint 3', 'CLOSED', NOW() - INTERVAL '52 days', NOW() - INTERVAL '35 days', '${ownerId}', NOW() - INTERVAL '52 days'),
     ('${sprint4}', '${projectId}', 4, 'Sprint 4', 'ACTIVE', NOW() - INTERVAL '12 days', NULL, '${ownerId}', NOW() - INTERVAL '12 days')`,
  );

  for (let g = 1; g <= 18; g += 1) {
    const id = `20000000-0000-0000-0000-${String(g).padStart(12, '0')}`;
    const itemKey = `RPTD-T${String(g).padStart(3, '0')}`;
    const priority = g % 4 === 0 ? 'HIGH' : g % 2 === 0 ? 'MEDIUM' : 'LOW';
    const status = g <= 13 ? 'DONE' : g <= 16 ? 'IN_PROGRESS' : 'TODO';
    const section = g <= 16 ? 'SPRINT_BOARD' : 'GENERAL_BACKLOG';
    const sprintId = g <= 6 ? sprint1 : g <= 10 ? sprint2 : g <= 16 ? sprint4 : null;
    const completedIn = g <= 6 ? sprint1 : g <= 10 ? sprint2 : g <= 13 ? sprint3 : null;
    const rollover = g === 15 || g === 16 ? sprint3 : null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO tasks (id, item_key, project_id, title, description, priority, status, section, position, assigned_to, due_date, sprint_id, completed_in_sprint_id, rollover_from_sprint_id, created_by, updated_by, last_change_note, created_at, updated_at)
       VALUES ('${id}', '${itemKey}', '${projectId}', 'Tarea demo #${g}', 'Seed dataset para reportes.', '${priority}', '${status}', '${section}', ${g}, NULL, NOW() + INTERVAL '10 days', ${sprintId ? `'${sprintId}'` : 'NULL'}, ${completedIn ? `'${completedIn}'` : 'NULL'}, ${rollover ? `'${rollover}'` : 'NULL'}, '${ownerId}', '${ownerId}', 'Seed dataset reportes QA', NOW() - INTERVAL '${90 - g * 2} days', NOW() - INTERVAL '${78 - g * 2} days')`,
    );
  }

  for (let g = 1; g <= 14; g += 1) {
    const id = `30000000-0000-0000-0000-${String(g).padStart(12, '0')}`;
    const itemKey = `RPTD-B${String(g).padStart(3, '0')}`;
    const priority = g % 3 === 0 ? 'HIGH' : g % 2 === 0 ? 'MEDIUM' : 'LOW';
    const status = g <= 4 ? 'CLOSED' : g <= 7 ? 'RESOLVED' : g <= 10 ? 'CLOSED' : g <= 12 ? 'IN_PROGRESS' : 'OPEN';
    const section = g <= 12 ? 'SPRINT_BOARD' : 'GENERAL_BACKLOG';
    const sprintId = g <= 4 ? sprint1 : g <= 7 ? sprint2 : g <= 12 ? sprint4 : null;
    const completedIn = g <= 4 ? sprint1 : g <= 7 ? sprint2 : g <= 10 ? sprint3 : null;
    const rollover = g === 11 || g === 12 ? sprint3 : null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO bugs (id, item_key, project_id, title, description, priority, status, section, position, environment, expected_result, actual_result, sprint_id, completed_in_sprint_id, rollover_from_sprint_id, reported_by, updated_by, last_change_note, created_at, updated_at)
       VALUES ('${id}', '${itemKey}', '${projectId}', 'Bug demo #${g}', 'Seed dataset para reportes.', '${priority}', '${status}', '${section}', ${g}, 'QA demo', 'No debe fallar', 'Presenta falla controlada', ${sprintId ? `'${sprintId}'` : 'NULL'}, ${completedIn ? `'${completedIn}'` : 'NULL'}, ${rollover ? `'${rollover}'` : 'NULL'}, '${ownerId}', '${ownerId}', 'Seed dataset reportes QA', NOW() - INTERVAL '${88 - g * 2} days', NOW() - INTERVAL '${76 - g * 2} days')`,
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO work_item_history (id, entity_type, entity_id, project_id, changed_by, field_name, old_value, new_value, change_note, created_at)
     VALUES
      ('91000000-0000-0000-0000-000000000001', 'TASK', '20000000-0000-0000-0000-000000000005', '${projectId}', '${ownerId}', 'status', 'DONE', 'TODO', 'Seed dataset reportes QA', NOW() - INTERVAL '17 days'),
      ('91000000-0000-0000-0000-000000000002', 'BUG', '30000000-0000-0000-0000-000000000004', '${projectId}', '${ownerId}', 'status', 'CLOSED', 'OPEN', 'Seed dataset reportes QA', NOW() - INTERVAL '8 days'),
      ('91000000-0000-0000-0000-000000000003', 'TASK', '20000000-0000-0000-0000-000000000011', '${projectId}', '${ownerId}', 'status', 'DONE', 'IN_PROGRESS', 'Seed dataset reportes QA', NOW() - INTERVAL '4 days')`,
  );

  console.log('Seed reports dummy data: OK');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
