import { useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '../../lib/apiErrors';
import { listBugs } from '../../lib/bugs';
import { listProjects } from '../../lib/projects';
import { getActiveSprint } from '../../lib/sprints';
import { listTasks } from '../../lib/tasks';
import { computeProgress, progressLabel } from '../projects/progress';
import { ProjectMark } from '../projects/ProjectMark';
import { projectTypeLabel } from '../projects/projectTypes';
import { Button, Card, EmptyState, ShareIcon } from '../../ui';
import { sharedWithMe } from './collabLogic';
import './collab.css';

export function SharedProjectsView({ currentUserId }: { currentUserId: string | null }) {
  const accessToken = localStorage.getItem('qualio_access_token') ?? '';
  const navigate = useNavigate();

  const projectsQuery = useQuery({
    queryKey: ['projects', 'ACTIVE', 'sidebar'],
    queryFn: () => listProjects(accessToken, 'ACTIVE'),
    enabled: Boolean(accessToken),
    retry: false,
  });

  const shared = sharedWithMe(projectsQuery.data ?? [], currentUserId);
  const ids = shared.map((project) => project.id);
  const tasks = useQueries({
    queries: ids.map((id) => ({ queryKey: ['tasks', id], queryFn: () => listTasks(accessToken, id), retry: false })),
  });
  const bugs = useQueries({
    queries: ids.map((id) => ({ queryKey: ['bugs', id], queryFn: () => listBugs(accessToken, id), retry: false })),
  });
  const sprints = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['active-sprint', id],
      queryFn: () => getActiveSprint(accessToken, id),
      retry: false,
    })),
  });

  const open = (id: string) => navigate(`/app/proyectos/${id}`);

  return (
    <section className="qc6-page">
      <header className="qc6-page-header">
        <h1 className="qc6-page-title">Compartidos contigo</h1>
        <p className="qc6-page-subtitle">Proyectos de otras personas en los que participas.</p>
      </header>

      {projectsQuery.isPending && accessToken ? <p className="qc6-note">Cargando proyectos…</p> : null}

      {projectsQuery.isError ? (
        <Card>
          <EmptyState
            title="No pudimos cargar los proyectos"
            description={getApiErrorMessage(projectsQuery.error)}
            action={<Button onClick={() => projectsQuery.refetch()}>Reintentar</Button>}
          />
        </Card>
      ) : null}

      {projectsQuery.isSuccess && shared.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShareIcon size={22} />}
            title="Nadie ha compartido un proyecto contigo"
            description="Cuando aceptes una invitación, el proyecto aparecerá aquí y en tu lista de proyectos."
            action={<Button onClick={() => navigate('/app/colaborar/invitaciones')}>Ver invitaciones</Button>}
          />
        </Card>
      ) : null}

      {shared.length > 0 ? (
        <Card padded={false} className="qp-table">
          <div className="qp-head" aria-hidden="true">
            <span>Proyecto</span>
            <span>Sprint</span>
            <span>Avance</span>
            <span>Bugs abiertos</span>
            <span />
          </div>
          <ul className="qp-rows">
            {shared.map((project, index) => {
              const sprint = sprints[index]?.data;
              const stats = computeProgress(tasks[index]?.data, bugs[index]?.data, sprint);
              const percent = stats?.percent ?? 0;
              return (
                <li key={project.id} className="qp-row" onClick={() => open(project.id)}>
                  <span className="qp-name">
                    <ProjectMark project={project} />
                    <span className="qp-name-text">
                      <a
                        className="qp-name-title"
                        href={`/app/proyectos/${project.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          open(project.id);
                        }}
                      >
                        {project.name}
                      </a>
                      <span className="qp-name-meta">{projectTypeLabel(project.projectType) ?? 'Proyecto'}</span>
                    </span>
                  </span>
                  <span className={`qp-cell${sprint ? '' : ' qp-muted'}`} data-label="Sprint">
                    {sprint === undefined ? '…' : sprint ? sprint.name : 'Sin sprint'}
                  </span>
                  <span className="qp-cell qp-progress" data-label="Avance">
                    <span>{stats ? progressLabel(stats, Boolean(sprint)) : '…'}</span>
                    <span
                      className="qp-bar"
                      role="progressbar"
                      aria-label={`Avance de ${project.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent}
                    >
                      <span style={{ width: `${percent}%` }} />
                    </span>
                  </span>
                  <span className={`qp-cell${stats && stats.highOpenBugs > 0 ? ' qp-hot' : ''}`} data-label="Bugs abiertos">
                    {stats ? stats.openBugs : '…'}
                  </span>
                  <span />
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
