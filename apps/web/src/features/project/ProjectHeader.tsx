import { useEffect, useRef, useState } from 'react';

import type { Project } from '../../lib/projects';
import type { ProjectMember } from '../../lib/project-members';
import { Avatar, BugIcon, Button, getAvatarColor, PlusIcon, TaskIcon } from '../../ui';
import { projectTypeLabel } from '../projects/projectTypes';

type ProjectHeaderProps = {
  project: Project;
  isOwner: boolean;
  members: ProjectMember[];
  onCreate: (type: 'task' | 'bug') => void;
  onOpenMembers: () => void;
};

const MAX_FACES = 4;

function CreateMenu({ onCreate }: { onCreate: (type: 'task' | 'bug') => void }) {
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

  const choose = (type: 'task' | 'bug') => {
    setOpen(false);
    onCreate(type);
  };

  return (
    <div className="qx-menu" ref={ref}>
      <Button
        variant="primary"
        icon={<PlusIcon size={16} />}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Crear
      </Button>
      {open ? (
        <div className="qx-menu-list" role="menu" aria-label="Crear ticket">
          <button type="button" role="menuitem" onClick={() => choose('task')}>
            <TaskIcon size={16} />
            <span>
              <strong>Tarea</strong>
              <small>Trabajo de QA por hacer</small>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => choose('bug')}>
            <BugIcon size={16} />
            <span>
              <strong>Bug</strong>
              <small>Un problema encontrado al probar</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ProjectHeader({ project, isOwner, members, onCreate, onOpenMembers }: ProjectHeaderProps) {
  const created = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(project.createdAt),
  );
  const meta = [projectTypeLabel(project.projectType), isOwner ? 'Tuyo' : 'Compartido contigo', `creado el ${created}`]
    .filter(Boolean)
    .join(' · ');
  const faces = members.slice(0, MAX_FACES);

  return (
    <header className="qx-header">
      {project.logoUrl ? (
        <img className="qx-mark" src={project.logoUrl} alt="" />
      ) : (
        <span className="qx-mark" style={{ background: getAvatarColor(project.name) }} aria-hidden="true">
          {project.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}

      <div className="qx-heading">
        <h1 className="qx-title">{project.name}</h1>
        {project.description?.trim() ? <p className="qx-description">{project.description.trim()}</p> : null}
        <p className="qx-meta">{meta}</p>
      </div>

      <div className="qx-actions">
        <Button onClick={onOpenMembers} aria-label={`Participantes (${members.length})`}>
          {faces.length > 0 ? (
            <span className="qx-faces" aria-hidden="true">
              {faces.map((member) => (
                <Avatar key={member.userId} name={member.name?.trim() || member.email} src={member.avatarUrl} size={22} />
              ))}
            </span>
          ) : null}
          Participantes
        </Button>
        <CreateMenu onCreate={onCreate} />
      </div>
    </header>
  );
}
