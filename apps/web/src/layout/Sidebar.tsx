import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import {
  ArchiveIcon,
  Avatar,
  Button,
  CloseIcon,
  getAvatarColor,
  GridIcon,
  HomeIcon,
  LogoutIcon,
  MailIcon,
  PlusIcon,
  SelectorIcon,
  ShareIcon,
  UserIcon,
} from '../ui';
import type { NavProject } from './navigation';

const MAX_SIDEBAR_PROJECTS = 6;

export type SidebarUser = { name: string; email: string; avatarUrl: string | null };

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  onNewProject: () => void;
  projects: NavProject[];
  projectsLoading: boolean;
  projectsError: boolean;
  pendingInvitations: number;
  user: SidebarUser;
  onEditProfile: () => void;
  onLogout: () => void;
};

function NavItem({
  to,
  icon,
  children,
  end,
  onNavigate,
  badge,
}: {
  to: string;
  icon: ReactNode;
  children: ReactNode;
  end?: boolean;
  onNavigate: () => void;
  badge?: number;
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `ql-nav-item${isActive ? ' is-active' : ''}`} onClick={onNavigate}>
      <span className="ql-nav-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="ql-nav-label">{children}</span>
      {badge && badge > 0 ? (
        <span className="ql-nav-badge" aria-label={`${badge} pendientes`}>
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

function ProjectMark({ project }: { project: NavProject }) {
  if (project.logoUrl) {
    return <img className="ql-project-mark" src={project.logoUrl} alt="" />;
  }

  return (
    <span className="ql-project-mark" style={{ background: getAvatarColor(project.name) }}>
      {project.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function UserMenu({ user, onEditProfile, onLogout }: Pick<SidebarProps, 'user' | 'onEditProfile' | 'onLogout'>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
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
    <div className="ql-user" ref={containerRef}>
      {open ? (
        <div className="ql-user-menu" role="menu" aria-label="Tu cuenta">
          <button
            type="button"
            role="menuitem"
            className="ql-user-menu-item"
            onClick={() => {
              setOpen(false);
              onEditProfile();
            }}
          >
            <UserIcon size={16} />
            Mi perfil y contraseña
          </button>
          <hr className="ql-user-menu-sep" />
          <button type="button" role="menuitem" className="ql-user-menu-item is-danger" onClick={onLogout}>
            <LogoutIcon size={16} />
            Cerrar sesión
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="ql-user-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={user.name || user.email} src={user.avatarUrl} size={32} />
        <span className="ql-user-text">
          <span className="ql-user-name">{user.name || 'Tu cuenta'}</span>
          <span className="ql-user-email">{user.email}</span>
        </span>
        <SelectorIcon size={16} />
      </button>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
  onNewProject,
  projects,
  projectsLoading,
  projectsError,
  pendingInvitations,
  user,
  onEditProfile,
  onLogout,
}: SidebarProps) {
  const visibleProjects = projects.slice(0, MAX_SIDEBAR_PROJECTS);

  return (
    <aside className={`ql-sidebar${open ? ' is-open' : ''}`} aria-label="Navegación principal">
      <div className="ql-sidebar-head">
        {/* En modo oscuro, la versión monocroma blanca; el tema decide cuál se ve. */}
        <img className="ql-sidebar-logo ql-sidebar-logo--light" src="/logo-menu.png" alt="Qualio" />
        <img className="ql-sidebar-logo ql-sidebar-logo--dark" src="/logo-menu-dark.png" alt="Qualio" />
        <button type="button" className="q-icon-btn ql-sidebar-close" onClick={onClose} aria-label="Cerrar menú">
          <CloseIcon size={18} />
        </button>
      </div>

      <div className="ql-sidebar-cta">
        <Button variant="primary" block icon={<PlusIcon size={16} />} onClick={onNewProject}>
          Nuevo proyecto
        </Button>
      </div>

      <nav className="ql-sidebar-nav">
        <NavItem to="/app/dashboard" icon={<HomeIcon size={18} />} onNavigate={onClose}>
          Inicio
        </NavItem>

        <p className="ql-nav-section">Proyectos</p>
        {projectsLoading ? <span className="ql-nav-note">Cargando proyectos…</span> : null}
        {projectsError ? <span className="ql-nav-note">No se pudieron cargar tus proyectos.</span> : null}
        {!projectsLoading && !projectsError && projects.length === 0 ? (
          <span className="ql-nav-note">Aún no tienes proyectos activos.</span>
        ) : null}
        {visibleProjects.map((project) => (
          <NavItem
            key={project.id}
            to={`/app/proyectos/${project.id}`}
            icon={<ProjectMark project={project} />}
            onNavigate={onClose}
          >
            {project.name}
          </NavItem>
        ))}
        <NavItem to="/app/proyectos/activos" icon={<GridIcon size={18} />} onNavigate={onClose}>
          {projects.length > MAX_SIDEBAR_PROJECTS ? `Todos los proyectos (${projects.length})` : 'Todos los proyectos'}
        </NavItem>
        <NavItem to="/app/proyectos/archivados" icon={<ArchiveIcon size={18} />} onNavigate={onClose}>
          Archivados
        </NavItem>

        <p className="ql-nav-section">Colaboración</p>
        <NavItem
          to="/app/colaborar/invitaciones"
          icon={<MailIcon size={18} />}
          onNavigate={onClose}
          badge={pendingInvitations}
        >
          Invitaciones
        </NavItem>
        <NavItem to="/app/colaborar/compartidos" icon={<ShareIcon size={18} />} onNavigate={onClose}>
          Compartidos
        </NavItem>
      </nav>

      <UserMenu user={user} onEditProfile={onEditProfile} onLogout={onLogout} />
    </aside>
  );
}
