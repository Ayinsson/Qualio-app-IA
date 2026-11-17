import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { listBugs } from '../../lib/bugs';
import { archiveProject, createProject, listProjects, updateProject } from '../../lib/projects';
import type { Project } from '../../lib/projects';
import { getActiveSprint } from '../../lib/sprints';
import { listTasks } from '../../lib/tasks';
import {
  ArchiveIcon,
  Button,
  Card,
  ChevronRightIcon,
  DotsIcon,
  EmptyState,
  GridIcon,
  Input,
  Modal,
  PlusIcon,
  RestoreIcon,
  SearchIcon,
  useToast,
} from '../../ui';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { CreateProjectModal } from './CreateProjectModal';
import { ProjectMark } from './ProjectMark';
import type { NewProjectValues } from './CreateProjectModal';
import { computeProgress, progressLabel } from './progress';
import { filterProjects } from './projectsLogic';
import { projectTypeLabel } from './projectTypes';
import './projects.css';

type ProjectsViewProps = {
  tab: 'active' | 'archived';
  /** Abre el modal de creación (ruta /app/proyectos/nuevo). */
  createOpen?: boolean;
  currentUserId: string | null;
};

function RowMenu({ projectName, onOpen, onArchive }: { projectName: string; onOpen: () => void; onArchive: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="qp-menu" ref={ref}>
      <button
        type="button"
        className="q-icon-btn"
        aria-label={`Acciones de ${projectName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <DotsIcon size={18} />
      </button>
      {open ? (
        <div className="qp-menu-list" role="menu">
          <button type="button" role="menuitem" onClick={onOpen}>
            <ChevronRightIcon size={16} />
            Abrir
          </button>
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={() => {
              setOpen(false);
              onArchive();
            }}
          >
            <ArchiveIcon size={16} />
            Archivar
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ProjectsView({ tab, createOpen = false, currentUserId }: ProjectsViewProps) {
  const accessToken = localStorage.getItem('qualio_access_token') ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [toArchive, setToArchive] = useState<Project | null>(null);

  const activeQuery = useQuery({
    queryKey: ['projects', 'ACTIVE', 'sidebar'],
    queryFn: () => listProjects(accessToken, 'ACTIVE'),
    enabled: Boolean(accessToken),
    retry: false,
  });
  const archivedQuery = useQuery({
    queryKey: ['projects', 'ARCHIVED'],
    queryFn: () => listProjects(accessToken, 'ARCHIVED'),
    enabled: Boolean(accessToken),
    retry: false,
  });

  const activeProjects = useMemo(() => activeQuery.data ?? [], [activeQuery.data]);
  const archivedProjects = useMemo(() => archivedQuery.data ?? [], [archivedQuery.data]);
  const currentQuery = tab === 'active' ? activeQuery : archivedQuery;
  const source = tab === 'active' ? activeProjects : archivedProjects;
  const visible = filterProjects(source, query);

  const activeIds = tab === 'active' ? visible.map((project) => project.id) : [];
  const tasks = useQueries({
    queries: activeIds.map((id) => ({
      queryKey: ['tasks', id],
      queryFn: () => listTasks(accessToken, id),
      retry: false,
    })),
  });
  const sprints = useQueries({
    queries: activeIds.map((id) => ({
      queryKey: ['active-sprint', id],
      queryFn: () => getActiveSprint(accessToken, id),
      retry: false,
    })),
  });
  const bugs = useQueries({
    queries: activeIds.map((id) => ({
      queryKey: ['bugs', id],
      queryFn: () => listBugs(accessToken, id),
      retry: false,
    })),
  });

  useEffect(() => {
    setQuery('');
  }, [tab]);

  const refreshProjects = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

  const createMutation = useMutation({
    mutationFn: (values: NewProjectValues) =>
      createProject(accessToken, {
        name: values.name,
        projectType: values.projectType,
        logoUrl: values.logoUrl || undefined,
        description: values.description || undefined,
      }),
    onSuccess: (created) => {
      void refreshProjects();
      toast(`Proyecto "${created.name}" creado.`);
      navigate(`/app/proyectos/${created.id}`, { replace: true });
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  const archiveMutation = useMutation({
    mutationFn: (project: Project) => archiveProject(accessToken, project.id),
    onSuccess: (_, project) => {
      void refreshProjects();
      setToArchive(null);
      toast(`"${project.name}" se archivó. Puedes restaurarlo desde Archivados.`);
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  const restoreMutation = useMutation({
    mutationFn: (project: Project) => updateProject(accessToken, project.id, { status: 'ACTIVE' }),
    onSuccess: (_, project) => {
      void refreshProjects();
      toast(`"${project.name}" volvió a tus proyectos activos.`);
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  const openProject = (project: Project) => navigate(`/app/proyectos/${project.id}`);
  const closeCreate = () => navigate('/app/proyectos/activos', { replace: true });
  const isMine = (project: Project) => Boolean(currentUserId) && project.ownerId === currentUserId;
  const ownership = (project: Project) => (isMine(project) ? 'Tuyo' : 'Compartido contigo');

  const formatDay = (value: string) =>
    new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

  const renderList = () => {
    if (currentQuery.isPending) {
      return <p className="qp-note">Cargando proyectos…</p>;
    }

    if (currentQuery.isError) {
      return <p className="qp-note">No pudimos cargar tus proyectos. Revisa tu conexión y recarga la página.</p>;
    }

    if (source.length === 0) {
      return tab === 'active' ? (
        <Card padded={false}>
          <EmptyState
            icon={<GridIcon size={22} />}
            title="Crea tu primer proyecto"
            description="Un proyecto agrupa las tareas, los bugs y los sprints de un producto que estás probando."
            action={
              <Button variant="primary" icon={<PlusIcon size={16} />} onClick={() => navigate('/app/proyectos/nuevo')}>
                Nuevo proyecto
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padded={false}>
          <EmptyState
            icon={<ArchiveIcon size={22} />}
            title="No hay proyectos archivados"
            description="Archiva un proyecto cuando termine. Sale de tu lista y de tu panel, pero conserva sus tareas y bugs."
          />
        </Card>
      );
    }

    if (visible.length === 0) {
      return <p className="qp-note">Ningún proyecto coincide con "{query.trim()}".</p>;
    }

    if (tab === 'archived') {
      return (
        <Card padded={false} className="qp-table">
          <div className="qp-head qp-head--archived" aria-hidden="true">
            <span>Proyecto</span>
            <span>Archivado</span>
            <span />
          </div>
          <ul className="qp-rows">
            {visible.map((project) => (
              <li key={project.id} className="qp-row qp-row--archived">
                <span className="qp-name">
                  <ProjectMark project={project} />
                  <span className="qp-name-text">
                    <span className="qp-name-title">{project.name}</span>
                    <span className="qp-name-meta">
                      {[projectTypeLabel(project.projectType), ownership(project)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </span>
                <span className="qp-cell qp-muted" data-label="Archivado">
                  {formatDay(project.updatedAt)}
                </span>
                <span className="qp-actions">
                  {isMine(project) ? (
                    <Button
                      size="sm"
                      icon={<RestoreIcon size={14} />}
                      loading={restoreMutation.isPending && restoreMutation.variables?.id === project.id}
                      onClick={() => restoreMutation.mutate(project)}
                    >
                      Restaurar
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      );
    }

    return (
      <Card padded={false} className="qp-table">
        <div className="qp-head" aria-hidden="true">
          <span>Proyecto</span>
          <span>Sprint</span>
          <span>Avance</span>
          <span>Bugs abiertos</span>
          <span />
        </div>
        <ul className="qp-rows">
          {visible.map((project, index) => {
            const sprint = sprints[index]?.data;
            const stats = computeProgress(tasks[index]?.data, bugs[index]?.data, sprint);
            const percent = stats?.percent ?? 0;

            return (
              <li key={project.id} className="qp-row" onClick={() => openProject(project)}>
                <span className="qp-name">
                  <ProjectMark project={project} />
                  <span className="qp-name-text">
                    <a
                      className="qp-name-title"
                      href={`/app/proyectos/${project.id}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openProject(project);
                      }}
                    >
                      {project.name}
                    </a>
                    <span className="qp-name-meta">
                      {[projectTypeLabel(project.projectType), ownership(project)].filter(Boolean).join(' · ')}
                    </span>
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
                  {stats
                    ? stats.highOpenBugs > 0
                      ? `${stats.openBugs} · ${stats.highOpenBugs} ${stats.highOpenBugs === 1 ? 'alto' : 'altos'}`
                      : stats.openBugs
                    : '…'}
                </span>
                <span className="qp-actions" onClick={(event) => event.stopPropagation()}>
                  {isMine(project) ? (
                    <RowMenu projectName={project.name} onOpen={() => openProject(project)} onArchive={() => setToArchive(project)} />
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    );
  };

  return (
    <section className="qp">
      <header className="qp-header">
        <div>
          <h1 className="qp-title">Proyectos</h1>
          <p className="qp-subtitle">Organiza el trabajo de QA de cada producto.</p>
        </div>
        {/* Con la lista de activos vacía, el estado vacío ya ofrece la acción: no la repetimos. */}
        {tab === 'active' && activeQuery.isSuccess && activeProjects.length === 0 ? null : (
          <Button variant="primary" icon={<PlusIcon size={16} />} onClick={() => navigate('/app/proyectos/nuevo')}>
            Nuevo proyecto
          </Button>
        )}
      </header>

      <div className="qp-toolbar">
        <nav className="qp-tabs" aria-label="Estado de los proyectos">
          <NavLink to="/app/proyectos/activos" className={({ isActive }) => `qp-tab${isActive || createOpen ? ' is-active' : ''}`}>
            Activos <span className="qp-tab-count">{activeQuery.data ? activeProjects.length : ''}</span>
          </NavLink>
          <NavLink to="/app/proyectos/archivados" className={({ isActive }) => `qp-tab${isActive ? ' is-active' : ''}`}>
            Archivados <span className="qp-tab-count">{archivedQuery.data ? archivedProjects.length : ''}</span>
          </NavLink>
        </nav>
        {source.length > 0 ? (
          <label className="qp-search">
            <SearchIcon size={16} />
            <span className="sr-only">Buscar proyecto</span>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === 'active' ? 'Buscar proyecto' : 'Buscar en archivados'}
            />
          </label>
        ) : null}
      </div>

      {renderList()}

      {createOpen ? (
        <CreateProjectModal
          open
          creating={createMutation.isPending}
          onClose={closeCreate}
          onCreate={(values) => createMutation.mutate(values)}
        />
      ) : null}

      <Modal
        open={Boolean(toArchive)}
        title={toArchive ? `¿Archivar ${toArchive.name}?` : ''}
        onClose={() => setToArchive(null)}
        footer={
          <>
            <Button onClick={() => setToArchive(null)}>Cancelar</Button>
            <Button
              variant="danger"
              loading={archiveMutation.isPending}
              onClick={() => toArchive && archiveMutation.mutate(toArchive)}
            >
              Archivar proyecto
            </Button>
          </>
        }
      >
        <p className="qp-confirm">
          Dejará de aparecer en tu lista, en la barra lateral y en el panel de inicio. Sus tareas y bugs se conservan, y
          puedes restaurarlo desde Archivados.
        </p>
      </Modal>
    </section>
  );
}
