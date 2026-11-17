import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { listBugs } from '../../lib/bugs';
import type { Bug } from '../../lib/bugs';
import { listProjects } from '../../lib/projects';
import type { Project } from '../../lib/projects';
import { getActiveSprint } from '../../lib/sprints';
import type { Sprint } from '../../lib/sprints';
import { listTasks } from '../../lib/tasks';
import type { Task } from '../../lib/tasks';
import { Button, Card, EmptyState, getAvatarColor, ItemKey, PlusIcon, Priority, StatusBadge } from '../../ui';
import {
  assignedTasks,
  buildSummary,
  describeDue,
  firstName,
  greeting,
  reportedAgo,
  urgentBugs,
} from './dashboardLogic';
import type { WithProject } from './dashboardLogic';
import { computeProgress, progressLabel } from '../projects/progress';
import type { ProjectProgress } from '../projects/progress';
import './dashboard.css';

const MAX_TASKS = 8;
const MAX_BUGS = 6;

type DashboardUser = { id: string | null; name: string | null; email: string | null };

function useProjectData(accessToken: string, projects: Project[]) {
  const ids = projects.map((project) => project.id);

  const sprints = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['active-sprint', id],
      queryFn: () => getActiveSprint(accessToken, id),
      retry: false,
    })),
  });
  const tasks = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['tasks', id],
      queryFn: () => listTasks(accessToken, id),
      retry: false,
    })),
  });
  const bugs = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['bugs', id],
      queryFn: () => listBugs(accessToken, id),
      retry: false,
    })),
  });

  const loadingItems = tasks.some((query) => query.isPending) || bugs.some((query) => query.isPending);
  const failedItems = tasks.some((query) => query.isError) || bugs.some((query) => query.isError);

  const allTasks: Array<WithProject<Task>> = projects.flatMap((project, index) =>
    (tasks[index]?.data ?? []).map((task) => ({ ...task, project: { id: project.id, name: project.name } })),
  );
  const allBugs: Array<WithProject<Bug>> = projects.flatMap((project, index) =>
    (bugs[index]?.data ?? []).map((bug) => ({ ...bug, project: { id: project.id, name: project.name } })),
  );

  return {
    allTasks,
    allBugs,
    loadingItems,
    failedItems,
    progressFor: (index: number): ProjectProgress | null =>
      computeProgress(tasks[index]?.data, bugs[index]?.data, sprints[index]?.data),
    sprintFor: (index: number): Sprint | null | undefined => sprints[index]?.data,
  };
}

function ProjectMark({ project }: { project: Project }) {
  if (project.logoUrl) {
    return <img className="qd-project-mark" src={project.logoUrl} alt="" />;
  }
  return (
    <span className="qd-project-mark" style={{ background: getAvatarColor(project.name) }} aria-hidden="true">
      {project.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function EmptyDashboard({ name }: { name: string }) {
  const navigate = useNavigate();

  return (
    <section className="qd">
      <header className="qd-head">
        <h1 className="qd-title">Bienvenido a Qualio{name ? `, ${name}` : ''}</h1>
        <p className="qd-summary">Aquí verás tus tareas, los bugs que necesitan atención y el avance de cada sprint.</p>
      </header>

      <Card className="qd-start">
        <div>
          <h2 className="qd-start-title">Crea tu primer proyecto</h2>
          <p className="qd-start-text">
            Un proyecto agrupa las tareas, los bugs y los sprints de un producto que estás probando.
          </p>
          <Button variant="primary" icon={<PlusIcon size={16} />} onClick={() => navigate('/app/proyectos/nuevo')}>
            Nuevo proyecto
          </Button>
        </div>
        <ol className="qd-steps">
          <li>
            <strong>Crea un proyecto</strong>
            Por ejemplo, la web de tu tienda o una app.
          </li>
          <li>
            <strong>Agrega tareas y reporta bugs</strong>
            Todo entra al backlog con su prioridad.
          </li>
          <li>
            <strong>Inicia un sprint</strong>
            Mueve el trabajo al tablero y sigue el avance aquí.
          </li>
        </ol>
      </Card>
    </section>
  );
}

export function DashboardView({ user }: { user: DashboardUser }) {
  const accessToken = localStorage.getItem('qualio_access_token') ?? '';
  const navigate = useNavigate();

  const projectsQuery = useQuery({
    queryKey: ['projects', 'ACTIVE', 'sidebar'],
    queryFn: () => listProjects(accessToken, 'ACTIVE'),
    enabled: Boolean(accessToken),
    retry: false,
  });
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const data = useProjectData(accessToken, projects);

  const name = firstName(user.name, user.email);
  const myTasks = assignedTasks(data.allTasks, user.id);
  const bugs = urgentBugs(data.allBugs);
  const summary = buildSummary(myTasks, bugs);

  if (projectsQuery.isPending) {
    return (
      <section className="qd">
        <p className="qd-note">Cargando tu panel…</p>
      </section>
    );
  }

  if (projectsQuery.isError) {
    return (
      <section className="qd">
        <h1 className="qd-title">{greeting()}{name ? `, ${name}` : ''}</h1>
        <p className="qd-note">No pudimos cargar tus proyectos. Revisa tu conexión y recarga la página.</p>
      </section>
    );
  }

  if (projects.length === 0) {
    return <EmptyDashboard name={name} />;
  }

  // Sin tareas ni bugs urgentes: en vez de dos paneles vacíos, una sola buena noticia.
  const allClear = !data.loadingItems && !data.failedItems && myTasks.length === 0 && bugs.length === 0;

  return (
    <section className="qd">
      <header className="qd-head">
        <h1 className="qd-title">
          {greeting()}
          {name ? `, ${name}` : ''}
        </h1>
        {data.loadingItems ? (
          <p className="qd-summary">Revisando tus tareas y bugs…</p>
        ) : (
          <p className="qd-summary">
            {summary.map((part, index) =>
              part.strong ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>,
            )}
          </p>
        )}
        {data.failedItems ? (
          <p className="qd-warning">Algunos proyectos no respondieron; el resumen puede estar incompleto.</p>
        ) : null}
      </header>

      <div className="qd-grid">
        <div className="qd-column">
          {allClear ? (
            <Card className="qd-clear">
              <EmptyState
                illustrated
                title="Todo al día"
                description="No tienes tareas asignadas ni bugs de prioridad alta abiertos. Buen momento para revisar el backlog de tus proyectos."
              />
            </Card>
          ) : (
            <>
              <Card padded={false} className="qd-panel">
                <header className="qd-panel-head">
                  <h2>Asignado a ti</h2>
                  <span className="qd-count">{myTasks.length}</span>
                </header>
                {!data.loadingItems && myTasks.length === 0 ? (
                  <p className="qd-panel-empty">Nada pendiente. Las tareas que te asignen aparecerán aquí.</p>
                ) : null}
                <ul className="qd-list">
                  {myTasks.slice(0, MAX_TASKS).map((task) => {
                    const due = describeDue(task.dueDate);
                    return (
                      <li key={task.id}>
                        <Link className="qd-row" to={`/app/proyectos/${task.project.id}`}>
                          <ItemKey itemType="task" value={task.itemKey ?? 'TSK'} />
                          <span className="qd-row-text">
                            <span className="qd-row-title">{task.title}</span>
                            <span className="qd-row-meta">{task.project.name}</span>
                          </span>
                          <Priority value={task.priority} showLabel={false} />
                          {due ? (
                            <span className={`qd-due is-${due.tone}`}>{due.label}</span>
                          ) : (
                            <StatusBadge status={task.status} />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {myTasks.length > MAX_TASKS ? (
                  <p className="qd-more">y {myTasks.length - MAX_TASKS} más en tus proyectos</p>
                ) : null}
              </Card>

              <Card padded={false} className="qd-panel">
                <header className="qd-panel-head">
                  <h2>Bugs de prioridad alta</h2>
                  <span className="qd-count">{bugs.length} {bugs.length === 1 ? 'abierto' : 'abiertos'}</span>
                </header>
                {!data.loadingItems && bugs.length === 0 ? (
                  <p className="qd-panel-empty">Ningún bug de prioridad alta abierto. Buen trabajo.</p>
                ) : null}
                <ul className="qd-list">
                  {bugs.slice(0, MAX_BUGS).map((bug) => (
                    <li key={bug.id}>
                      <Link className="qd-row qd-row--bug" to={`/app/proyectos/${bug.project.id}`}>
                        <ItemKey itemType="bug" value={bug.itemKey ?? 'BUG'} />
                        <span className="qd-row-text">
                          <span className="qd-row-title">{bug.title}</span>
                          <span className="qd-row-meta">
                            {bug.project.name} · reportado {reportedAgo(bug.createdAt)}
                          </span>
                        </span>
                        <StatusBadge status={bug.status} itemType="bug" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {bugs.length > MAX_BUGS ? <p className="qd-more">y {bugs.length - MAX_BUGS} más</p> : null}
              </Card>
            </>
          )}
        </div>

        <Card padded={false} className="qd-panel qd-projects">
          <header className="qd-panel-head">
            <h2>Tus proyectos</h2>
            <Link className="qd-link" to="/app/proyectos/activos">
              Ver todos
            </Link>
          </header>
          <ul className="qd-list">
            {projects.map((project, index) => {
              const sprint = data.sprintFor(index);
              const progress = data.progressFor(index);
              const percent = progress?.percent ?? 0;

              return (
                <li key={project.id}>
                  <button
                    type="button"
                    className="qd-project"
                    onClick={() => navigate(`/app/proyectos/${project.id}`)}
                  >
                    <span className="qd-project-name">
                      <ProjectMark project={project} />
                      {project.name}
                    </span>
                    <span className="qd-project-meta">
                      {sprint ? sprint.name : 'Sin sprint activo'}
                      {progress
                        ? ` · ${progressLabel(progress, Boolean(sprint))} · ${progress.openBugs} ${progress.openBugs === 1 ? 'bug abierto' : 'bugs abiertos'}`
                        : ''}
                    </span>
                    <span
                      className="qd-progress"
                      role="progressbar"
                      aria-label={`Avance de ${project.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent}
                    >
                      <span style={{ width: `${percent}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </section>
  );
}
