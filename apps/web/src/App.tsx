import { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { z } from 'zod';

import { changePassword, getSessionUser, login, register, updateAvatar, updateProfile } from './lib/auth';
import {
  archiveProject,
  createProject,
  getProject,
  listProjects,
  type ProjectType,
} from './lib/projects';
import { listAttachments, registerAttachment, type WorkItemAttachment } from './lib/attachments';
import { createBug, listBugHistory, listBugs, moveBug, reopenBug, updateBug, type Bug, type WorkItemHistory as BugHistory } from './lib/bugs';
import {
  acceptInvitation,
  cancelProjectInvitation,
  createInvitation,
  listInvitationNotifications,
  listProjectPendingInvitations,
  markAllInvitationsRead,
  rejectInvitation,
  type AppNotification,
  type ProjectPendingInvitation,
} from './lib/invitations';
import { listProjectMembers, removeProjectMember, type ProjectMember } from './lib/project-members';
import { exportElementToPdf } from './lib/pdf';
import {
  downloadMonthlyCsv,
  downloadOverviewCsv,
  downloadSprintCsv,
  getMonthlyReport,
  getOverviewReport,
  getSprintReport,
  type MonthlyReport,
  type OverviewReport,
  type SprintReport,
} from './lib/reports';
import { getActiveSprint, listSprints, startSprint } from './lib/sprints';
import { supabase } from './lib/supabase';
import { createTask, listTaskHistory, listTasks, moveTask, reopenTask, updateTask, type Task, type WorkItemHistory as TaskHistory } from './lib/tasks';

const loginSchema = z.object({
  email: z.string().email('Correo invalido'),
  password: z.string().min(6, 'Minimo 6 caracteres'),
});

const registerSchema = z
  .object({
    fullName: z.string().min(3, 'Ingresa tu nombre completo'),
    email: z.string().email('Correo invalido'),
    password: z.string().min(8, 'Minimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirma tu contrasena'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contrasenas no coinciden',
  });

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;
type AuthMode = 'login' | 'register';
type ToastType = 'success' | 'error';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

type ThemeMode = 'light' | 'dark';

type CreateProjectFormValues = {
  name: string;
  logoUrl: string;
  description: string;
  projectType: ProjectType | '';
};

type ProjectWorkspaceTab = 'backlog' | 'board' | 'done' | 'reports';
type BacklogSection = 'nextSprint' | 'general';

type BacklogItem = {
  id: string;
  displayKey: string;
  entityId: string;
  title: string;
  itemType: 'task' | 'bug';
  priority: 'Alta' | 'Medio' | 'Bajo';
  status: 'Pendiente' | 'En progreso' | 'Bloqueado';
  assignee: string;
  assigneeUserId: string | null;
  section: BacklogSection;
  position: number;
};

type CreateWorkItemType = 'task' | 'bug' | null;

type SelectedWorkItem =
  | { type: 'task'; id: string }
  | { type: 'bug'; id: string }
  | null;

type WorkItemHistoryEntry = TaskHistory | BugHistory;

type TaskDraftFormValues = {
  title: string;
  description: string;
  priority: 'Alta' | 'Medio' | 'Bajo';
  assigneeId: string;
  dueDate: string;
};

type BugDraftFormValues = {
  title: string;
  description: string;
  priority: 'Alta' | 'Medio' | 'Bajo';
  environment: string;
  expectedResult: string;
  actualResult: string;
};

const workspaceTabs: Array<{ id: ProjectWorkspaceTab; label: string }> = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'board', label: 'Tablero' },
  { id: 'done', label: 'Completado' },
  { id: 'reports', label: 'Reportes' },
];

const initialBacklogItems: BacklogItem[] = [];

const createMenuOptions: Array<{ id: 'task' | 'bug' | 'testCase'; label: string }> = [
  { id: 'task', label: 'Crear Tarea' },
  { id: 'bug', label: 'Reportar Bug' },
  { id: 'testCase', label: 'Crear Caso de Prueba' },
];

const attachmentsAccept = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  'image/*',
  'video/*',
].join(',');

const projectTypeOptions: ProjectType[] = ['Tienda B2B O B2C', 'App movil', 'App web', 'Otro'];

type StoredUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  avatarUrl?: string | null;
};

export function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

function AppRouter() {
  const [authenticated, setAuthenticated] = useState<boolean>(() => hasSession());
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleAuthSuccess = () => {
    setAuthenticated(true);
  };

  const handleLogout = () => {
    clearSession();
    setAuthenticated(false);
  };

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  };

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={authenticated ? '/app/dashboard' : '/auth/login'} replace />}
      />
      <Route
        path="/auth/*"
        element={
          authenticated ? <Navigate to="/app/dashboard" replace /> : <AuthPage onAuthSuccess={handleAuthSuccess} />
        }
      />
      <Route
        path="/app/*"
        element={
          authenticated ? (
            <AppShell onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
          ) : (
            <Navigate to="/auth/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AuthPage({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [logoFailed, setLogoFailed] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [loginErrors, setLoginErrors] = useState<Partial<Record<keyof LoginValues, string>>>({});
  const [registerErrors, setRegisterErrors] = useState<
    Partial<Record<keyof RegisterValues, string>>
  >({});

  const loginForm = useForm<LoginValues>({
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterValues>({
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  const onLoginSubmit = async (values: LoginValues) => {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setLoginErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    setSubmitting(true);

    try {
      const data = await login(values);

      saveSession(data.accessToken, data.refreshToken, data.user);

      setLoginErrors({});
      showToast(`Sesion iniciada como ${data.user.email}.`, 'success');
      onAuthSuccess();
      navigate('/app/dashboard', { replace: true });
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const onRegisterSubmit = async (values: RegisterValues) => {
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setRegisterErrors({
        fullName: fieldErrors.fullName?.[0],
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      });
      return;
    }

    setSubmitting(true);

    try {
      const data = await register({
        email: values.email,
        password: values.password,
        name: values.fullName,
      });

      saveSession(data.accessToken, data.refreshToken, data.user);

      setRegisterErrors({});
      showToast(`Cuenta creada para ${data.user.email}.`, 'success');
      onAuthSuccess();
      navigate('/app/dashboard', { replace: true });
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <header className="auth-header">
          {!logoFailed ? (
            <img
              className="auth-logo"
              src="/qualio-logo.png"
              alt="Qualio"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <h1>Qualio</h1>
          )}
          <p>Tu Qa aliado !</p>
        </header>

        <div className="auth-toggle" role="tablist" aria-label="Cambiar formulario">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register');
            }}
          >
            Registro
          </button>
        </div>

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={loginForm.handleSubmit(onLoginSubmit)} noValidate>
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" placeholder="tu@correo.com" {...loginForm.register('email')} />
            {loginErrors.email ? <span className="field-error">{loginErrors.email}</span> : null}

            <label htmlFor="password">Contrasena</label>
            <input
              id="password"
              type="password"
              placeholder="******"
              {...loginForm.register('password')}
            />
            {loginErrors.password ? (
              <span className="field-error">{loginErrors.password}</span>
            ) : null}

            <button type="submit" disabled={submitting}>
              {submitting ? 'Validando...' : 'Iniciar sesion'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={registerForm.handleSubmit(onRegisterSubmit)} noValidate>
            <label htmlFor="fullName">Nombre completo</label>
            <input
              id="fullName"
              type="text"
              placeholder="Ana Perez"
              {...registerForm.register('fullName')}
            />
            {registerErrors.fullName ? (
              <span className="field-error">{registerErrors.fullName}</span>
            ) : null}

            <label htmlFor="registerEmail">Correo</label>
            <input
              id="registerEmail"
              type="email"
              placeholder="tu@correo.com"
              {...registerForm.register('email')}
            />
            {registerErrors.email ? (
              <span className="field-error">{registerErrors.email}</span>
            ) : null}

            <label htmlFor="registerPassword">Contrasena</label>
            <input
              id="registerPassword"
              type="password"
              placeholder="Minimo 8 caracteres"
              {...registerForm.register('password')}
            />
            {registerErrors.password ? (
              <span className="field-error">{registerErrors.password}</span>
            ) : null}

            <label htmlFor="confirmPassword">Confirmar contrasena</label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="Repite tu contrasena"
              {...registerForm.register('confirmPassword')}
            />
            {registerErrors.confirmPassword ? (
              <span className="field-error">{registerErrors.confirmPassword}</span>
            ) : null}

            <button type="submit" disabled={submitting}>
              {submitting ? 'Creando...' : 'Crear cuenta'}
            </button>
          </form>
        )}
      </section>

      {toast ? (
        <div className="toast-wrap" role="status" aria-live="polite">
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        </div>
      ) : null}
    </main>
  );
}

function AppShell({
  onLogout,
  theme,
  onToggleTheme,
}: {
  onLogout: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [activeProjectsOpen, setActiveProjectsOpen] = useState(false);
  const [collabOpen, setCollabOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeNotificationIndex, setActiveNotificationIndex] = useState(0);
  const [notificationsLimit, setNotificationsLimit] = useState(20);
  const [notificationFilter, setNotificationFilter] = useState<'ALL' | 'INVITATION' | 'TASK' | 'BUG'>('ALL');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [compactSearchPlaceholder, setCompactSearchPlaceholder] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false,
  );
  const accessToken = localStorage.getItem('qualio_access_token');
  const [storedUser, setStoredUser] = useState<StoredUser | null>(() => getStoredUser());
  const notificationsListRef = useRef<HTMLDivElement | null>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsBootstrappedRef = useRef(false);
  const readAllTriggeredForOpenRef = useRef(false);

  const sessionQuery = useQuery({
    queryKey: ['session-user', accessToken],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('No hay token activo.');
      }

      return getSessionUser(accessToken);
    },
    enabled: Boolean(accessToken),
    retry: false,
  });

  const activeProjectsQuery = useQuery({
    queryKey: ['projects', 'ACTIVE', 'sidebar'],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return listProjects(accessToken, 'ACTIVE');
    },
    enabled: Boolean(accessToken),
    retry: false,
  });

  const notificationsQuery = useQuery({
    queryKey: ['invitation-notifications', accessToken, notificationsLimit],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return listInvitationNotifications(accessToken, { limit: notificationsLimit, offset: 0 });
    },
    enabled: Boolean(accessToken),
    retry: false,
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return acceptInvitation(accessToken, invitationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation-notifications', accessToken] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'ACTIVE', 'sidebar'] });
    },
  });

  const rejectInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return rejectInvitation(accessToken, invitationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation-notifications', accessToken] });
    },
  });

  const readAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return markAllInvitationsRead(accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation-notifications', accessToken] });
    },
  });
  const markAllNotificationsRead = readAllNotificationsMutation.mutate;
  const markingAllNotificationsRead = readAllNotificationsMutation.isPending;

  const notificationsFeed = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);
  const currentUserId = storedUser?.id ?? sessionQuery.data?.user.sub ?? null;
  const unreadNotifications = notificationsFeed.filter((item) => !item.isRead).length;
  const notificationCounts = {
    ALL: notificationsFeed.length,
    INVITATION: notificationsFeed.filter((item) => item.type.startsWith('INVITATION_')).length,
    TASK: notificationsFeed.filter((item) => item.type.startsWith('TASK_')).length,
    BUG: notificationsFeed.filter((item) => item.type.startsWith('BUG_')).length,
  };
  const filteredNotifications = notificationsFeed.filter((item) => {
    if (notificationFilter === 'ALL') {
      return true;
    }

    return item.type.startsWith(`${notificationFilter}_`);
  });
  const groupedNotifications = groupNotificationsByDay(filteredNotifications);

  useEffect(() => {
    if (location.pathname.startsWith('/app/proyectos')) {
      setProjectsOpen(true);

      if (
        location.pathname.startsWith('/app/proyectos/activos') ||
        /^\/app\/proyectos\/[A-Za-z0-9-]+$/.test(location.pathname)
      ) {
        setActiveProjectsOpen(true);
      }
    }

    if (location.pathname.startsWith('/app/colaborar')) {
      setCollabOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!profileModalOpen) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [profileModalOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const onChange = (event: MediaQueryListEvent) => {
      setCompactSearchPlaceholder(event.matches);
    };

    setCompactSearchPlaceholder(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);

    return () => {
      mediaQuery.removeEventListener('change', onChange);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const channel = supabase
      .channel(`notifications-user-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['invitation-notifications', accessToken] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, queryClient, accessToken]);

  useEffect(() => {
    if (!accessToken || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (window.Notification.permission !== 'default') {
      return;
    }

    void window.Notification.requestPermission();
  }, [accessToken]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const feed = notificationsFeed;
    if (feed.length === 0) {
      return;
    }

    if (!notificationsBootstrappedRef.current) {
      feed.forEach((item) => seenNotificationIdsRef.current.add(item.id));
      notificationsBootstrappedRef.current = true;
      return;
    }

    const unseen = feed.filter((item) => !seenNotificationIdsRef.current.has(item.id));
    if (unseen.length === 0) {
      return;
    }

    unseen.forEach((item) => seenNotificationIdsRef.current.add(item.id));

    if (window.Notification.permission !== 'granted' || !document.hidden) {
      return;
    }

    unseen.forEach((item) => {
      const actor = item.actorName?.trim() || item.actorEmail;
      const title = actor ? `${actor} - ${item.title}` : item.title;
      const browserNotification = new window.Notification(title, {
        body: item.message,
        icon: '/logo-menu.png',
        tag: item.id,
      });

      browserNotification.onclick = () => {
        window.focus();
        setNotificationsOpen(true);
        navigate('/app/colaborar/invitaciones');
        browserNotification.close();
      };
    });
  }, [notificationsFeed, navigate]);

  useEffect(() => {
    if (!notificationsOpen || !notificationsListRef.current) {
      return;
    }

    const container = notificationsListRef.current;

    const updateActive = () => {
      const cards = Array.from(container.querySelectorAll<HTMLElement>('.notification-card'));
      if (cards.length === 0) {
        return;
      }

      const center = container.scrollTop + container.clientHeight / 2;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      cards.forEach((card, index) => {
        const cardCenter = card.offsetTop + card.offsetHeight / 2;
        const distance = Math.abs(center - cardCenter);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      setActiveNotificationIndex(bestIndex);
    };

    updateActive();
    container.addEventListener('scroll', updateActive, { passive: true });

    return () => {
      container.removeEventListener('scroll', updateActive);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) {
      readAllTriggeredForOpenRef.current = false;
      return;
    }

    if (unreadNotifications === 0) {
      readAllTriggeredForOpenRef.current = true;
      return;
    }

    if (readAllTriggeredForOpenRef.current || markingAllNotificationsRead) {
      return;
    }

    readAllTriggeredForOpenRef.current = true;
    markAllNotificationsRead(undefined, {
      onError: () => {
        readAllTriggeredForOpenRef.current = false;
      },
    });
  }, [notificationsOpen, unreadNotifications, markingAllNotificationsRead, markAllNotificationsRead]);

  const logout = () => {
    onLogout();
    navigate('/auth/login', { replace: true });
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <div className="app-layout">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/logo-menu.png" alt="Qualio" />
          <button
            type="button"
            className="sidebar-close"
            aria-label="Cerrar menu"
            onClick={() => setMenuOpen(false)}
          >
            ×
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavGroup
            icon={<IconFolder />}
            title="Mis Proyectos"
            expanded={projectsOpen}
            onToggle={() => setProjectsOpen((value) => !value)}
            active={location.pathname.startsWith('/app/proyectos')}
          >
            <NavSubItem to="/app/proyectos/nuevo" label="Nuevo Proyecto" onNavigate={closeMenu} />

            <div className="nav-expandable-row">
              <NavLink
                to="/app/proyectos/activos"
                className={({ isActive }) => `nav-sub-item ${isActive ? 'active' : ''}`}
                onClick={closeMenu}
              >
                Proyectos Activos
              </NavLink>
              <button
                type="button"
                className="nav-sub-toggle"
                aria-label="Desplegar proyectos activos"
                aria-expanded={activeProjectsOpen}
                onClick={() => setActiveProjectsOpen((value) => !value)}
              >
                <IconChevron direction={activeProjectsOpen ? 'up' : 'down'} />
              </button>
            </div>

            {activeProjectsOpen ? (
              <div className="nav-project-list">
                {activeProjectsQuery.isLoading ? <span className="nav-project-state">Cargando...</span> : null}
                {activeProjectsQuery.isError ? <span className="nav-project-state">Sin datos</span> : null}
                {activeProjectsQuery.data?.slice(0, 8).map((project) => (
                  <NavLink
                    key={project.id}
                    to={`/app/proyectos/${project.id}`}
                    className={({ isActive }) => `nav-project-link ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {project.name}
                  </NavLink>
                ))}
                {activeProjectsQuery.data && activeProjectsQuery.data.length === 0 ? (
                  <span className="nav-project-state">Sin proyectos</span>
                ) : null}
              </div>
            ) : null}

            <NavSubItem to="/app/proyectos/archivados" label="Proyectos Archivados" onNavigate={closeMenu} />
          </NavGroup>

          <NavGroup
            icon={<IconUsers />}
            title="Colaborar"
            expanded={collabOpen}
            onToggle={() => setCollabOpen((value) => !value)}
            active={location.pathname.startsWith('/app/colaborar')}
          >
            <NavSubItem to="/app/colaborar/compartidos" label="Compartidos" onNavigate={closeMenu} />
            <NavSubItem to="/app/colaborar/invitaciones" label="Invitaciones" onNavigate={closeMenu} />
          </NavGroup>
        </nav>
      </aside>

      {menuOpen ? <button className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-label="Cerrar menu" /> : null}

      <div className="app-main">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-label="Abrir menu">
            <span />
            <span />
            <span />
          </button>

          <div className="topbar-search">
            <IconSearch />
            <input
              type="text"
              placeholder={compactSearchPlaceholder ? 'Buscar...' : '¿Que estas buscando?'}
              aria-label="Busqueda global"
            />
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label="Notificaciones"
              aria-expanded={notificationsOpen}
              onClick={() => {
                setNotificationsOpen((value) => !value);
                setProfileOpen(false);
              }}
            >
              <IconBell />
              {unreadNotifications > 0 ? <span className="notif-dot" /> : null}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
              onClick={onToggleTheme}
            >
              {theme === 'light' ? <IconMoon /> : <IconSun />}
            </button>
            <div className="profile-menu">
              <button
                type="button"
                className="icon-btn"
                aria-label="Perfil"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((value) => !value)}
              >
                {storedUser?.avatarUrl ? (
                  <img src={storedUser.avatarUrl} alt="Avatar" className="topbar-avatar" />
                ) : (
                  <IconUser />
                )}
              </button>

              {profileOpen ? (
                <section className="profile-popover">
                  <strong>{storedUser?.name ?? 'Administrador'}</strong>
                  <p>{sessionQuery.data?.user.email ?? storedUser?.email ?? 'usuario@qualio.local'}</p>
                  <span className="role-badge">Admin de sus proyectos</span>
                  <button
                    type="button"
                    className="profile-action-btn"
                    onClick={() => {
                      setProfileOpen(false);
                      setProfileModalOpen(true);
                    }}
                  >
                    Editar perfil
                  </button>
                  <button type="button" className="logout-btn" onClick={logout}>
                    Cerrar sesion
                  </button>
                </section>
              ) : null}
            </div>
          </div>
        </header>

        <main className="content-area">
          <Routes>
            <Route path="dashboard" element={<DashboardView currentUser={storedUser} sessionEmail={sessionQuery.data?.user.email} />} />
            <Route path="proyectos/nuevo" element={<ProjectsActiveView createModalRoute />} />
            <Route path="proyectos/activos" element={<ProjectsActiveView />} />
            <Route path="proyectos/archivados" element={<ProjectsArchivedView />} />
            <Route path="proyectos/:projectId" element={<ProjectDetailView />} />
            <Route path="colaborar/compartidos" element={<SectionView title="Compartidos" description="Encuentra elementos compartidos contigo por otros equipos." />} />
            <Route path="colaborar/invitaciones" element={<InvitationsView />} />
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {notificationsOpen ? (
        <button
          className="notifications-overlay"
          aria-label="Cerrar panel de notificaciones"
          onClick={() => setNotificationsOpen(false)}
        />
      ) : null}

      <aside className={`notifications-panel ${notificationsOpen ? 'open' : ''}`} aria-label="Panel de notificaciones">
        <header className="notifications-head">
          <div>
            <h3>Notificaciones</h3>
            <p>Invitaciones y actividad reciente</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => setNotificationsOpen(false)} aria-label="Cerrar panel">
            ×
          </button>
        </header>

        <div className="notifications-filters">
          {(['ALL', 'INVITATION', 'TASK', 'BUG'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`notifications-tab ${notificationFilter === key ? 'active' : ''}`}
              onClick={() => {
                setNotificationFilter(key);
                setActiveNotificationIndex(0);
              }}
            >
              {key === 'ALL' ? 'Todo' : key === 'INVITATION' ? 'Invitaciones' : key === 'TASK' ? 'Tareas' : 'Bugs'}
              <span className="notif-pill-count">{notificationCounts[key]}</span>
            </button>
          ))}
        </div>

        <div className="notifications-list" ref={notificationsListRef}>
          {notificationsQuery.isLoading ? (
            <article className="notification-card reel-focus">
              <strong>Cargando notificaciones...</strong>
              <p>Espera un momento mientras sincronizamos tus invitaciones.</p>
            </article>
          ) : null}

          {groupedNotifications.map((group) => (
            <section key={group.label} className="notification-group">
              <h4>{group.label}</h4>
              {group.items.map((notification, index) => (
                <article
                  key={notification.id}
                  className={`notification-card ${!notification.isRead ? 'unread' : ''} ${
                    Math.abs(index - activeNotificationIndex) >= 2
                      ? 'reel-far'
                      : Math.abs(index - activeNotificationIndex) === 1
                        ? 'reel-near'
                        : 'reel-focus'
                  }`}
                >
                  <div className="notification-card-head">
                    <NotificationActorAvatar notification={notification} />
                    <div className="notification-card-head-meta">
                      <strong>{getNotificationActorName(notification)}</strong>
                      <span className={`notification-kind ${getNotificationKind(notification.type)}`}>
                        {getNotificationLabel(notification.type)}
                      </span>
                    </div>
                  </div>
                  <strong className="notification-title">{notification.title}</strong>
                  <p>{notification.message}</p>
                  <time>{formatDateTime(notification.createdAt)}</time>
                  <div className="notification-actions">
                    {notification.actionType === 'INVITATION_RESPONSE' && notification.actionId ? (
                      <>
                        <button
                          type="button"
                          className="mini-btn icon-action primary"
                          onClick={() => acceptInvitationMutation.mutate(notification.actionId as string)}
                          disabled={acceptInvitationMutation.isPending || rejectInvitationMutation.isPending}
                          aria-label="Aceptar invitacion"
                          title="Aceptar invitacion"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="mini-btn icon-action"
                          onClick={() => rejectInvitationMutation.mutate(notification.actionId as string)}
                          disabled={acceptInvitationMutation.isPending || rejectInvitationMutation.isPending}
                          aria-label="Rechazar invitacion"
                          title="Rechazar invitacion"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className="notification-result">Actualizacion registrada</span>
                    )}
                  </div>
                </article>
              ))}
            </section>
          ))}

          {!notificationsQuery.isLoading && filteredNotifications.length === 0 ? (
            <article className="notification-card reel-focus">
              <strong>Sin notificaciones</strong>
              <p>No hay resultados para el filtro seleccionado.</p>
            </article>
          ) : null}

          {notificationsFeed.length >= notificationsLimit && notificationFilter === 'ALL' ? (
            <button
              type="button"
              className="mini-btn"
              onClick={() => setNotificationsLimit((value) => value + 20)}
              disabled={notificationsQuery.isFetching}
            >
              {notificationsQuery.isFetching ? 'Cargando...' : 'Cargar mas'}
            </button>
          ) : null}
        </div>
      </aside>

      {profileModalOpen ? (
        <ProfileModal
          accessToken={accessToken}
          userName={storedUser?.name ?? 'Administrador'}
          userEmail={sessionQuery.data?.user.email ?? storedUser?.email ?? 'usuario@qualio.local'}
          avatarUrl={storedUser?.avatarUrl ?? null}
          onUserUpdated={setStoredUser}
          onClose={() => setProfileModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ProfileModal({
  accessToken,
  userName,
  userEmail,
  avatarUrl: initialAvatarUrl,
  onUserUpdated,
  onClose,
}: {
  accessToken: string | null;
  userName: string;
  userEmail: string;
  avatarUrl: string | null;
  onUserUpdated: (user: StoredUser) => void;
  onClose: () => void;
}) {
  const [toast, setToast] = useState<ToastState>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarName, setAvatarName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    nextPassword?: string;
    confirmPassword?: string;
  }>({});

  const profileForm = useForm<{ displayName: string }>({
    defaultValues: {
      displayName: userName,
    },
  });

  const passwordForm = useForm<{ currentPassword: string; nextPassword: string; confirmPassword: string }>({
    defaultValues: {
      currentPassword: '',
      nextPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const saveProfile = async (values: { displayName: string }) => {
    if (!accessToken) {
      setToast({ message: 'No hay sesion activa para actualizar el perfil.', type: 'error' });
      return;
    }

    setSavingProfile(true);

    try {
      const response = await updateProfile(accessToken, {
        name: values.displayName,
        email: userEmail,
      });

      const nextUser: StoredUser = {
        ...response.user,
        avatarUrl,
      };

      localStorage.setItem(
        'qualio_user',
        JSON.stringify(nextUser),
      );
      onUserUpdated(nextUser);

      setToast({ message: 'Perfil actualizado correctamente.', type: 'success' });
    } catch (error) {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const updatePassword = async (values: {
    currentPassword: string;
    nextPassword: string;
    confirmPassword: string;
  }) => {
    const errors: {
      currentPassword?: string;
      nextPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!values.currentPassword) {
      errors.currentPassword = 'Ingresa tu contrasena actual.';
    }

    if (values.nextPassword.length < 8) {
      errors.nextPassword = 'La nueva contrasena debe tener al menos 8 caracteres.';
    }

    if (values.confirmPassword !== values.nextPassword) {
      errors.confirmPassword = 'Las contrasenas no coinciden.';
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    if (!accessToken) {
      setToast({ message: 'No hay sesion activa para actualizar la contrasena.', type: 'error' });
      return;
    }

    setPasswordErrors({});
    setSavingPassword(true);

    try {
      await changePassword(accessToken, {
        currentPassword: values.currentPassword,
        newPassword: values.nextPassword,
      });

      passwordForm.reset({ currentPassword: '', nextPassword: '', confirmPassword: '' });
      setToast({ message: 'Contrasena actualizada correctamente.', type: 'success' });
    } catch (error) {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    } finally {
      setSavingPassword(false);
    }
  };

  const onAvatarSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setToast({ message: 'Formato de imagen no valido. Usa JPG, PNG o GIF.', type: 'error' });
      return;
    }

    const maxSizeMb = 5;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setToast({ message: 'La imagen supera el maximo de 5MB.', type: 'error' });
      return;
    }

    const currentUser = getStoredUser();
    if (!currentUser?.id) {
      setToast({ message: 'No se pudo identificar el usuario para subir foto.', type: 'error' });
      return;
    }

    const extensionByMime: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
    };
    const extension = extensionByMime[file.type] ?? 'jpg';
    const filePath = `${currentUser.id}/avatar.${extension}`;

    const { error } = await supabase.storage.from('avatars').upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

    if (error) {
      setToast({ message: 'No fue posible subir la foto. Verifica bucket avatars en Supabase.', type: 'error' });
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const cacheBuster = Date.now();
    const publicUrl = `${data.publicUrl}?v=${cacheBuster}`;
    if (!accessToken) {
      setToast({ message: 'No hay sesion activa para guardar el avatar.', type: 'error' });
      return;
    }

    try {
      const response = await updateAvatar(accessToken, publicUrl);

      setAvatarName(`avatar.${extension}`);
      setAvatarUrl(publicUrl);

      const nextUser: StoredUser = {
        ...response.user,
        avatarUrl: publicUrl,
      };

      localStorage.setItem('qualio_user', JSON.stringify(nextUser));
      onUserUpdated(nextUser);

      setToast({ message: 'Foto de perfil actualizada correctamente.', type: 'success' });
    } catch (apiError) {
      setToast({ message: getApiErrorMessage(apiError), type: 'error' });
    }
  };

  return (
    <div className="profile-modal-root" role="presentation">
      <button className="profile-modal-overlay" aria-label="Cerrar modal" onClick={onClose} />
      <section className="profile-modal" role="dialog" aria-modal="true" aria-label="Perfil de usuario">
        <header className="profile-modal-head">
          <h2>Perfil de Usuario</h2>
          <button type="button" className="profile-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="profile-modal-body">
          <section className="profile-block">
            <h3>
              <IconUser />
              Foto de Perfil
            </h3>

            <div className="avatar-row">
              <div className="avatar-placeholder">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar de usuario" className="avatar-image" />
                ) : (
                  <IconUser />
                )}
              </div>

              <div className="avatar-actions">
                <label className="upload-btn">
                  Subir Foto
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/gif"
                    onChange={onAvatarSelected}
                  />
                </label>
                <p>{avatarName ? `Seleccionado: ${avatarName}` : 'JPG, PNG o GIF. Maximo 5MB.'}</p>
              </div>
            </div>

            <form className="profile-form" onSubmit={profileForm.handleSubmit(saveProfile)} noValidate>
              <label htmlFor="profileName">Nombre visible</label>
              <input
                id="profileName"
                type="text"
                placeholder="Tu nombre"
                {...profileForm.register('displayName', {
                  required: true,
                  minLength: 2,
                })}
              />

              <label>Correo de cuenta (solo lectura)</label>
              <div className="readonly-field">{userEmail}</div>
            </form>
          </section>

          <hr />

          <section className="profile-block">
            <h3>
              <IconLock />
              Cambiar Contrasena
            </h3>

            <form className="password-form" onSubmit={passwordForm.handleSubmit(updatePassword)} noValidate>
              <label htmlFor="currentPassword">Contrasena Actual</label>
              <input
                id="currentPassword"
                type="password"
                placeholder="Ingresa tu contrasena actual"
                {...passwordForm.register('currentPassword')}
              />
              {passwordErrors.currentPassword ? <span className="field-error">{passwordErrors.currentPassword}</span> : null}

              <label htmlFor="nextPassword">Nueva Contrasena</label>
              <input
                id="nextPassword"
                type="password"
                placeholder="Ingresa tu nueva contrasena"
                {...passwordForm.register('nextPassword')}
              />
              {passwordErrors.nextPassword ? <span className="field-error">{passwordErrors.nextPassword}</span> : null}

              <label htmlFor="confirmPasswordProfile">Confirmar Nueva Contrasena</label>
              <input
                id="confirmPasswordProfile"
                type="password"
                placeholder="Confirma tu nueva contrasena"
                {...passwordForm.register('confirmPassword')}
              />
              {passwordErrors.confirmPassword ? <span className="field-error">{passwordErrors.confirmPassword}</span> : null}

              <button type="submit" className="secondary-action-btn" disabled={savingPassword}>
                {savingPassword ? 'Actualizando...' : 'Actualizar Contrasena'}
              </button>
            </form>
          </section>
        </div>

        <footer className="profile-modal-footer">
          <button type="button" className="cancel-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-save-btn"
            onClick={profileForm.handleSubmit(saveProfile)}
            disabled={savingProfile}
          >
            {savingProfile ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </footer>

        {toast ? (
          <div className="toast-wrap modal-toast" role="status" aria-live="polite">
            <div className={`toast toast-${toast.type}`}>{toast.message}</div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DashboardView({
  currentUser,
  sessionEmail,
}: {
  currentUser: StoredUser | null;
  sessionEmail?: string;
}) {
  return (
    <section className="dashboard-view">
      <header className="page-header">
        <h1>Bienvenido a Qualio</h1>
        <p>Tu tablero inicial para controlar calidad, ejecucion y colaboracion.</p>
      </header>

      <article className="owner-banner">
        <strong>Contexto de acceso:</strong>
        <span>
          {currentUser?.name ?? 'Administrador'} ({sessionEmail ?? currentUser?.email ?? 'sin correo'}) - Admin de sus proyectos
        </span>
      </article>

      <div className="summary-grid">
        <article className="summary-card">
          <h2>Proyectos Activos</h2>
          <strong>8</strong>
          <p>2 requieren atencion hoy</p>
        </article>
        <article className="summary-card">
          <h2>Casos Ejecutados</h2>
          <strong>126</strong>
          <p>Semana en curso</p>
        </article>
        <article className="summary-card">
          <h2>Tasa de Exito</h2>
          <strong>92%</strong>
          <p>Ultimas 24 horas</p>
        </article>
        <article className="summary-card">
          <h2>Invitaciones</h2>
          <strong>3</strong>
          <p>Pendientes por revisar</p>
        </article>
      </div>
    </section>
  );
}

function ProjectsActiveView({ createModalRoute = false }: { createModalRoute?: boolean }) {
  const accessToken = localStorage.getItem('qualio_access_token');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<ToastState>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(createModalRoute);
  const pageSize = 6;

  const createForm = useForm<CreateProjectFormValues>({
    defaultValues: {
      name: '',
      logoUrl: '',
      description: '',
      projectType: '',
    },
  });

  const projectsQuery = useQuery({
    queryKey: ['projects', 'ACTIVE'],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return listProjects(accessToken, 'ACTIVE');
    },
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateProjectFormValues) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      if (!values.projectType) {
        throw new Error('Selecciona un tipo de proyecto.');
      }

      return createProject(accessToken, {
        name: values.name,
        logoUrl: values.logoUrl.trim() || undefined,
        description: values.description.trim() || undefined,
        projectType: values.projectType,
      });
    },
    onSuccess: () => {
      createForm.reset({ name: '', logoUrl: '', description: '', projectType: '' });
      setToast({ message: 'Proyecto creado correctamente.', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      closeCreateModal();
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return archiveProject(accessToken, id);
    },
    onSuccess: () => {
      setToast({ message: 'Proyecto archivado correctamente.', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredProjects = (projectsQuery.data ?? []).filter((project) =>
    project.name.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setCreateOpen(createModalRoute || location.pathname.endsWith('/proyectos/nuevo'));
  }, [createModalRoute, location.pathname]);

  const closeCreateModal = () => {
    setCreateOpen(false);

    if (location.pathname.endsWith('/proyectos/nuevo')) {
      navigate('/app/proyectos/activos', { replace: true });
    }
  };

  return (
    <section className="section-view">
      <header className="page-header">
        <h1>Proyectos Activos</h1>
        <p>Aqui veras tus proyectos en ejecucion y su estado general.</p>
      </header>

      {createOpen ? (
        <ProjectCreateModal
          form={createForm}
          creating={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onClose={closeCreateModal}
        />
      ) : null}

      <div className="projects-toolbar">
        <input
          type="search"
          placeholder="Buscar proyecto por nombre"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {projectsQuery.isLoading ? <p className="list-state">Cargando proyectos...</p> : null}
      {projectsQuery.isError ? <p className="list-state error">No fue posible cargar proyectos activos.</p> : null}

      <div className="project-list-grid">
        {paginatedProjects.map((project) => (
          <article key={project.id} className="project-card">
            <div className="project-card-top">
              {project.logoUrl ? <img src={project.logoUrl} alt={project.name} className="project-logo" /> : <div className="project-logo-fallback">Q</div>}
              <div>
                <h3>{project.name}</h3>
                <p>{formatDate(project.createdAt)}</p>
              </div>
            </div>

            <div className="project-card-actions">
              <button type="button" onClick={() => navigate(`/app/proyectos/${project.id}`)}>
                Ver detalle
              </button>
              <button type="button" className="ghost" onClick={() => archiveMutation.mutate(project.id)}>
                Archivar
              </button>
            </div>
          </article>
        ))}
      </div>

      {filteredProjects.length === 0 ? (
        <p className="list-state">No tienes proyectos activos aun.</p>
      ) : null}

      {filteredProjects.length > pageSize ? (
        <div className="pagination-row">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
            Anterior
          </button>
          <span>
            Pagina {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage >= totalPages}
          >
            Siguiente
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="toast-wrap" role="status" aria-live="polite">
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        </div>
      ) : null}
    </section>
  );
}

function ProjectCreateModal({
  form,
  creating,
  onSubmit,
  onClose,
}: {
  form: ReturnType<typeof useForm<CreateProjectFormValues>>;
  creating: boolean;
  onSubmit: (values: CreateProjectFormValues) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="project-modal-root" role="presentation">
      <button className="project-modal-overlay" aria-label="Cerrar modal" onClick={onClose} />
      <section className="project-modal" role="dialog" aria-modal="true" aria-label="Nuevo proyecto">
        <header className="project-modal-head">
          <h2>Nuevo Proyecto</h2>
          <button type="button" className="project-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className="project-modal-form" onSubmit={form.handleSubmit(onSubmit)}>
          <label htmlFor="projectName">Nombre del proyecto</label>
          <input
            id="projectName"
            type="text"
            placeholder="Ej: Qualio QA Core"
            {...form.register('name', { required: true, minLength: 3 })}
          />

          <label htmlFor="projectLogo">Logo URL (opcional)</label>
          <input
            id="projectLogo"
            type="url"
            placeholder="https://..."
            {...form.register('logoUrl')}
          />

          <label htmlFor="projectDescription">Descripcion (opcional)</label>
          <textarea
            id="projectDescription"
            placeholder="Describe brevemente el alcance del proyecto"
            rows={4}
            {...form.register('description')}
          />

          <label htmlFor="projectType">Tipo de proyecto</label>
          <select id="projectType" {...form.register('projectType', { required: true })}>
            <option value="">Selecciona una opcion</option>
            {projectTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <footer className="project-modal-footer">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-save-btn" disabled={creating}>
              {creating ? 'Creando...' : 'Crear Proyecto'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ProjectsArchivedView() {
  const accessToken = localStorage.getItem('qualio_access_token');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const projectsQuery = useQuery({
    queryKey: ['projects', 'ARCHIVED'],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return listProjects(accessToken, 'ARCHIVED');
    },
    retry: false,
  });

  const filteredProjects = (projectsQuery.data ?? []).filter((project) =>
    project.name.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  return (
    <section className="section-view">
      <header className="page-header">
        <h1>Proyectos Archivados</h1>
        <p>Consulta historicos y elementos cerrados de tus proyectos.</p>
      </header>

      <div className="projects-toolbar">
        <input
          type="search"
          placeholder="Buscar proyecto archivado"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {projectsQuery.isLoading ? <p className="list-state">Cargando proyectos archivados...</p> : null}
      {projectsQuery.isError ? <p className="list-state error">No fue posible cargar proyectos archivados.</p> : null}

      <div className="project-list-grid">
        {paginatedProjects.map((project) => (
          <article key={project.id} className="project-card archived">
            <div className="project-card-top">
              {project.logoUrl ? <img src={project.logoUrl} alt={project.name} className="project-logo" /> : <div className="project-logo-fallback">Q</div>}
              <div>
                <h3>{project.name}</h3>
                <p>Archivado - {formatDate(project.updatedAt)}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filteredProjects.length === 0 ? (
        <p className="list-state">No tienes proyectos archivados.</p>
      ) : null}

      {filteredProjects.length > pageSize ? (
        <div className="pagination-row">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
            Anterior
          </button>
          <span>
            Pagina {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage >= totalPages}
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ProjectDetailView() {
  const accessToken = localStorage.getItem('qualio_access_token');
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProjectWorkspaceTab>('backlog');
  const [backlogSearch, setBacklogSearch] = useState('');
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>(initialBacklogItems);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<BacklogSection | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [backlogDropFlashItemId, setBacklogDropFlashItemId] = useState<string | null>(null);
  const [boardDraggedItemId, setBoardDraggedItemId] = useState<string | null>(null);
  const [boardDragOverColumn, setBoardDragOverColumn] = useState<'todo' | 'progress' | null>(null);
  const [boardDropFlashItemId, setBoardDropFlashItemId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createWorkItemType, setCreateWorkItemType] = useState<CreateWorkItemType>(null);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [selectedWorkItem, setSelectedWorkItem] = useState<SelectedWorkItem>(null);
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return getProject(accessToken, projectId);
    },
    retry: false,
  });

  const tasksQuery = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return listTasks(accessToken, projectId);
    },
    enabled: Boolean(accessToken && projectId),
    retry: false,
  });

  const bugsQuery = useQuery({
    queryKey: ['bugs', projectId],
    queryFn: () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return listBugs(accessToken, projectId);
    },
    enabled: Boolean(accessToken && projectId),
    retry: false,
  });

  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return listProjectMembers(accessToken, projectId);
    },
    enabled: Boolean(accessToken && projectId),
    retry: false,
  });

  const activeSprintQuery = useQuery({
    queryKey: ['active-sprint', projectId],
    queryFn: () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return getActiveSprint(accessToken, projectId);
    },
    enabled: Boolean(accessToken && projectId),
    retry: false,
  });

  const pendingInvitationsQuery = useQuery({
    queryKey: ['project-pending-invitations', projectId],
    queryFn: () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return listProjectPendingInvitations(accessToken, projectId);
    },
    enabled: Boolean(accessToken && projectId),
    retry: false,
  });

  const attachmentsQuery = useQuery({
    queryKey: ['attachments', selectedWorkItem?.type, selectedWorkItem?.id],
    queryFn: () => {
      if (!accessToken || !selectedWorkItem) {
        throw new Error('No hay elemento seleccionado.');
      }

      return listAttachments(accessToken, selectedWorkItem.type === 'task' ? 'TASK' : 'BUG', selectedWorkItem.id);
    },
    enabled: Boolean(accessToken && selectedWorkItem),
    retry: false,
  });

  const historyQuery = useQuery({
    queryKey: ['history', selectedWorkItem?.type, selectedWorkItem?.id],
    queryFn: () => {
      if (!accessToken || !selectedWorkItem) {
        throw new Error('No hay elemento seleccionado.');
      }

      if (selectedWorkItem.type === 'task') {
        return listTaskHistory(accessToken, selectedWorkItem.id);
      }

      return listBugHistory(accessToken, selectedWorkItem.id);
    },
    enabled: Boolean(accessToken && selectedWorkItem),
    retry: false,
  });

  const addMemberMutation = useMutation({
    mutationFn: async (payload: { email: string; role: 'ADMIN' | 'MEMBER' }) => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return createInvitation(accessToken, projectId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-pending-invitations', projectId] });
      setToast({ message: 'Invitacion enviada correctamente.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return removeProjectMember(accessToken, projectId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setToast({ message: 'Participante removido correctamente.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return cancelProjectInvitation(accessToken, projectId, invitationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-pending-invitations', projectId] });
      queryClient.invalidateQueries({ queryKey: ['invitation-notifications', accessToken] });
      setToast({ message: 'Invitacion cancelada correctamente.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ values, files }: { values: TaskDraftFormValues; files: File[] }) => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      const useActiveSprint =
        Boolean(activeSprintQuery.data) &&
        ((tasksQuery.data ?? []).some((task) => task.section === 'SPRINT_BOARD') ||
          (bugsQuery.data ?? []).some((bug) => bug.section === 'SPRINT_BOARD'))
          ? window.confirm('Hay un sprint en curso. ¿Deseas agregar este ticket al sprint actual?')
          : false;

      const created = await createTask(accessToken, projectId, {
        title: values.title,
        description: values.description,
        priority: toApiPriority(values.priority),
        section: useActiveSprint ? 'SPRINT_BOARD' : 'GENERAL_BACKLOG',
        sprintId: useActiveSprint ? activeSprintQuery.data?.id : undefined,
        assignedTo: values.assigneeId || undefined,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
      });

      await uploadAttachments('TASK', created.id, files);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setActiveTab('backlog');
      setBacklogSearch('');
      setCreateWorkItemType(null);
      setToast({ message: 'Tarea agregada al backlog.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const createBugMutation = useMutation({
    mutationFn: async ({ values, files }: { values: BugDraftFormValues; files: File[] }) => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      const useActiveSprint =
        Boolean(activeSprintQuery.data) &&
        ((tasksQuery.data ?? []).some((task) => task.section === 'SPRINT_BOARD') ||
          (bugsQuery.data ?? []).some((bug) => bug.section === 'SPRINT_BOARD'))
          ? window.confirm('Hay un sprint en curso. ¿Deseas agregar este ticket al sprint actual?')
          : false;

      const created = await createBug(accessToken, projectId, {
        title: values.title,
        description: values.description,
        priority: toApiPriority(values.priority),
        section: useActiveSprint ? 'SPRINT_BOARD' : 'GENERAL_BACKLOG',
        environment: values.environment.trim() || undefined,
        expectedResult: values.expectedResult.trim() || undefined,
        actualResult: values.actualResult.trim() || undefined,
      });

      await uploadAttachments('BUG', created.id, files);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      setActiveTab('backlog');
      setBacklogSearch('');
      setCreateWorkItemType(null);
      setToast({ message: 'Bug agregado al backlog.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const uploadAttachments = async (entityType: 'TASK' | 'BUG', entityId: string, files: File[]) => {
    if (!accessToken || !projectId || files.length === 0) {
      return;
    }

    await Promise.all(
      files.map(async (file) => {
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
        const path = `projects/${projectId}/${entityType.toLowerCase()}/${entityId}/${Date.now()}-${safeName}`;

        const upload = await supabase.storage.from('project-assets').upload(path, file, {
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        });

        if (upload.error) {
          throw new Error(upload.error.message || 'No fue posible subir un adjunto.');
        }

        await registerAttachment(accessToken, {
          entityType,
          entityId,
          storagePath: path,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
        });
      }),
    );
  };

  const moveTaskMutation = useMutation({
    mutationFn: async (payload: { id: string; section: BacklogSection; targetPosition: number }) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return moveTask(accessToken, payload.id, {
        section: toApiSection(payload.section),
        targetPosition: payload.targetPosition,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const moveBugMutation = useMutation({
    mutationFn: async (payload: { id: string; section: BacklogSection; targetPosition: number }) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return moveBug(accessToken, payload.id, {
        section: toApiSection(payload.section),
        targetPosition: payload.targetPosition,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
    },
  });

  const startSprintMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return startSprint(accessToken, projectId);
    },
    onSuccess: (sprint) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['active-sprint', projectId] });
      setToast({ message: `${sprint.name} iniciado correctamente.`, type: 'success' });
      setActiveTab('board');
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const reopenTaskMutation = useMutation({
    mutationFn: async (payload: { taskId: string; sendToCurrentSprint: boolean }) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      await reopenTask(accessToken, payload.taskId);

      if (payload.sendToCurrentSprint) {
        await updateTask(accessToken, payload.taskId, {
          status: 'TODO',
          section: 'SPRINT_BOARD',
          changeNote: 'Ticket reabierto y agregado al sprint en curso.',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setToast({ message: 'Tarea reabierta y enviada al backlog general.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const reopenBugMutation = useMutation({
    mutationFn: async (payload: { bugId: string; sendToCurrentSprint: boolean }) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      await reopenBug(accessToken, payload.bugId);

      if (payload.sendToCurrentSprint) {
        await updateBug(accessToken, payload.bugId, {
          status: 'OPEN',
          section: 'SPRINT_BOARD',
          changeNote: 'Bug reabierto y agregado al sprint en curso.',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      setToast({ message: 'Bug reabierto y enviado al backlog general.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      title: string;
      description: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      status: 'TODO' | 'IN_PROGRESS' | 'DONE';
      section: 'NEXT_SPRINT' | 'GENERAL_BACKLOG' | 'SPRINT_BOARD';
      assignedTo: string | null;
      dueDate: string | null;
      changeNote: string;
    }) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return updateTask(accessToken, payload.id, {
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        status: payload.status,
        section: payload.section,
        assignedTo: payload.assignedTo,
        dueDate: payload.dueDate,
        changeNote: payload.changeNote,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      if (selectedWorkItem?.type === 'task' && selectedWorkItem.id) {
        queryClient.invalidateQueries({ queryKey: ['history', 'task', selectedWorkItem.id] });
      }
      setToast({ message: 'Tarea actualizada correctamente.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const updateBugMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      title: string;
      description: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
      section: 'NEXT_SPRINT' | 'GENERAL_BACKLOG' | 'SPRINT_BOARD';
      environment: string;
      expectedResult: string;
      actualResult: string;
      changeNote: string;
    }) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return updateBug(accessToken, payload.id, {
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        status: payload.status,
        section: payload.section,
        environment: payload.environment,
        expectedResult: payload.expectedResult,
        actualResult: payload.actualResult,
        changeNote: payload.changeNote,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      if (selectedWorkItem?.type === 'bug' && selectedWorkItem.id) {
        queryClient.invalidateQueries({ queryKey: ['history', 'bug', selectedWorkItem.id] });
      }
      setToast({ message: 'Bug actualizado correctamente.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const boardStatusMutation = useMutation({
    mutationFn: async (payload: { itemType: 'task' | 'bug'; entityId: string; targetColumn: 'todo' | 'progress' }) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      if (payload.itemType === 'task') {
        await updateTask(accessToken, payload.entityId, {
          section: 'SPRINT_BOARD',
          status: payload.targetColumn === 'todo' ? 'TODO' : 'IN_PROGRESS',
          changeNote: 'Cambio de estado desde tablero.',
        });
        return;
      }

      await updateBug(accessToken, payload.entityId, {
        section: 'SPRINT_BOARD',
        status: payload.targetColumn === 'todo' ? 'OPEN' : 'IN_PROGRESS',
        changeNote: 'Cambio de estado desde tablero.',
      });
    },
    onMutate: async (payload) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['tasks', projectId] }),
        queryClient.cancelQueries({ queryKey: ['bugs', projectId] }),
      ]);

      const previousTasks = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      const previousBugs = queryClient.getQueryData<Bug[]>(['bugs', projectId]);

      if (payload.itemType === 'task') {
        queryClient.setQueryData<Task[]>(['tasks', projectId], (current) =>
          (current ?? []).map((task) =>
            task.id === payload.entityId
              ? {
                  ...task,
                  section: 'SPRINT_BOARD',
                  status: payload.targetColumn === 'todo' ? 'TODO' : 'IN_PROGRESS',
                }
              : task,
          ),
        );
      } else {
        queryClient.setQueryData<Bug[]>(['bugs', projectId], (current) =>
          (current ?? []).map((bug) =>
            bug.id === payload.entityId
              ? {
                  ...bug,
                  section: 'SPRINT_BOARD',
                  status: payload.targetColumn === 'todo' ? 'OPEN' : 'IN_PROGRESS',
                }
              : bug,
          ),
        );
      }

      return { previousTasks, previousBugs };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      setToast({ message: 'Estado actualizado desde tablero.', type: 'success' });
    },
    onError: (error, _payload, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks);
      }
      if (context?.previousBugs) {
        queryClient.setQueryData(['bugs', projectId], context.previousBugs);
      }
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
    },
  });

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!createMenuRef.current) {
        return;
      }

      const target = event.target as Node | null;
      if (target && !createMenuRef.current.contains(target)) {
        setCreateMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCreateMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!createWorkItemType && !membersModalOpen && !selectedWorkItem) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [createWorkItemType, membersModalOpen, selectedWorkItem]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const memberNameById = new Map<string, string>();
    (membersQuery.data ?? []).forEach((member) => {
      memberNameById.set(member.userId, member.name?.trim() || member.email);
    });

    const tasks = (tasksQuery.data ?? [])
      .filter((task) => task.section !== 'SPRINT_BOARD')
      .map((task) => fromTaskToBacklogItem(task, memberNameById));
    const bugs = (bugsQuery.data ?? [])
      .filter((bug) => bug.section !== 'SPRINT_BOARD')
      .map((bug) => fromBugToBacklogItem(bug));

    const sorted = [...tasks, ...bugs].sort((a, b) => {
      if (a.section !== b.section) {
        return a.section === 'nextSprint' ? -1 : 1;
      }

      return a.position - b.position;
    });

    setBacklogItems(sorted);
  }, [tasksQuery.data, bugsQuery.data, membersQuery.data]);

  useEffect(() => {
    const attachments = attachmentsQuery.data ?? [];

    if (attachments.length === 0) {
      setAttachmentPreviewUrls({});
      return;
    }

    Promise.all(
      attachments.map(async (attachment) => {
        const signed = await supabase.storage.from('project-assets').createSignedUrl(attachment.storagePath, 3600);
        return {
          id: attachment.id,
          url: signed.error ? '' : signed.data.signedUrl,
        };
      }),
    ).then((signed) => {
      const next: Record<string, string> = {};
      signed.forEach((item) => {
        next[item.id] = item.url;
      });
      setAttachmentPreviewUrls(next);
    });
  }, [attachmentsQuery.data]);

  useEffect(() => {
    if (!backlogDropFlashItemId) {
      return;
    }

    const timer = window.setTimeout(() => setBacklogDropFlashItemId(null), 260);
    return () => window.clearTimeout(timer);
  }, [backlogDropFlashItemId]);

  useEffect(() => {
    if (!boardDropFlashItemId) {
      return;
    }

    const timer = window.setTimeout(() => setBoardDropFlashItemId(null), 260);
    return () => window.clearTimeout(timer);
  }, [boardDropFlashItemId]);

  if (projectQuery.isLoading) {
    return <p className="list-state">Cargando detalle del proyecto...</p>;
  }

  if (projectQuery.isError || !projectQuery.data) {
    return <p className="list-state error">No fue posible cargar el detalle del proyecto.</p>;
  }

  const statusLabel = projectQuery.data.status === 'ACTIVE' ? 'Activo' : 'Archivado';
  const memberById = new Map((membersQuery.data ?? []).map((member) => [member.userId, member]));
  const selectedTask = selectedWorkItem?.type === 'task'
    ? (tasksQuery.data ?? []).find((task) => task.id === selectedWorkItem.id) ?? null
    : null;
  const selectedBug = selectedWorkItem?.type === 'bug'
    ? (bugsQuery.data ?? []).find((bug) => bug.id === selectedWorkItem.id) ?? null
    : null;
  const backlogVisible = backlogItems.filter((item) => {
    const query = backlogSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      item.displayKey.toLowerCase().includes(query) ||
      item.title.toLowerCase().includes(query) ||
      item.assignee.toLowerCase().includes(query)
    );
  });

  const nextSprintItems = backlogVisible.filter((item) => item.section === 'nextSprint');
  const generalBacklogItems = backlogVisible.filter((item) => item.section === 'general');
  const activeSprint = activeSprintQuery.data;
  const boardTasks = (tasksQuery.data ?? []).filter((task) => task.section === 'SPRINT_BOARD' && task.status !== 'DONE');
  const boardBugs = (bugsQuery.data ?? []).filter(
    (bug) => bug.section === 'SPRINT_BOARD' && bug.status !== 'RESOLVED' && bug.status !== 'CLOSED',
  );
  const boardItems = [
    ...boardTasks.map((task) => ({
      id: `task-${task.id}`,
      entityId: task.id,
      itemType: 'task' as const,
      itemKey: task.itemKey ?? `TASK-${task.id.slice(0, 6).toUpperCase()}`,
      title: task.title,
      kind: 'task' as const,
      status: task.status,
      rolloverLabel: task.rolloverFromSprintName ? `RollOver-${task.rolloverFromSprintName}` : null,
      assigneeMember: task.assignedTo ? memberById.get(task.assignedTo) ?? null : null,
      assigneeName: task.assignedTo ? (memberById.get(task.assignedTo)?.name?.trim() || memberById.get(task.assignedTo)?.email || 'Sin asignar') : 'Sin asignar',
    })),
    ...boardBugs.map((bug) => ({
      id: `bug-${bug.id}`,
      entityId: bug.id,
      itemType: 'bug' as const,
      itemKey: bug.itemKey ?? `BUG-${bug.id.slice(0, 6).toUpperCase()}`,
      title: bug.title,
      kind: 'bug' as const,
      status: bug.status,
      rolloverLabel: bug.rolloverFromSprintName ? `RollOver-${bug.rolloverFromSprintName}` : null,
      assigneeMember: null,
      assigneeName: 'Sin asignar',
    })),
  ];
  const boardColumns = [
    {
      key: 'todo',
      title: 'Por hacer',
      items: boardItems.filter((item) => item.status === 'TODO' || item.status === 'OPEN'),
    },
    {
      key: 'progress',
      title: 'En progreso',
      items: boardItems.filter((item) => item.status === 'IN_PROGRESS'),
    },
  ];
  type CompletedWorkItem = {
    id: string;
    key: string;
    title: string;
    kind: 'Tarea' | 'Bug';
    sprintName: string;
    completedAt: string;
    entity: 'task' | 'bug';
  };

  const completedTasks: CompletedWorkItem[] = (tasksQuery.data ?? [])
    .filter((task) => task.status === 'DONE' && task.completedInSprintId)
    .map((task) => ({
      id: task.id,
      key: task.itemKey ?? `TASK-${task.id.slice(0, 6).toUpperCase()}`,
      title: task.title,
      kind: 'Tarea',
      sprintName: task.completedInSprintName ?? 'Sin sprint',
      completedAt: task.updatedAt,
      entity: 'task' as const,
    }));
  const completedBugs: CompletedWorkItem[] = (bugsQuery.data ?? [])
    .filter((bug) => (bug.status === 'RESOLVED' || bug.status === 'CLOSED') && bug.completedInSprintId)
    .map((bug) => ({
      id: bug.id,
      key: bug.itemKey ?? `BUG-${bug.id.slice(0, 6).toUpperCase()}`,
      title: bug.title,
      kind: 'Bug',
      sprintName: bug.completedInSprintName ?? 'Sin sprint',
      completedAt: bug.updatedAt,
      entity: 'bug' as const,
    }));
  const completedBySprint = [...completedTasks, ...completedBugs].reduce<Record<string, CompletedWorkItem[]>>((acc, item) => {
    if (!acc[item.sprintName]) {
      acc[item.sprintName] = [];
    }
    acc[item.sprintName].push(item);
    return acc;
  }, {});

  const handleBoardDrop = (targetColumn: 'todo' | 'progress') => {
    if (!boardDraggedItemId) {
      return;
    }

    const dragged = boardItems.find((item) => item.id === boardDraggedItemId);
    if (!dragged) {
      return;
    }

    const isAlreadyInColumn =
      targetColumn === 'todo'
        ? dragged.status === 'TODO' || dragged.status === 'OPEN'
        : dragged.status === 'IN_PROGRESS';

    if (!isAlreadyInColumn) {
      boardStatusMutation.mutate({
        itemType: dragged.itemType,
        entityId: dragged.entityId,
        targetColumn,
      });
      setBoardDropFlashItemId(dragged.id);
    }

    setBoardDraggedItemId(null);
    setBoardDragOverColumn(null);
  };

  const persistMove = (item: BacklogItem, section: BacklogSection, targetPosition: number) => {
    if (item.itemType === 'task') {
      moveTaskMutation.mutate({ id: item.entityId, section, targetPosition });
      return;
    }

    moveBugMutation.mutate({ id: item.entityId, section, targetPosition });
  };

  const composeBacklog = (nextSprint: BacklogItem[], general: BacklogItem[]): BacklogItem[] => {
    const withNextPositions = nextSprint.map((item, index) => ({ ...item, section: 'nextSprint' as const, position: index }));
    const withGeneralPositions = general.map((item, index) => ({ ...item, section: 'general' as const, position: index }));
    return [...withNextPositions, ...withGeneralPositions];
  };

  const handleDropInto = (targetSection: BacklogSection) => {
    if (!draggedItemId) {
      return;
    }

    const draggedItem = backlogItems.find((item) => item.id === draggedItemId);
    if (!draggedItem) {
      return;
    }

    const nextSprint = backlogItems.filter((item) => item.section === 'nextSprint' && item.id !== draggedItemId);
    const general = backlogItems.filter((item) => item.section === 'general' && item.id !== draggedItemId);

    if (targetSection === 'nextSprint') {
      nextSprint.push({ ...draggedItem, section: 'nextSprint' });
      setBacklogItems(composeBacklog(nextSprint, general));
      persistMove(draggedItem, 'nextSprint', nextSprint.length - 1);
      setBacklogDropFlashItemId(draggedItem.id);
    } else {
      general.push({ ...draggedItem, section: 'general' });
      setBacklogItems(composeBacklog(nextSprint, general));
      persistMove(draggedItem, 'general', general.length - 1);
      setBacklogDropFlashItemId(draggedItem.id);
    }

    setDraggedItemId(null);
    setDragOverSection(null);
    setDragOverItemId(null);
  };

  const handleDropOnItem = (targetSection: BacklogSection, targetItemId: string) => {
    if (!draggedItemId || draggedItemId === targetItemId) {
      return;
    }

    const draggedItem = backlogItems.find((item) => item.id === draggedItemId);
    if (!draggedItem) {
      return;
    }

    const nextSprint = backlogItems.filter((item) => item.section === 'nextSprint' && item.id !== draggedItemId);
    const general = backlogItems.filter((item) => item.section === 'general' && item.id !== draggedItemId);

    const targetCollection = targetSection === 'nextSprint' ? nextSprint : general;
    const insertIndex = targetCollection.findIndex((item) => item.id === targetItemId);
    if (insertIndex === -1) {
      return;
    }

    targetCollection.splice(insertIndex, 0, { ...draggedItem, section: targetSection });
    setBacklogItems(composeBacklog(nextSprint, general));
    persistMove(draggedItem, targetSection, insertIndex);
    setBacklogDropFlashItemId(draggedItem.id);

    setDraggedItemId(null);
    setDragOverSection(null);
    setDragOverItemId(null);
  };

  return (
    <section className="project-workspace-view">
      <header className="project-hero">
        <div className="project-hero-main">
          {projectQuery.data.logoUrl ? (
            <img src={projectQuery.data.logoUrl} alt={projectQuery.data.name} className="project-hero-logo" />
          ) : (
            <div className="project-hero-logo-fallback">Q</div>
          )}

          <div className="project-hero-copy">
            <div className="project-hero-title-row">
              <h1>{projectQuery.data.name}</h1>
              <span className={`project-status-badge ${projectQuery.data.status.toLowerCase()}`}>{statusLabel}</span>
            </div>
            <p className="project-hero-description">
              {projectQuery.data.description?.trim() ||
                'Este proyecto aun no tiene descripcion. Define el alcance funcional para mejorar el seguimiento del equipo.'}
            </p>
            <div className="project-hero-meta">
              <span className="project-meta-pill">Tipo: {projectQuery.data.projectType ?? 'No definido'}</span>
              <span className="project-meta-pill muted">Creado el {formatDate(projectQuery.data.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="project-hero-actions">
          <div className="project-create-menu" ref={createMenuRef}>
            <button
              type="button"
              className="primary-action"
              aria-expanded={createMenuOpen}
              aria-haspopup="menu"
              onClick={() => setCreateMenuOpen((value) => !value)}
            >
              + Crear
            </button>
            {createMenuOpen ? (
              <div className="project-create-dropdown" role="menu" aria-label="Crear elemento">
                {createMenuOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="project-create-item"
                    role="menuitem"
                    onClick={() => {
                      setCreateMenuOpen(false);

                      if (option.id === 'testCase') {
                        setToast({
                          message: 'Formulario de caso de prueba se habilitara en el siguiente paso.',
                          type: 'success',
                        });
                        return;
                      }

                      setCreateWorkItemType(option.id);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" className="ghost-action" onClick={() => setMembersModalOpen(true)}>
            Participantes
          </button>
          <button type="button" className="ghost-action">Configuracion</button>
        </div>
      </header>

      <nav className="project-tabs" role="tablist" aria-label="Secciones del proyecto">
        {workspaceTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`project-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="project-tab-panel">
        {activeTab === 'backlog' ? (
          <>
            <div className="workspace-toolbar">
              <input
                type="search"
                placeholder="Buscar por id, titulo o responsable"
                value={backlogSearch}
                onChange={(event) => setBacklogSearch(event.target.value)}
              />
              <button
                type="button"
                className="primary-action"
                onClick={() => startSprintMutation.mutate()}
                disabled={startSprintMutation.isPending || nextSprintItems.length === 0}
              >
                {startSprintMutation.isPending
                  ? 'Iniciando...'
                  : activeSprint
                    ? `Iniciar Sprint ${activeSprint.sequence + 1}`
                    : 'Iniciar Sprint'}
              </button>
            </div>

            <div className="backlog-split">
              <section
                className={`backlog-section ${dragOverSection === 'nextSprint' ? 'drag-over' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverSection('nextSprint');
                }}
                onDragLeave={() => {
                  setDragOverSection((current) => (current === 'nextSprint' ? null : current));
                  setDragOverItemId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDropInto('nextSprint');
                }}
              >
                <header className="backlog-section-head">
                  <h3>Proximo Sprint</h3>
                  <span>{nextSprintItems.length}</span>
                </header>
                <div className="workspace-list">
                  {nextSprintItems.map((item) => (
                    <article
                      key={item.id}
                      className={`workspace-list-item ${draggedItemId === item.id ? 'dragging' : ''} ${dragOverItemId === item.id ? 'drag-over' : ''} ${backlogDropFlashItemId === item.id ? 'drop-flash' : ''}`}
                      draggable
                      onClick={() => setSelectedWorkItem({ type: item.itemType, id: item.entityId })}
                      onDragStart={() => setDraggedItemId(item.id)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverSection('nextSprint');
                        setDragOverItemId(item.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDropOnItem('nextSprint', item.id);
                      }}
                      onDragEnd={() => {
                        setDraggedItemId(null);
                        setDragOverSection(null);
                        setDragOverItemId(null);
                      }}
                    >
                      <div>
                        <div className="workspace-item-head">
                          <img
                            src={item.itemType === 'task' ? '/tarea.png' : '/bug.png'}
                            alt={item.itemType === 'task' ? 'Tarea' : 'Bug'}
                            className="workspace-item-icon"
                          />
                          <strong>{item.displayKey}</strong>
                        </div>
                        <p>{item.title}</p>
                      </div>
                      <div className="workspace-list-meta">
                        <span
                          className={`priority-pill ${
                            item.priority === 'Alta'
                              ? 'priority-high'
                              : item.priority === 'Medio'
                                ? 'priority-medium'
                                : 'priority-low'
                          }`}
                        >
                          {item.priority}
                        </span>
                        <span>{item.status}</span>
                        <AssigneeAvatar member={item.assigneeUserId ? memberById.get(item.assigneeUserId) ?? null : null} fallbackLabel={item.assignee} />
                      </div>
                    </article>
                  ))}
                  {nextSprintItems.length === 0 ? <BacklogEmptyState /> : null}
                </div>
              </section>

              <section
                className={`backlog-section ${dragOverSection === 'general' ? 'drag-over' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverSection('general');
                }}
                onDragLeave={() => {
                  setDragOverSection((current) => (current === 'general' ? null : current));
                  setDragOverItemId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDropInto('general');
                }}
              >
                <header className="backlog-section-head">
                  <h3>Backlog General</h3>
                  <span>{generalBacklogItems.length}</span>
                </header>
                <div className="workspace-list">
                  {generalBacklogItems.map((item) => (
                    <article
                      key={item.id}
                      className={`workspace-list-item ${draggedItemId === item.id ? 'dragging' : ''} ${dragOverItemId === item.id ? 'drag-over' : ''} ${backlogDropFlashItemId === item.id ? 'drop-flash' : ''}`}
                      draggable
                      onClick={() => setSelectedWorkItem({ type: item.itemType, id: item.entityId })}
                      onDragStart={() => setDraggedItemId(item.id)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverSection('general');
                        setDragOverItemId(item.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDropOnItem('general', item.id);
                      }}
                      onDragEnd={() => {
                        setDraggedItemId(null);
                        setDragOverSection(null);
                        setDragOverItemId(null);
                      }}
                    >
                      <div>
                        <div className="workspace-item-head">
                          <img
                            src={item.itemType === 'task' ? '/tarea.png' : '/bug.png'}
                            alt={item.itemType === 'task' ? 'Tarea' : 'Bug'}
                            className="workspace-item-icon"
                          />
                          <strong>{item.displayKey}</strong>
                        </div>
                        <p>{item.title}</p>
                      </div>
                      <div className="workspace-list-meta">
                        <span
                          className={`priority-pill ${
                            item.priority === 'Alta'
                              ? 'priority-high'
                              : item.priority === 'Medio'
                                ? 'priority-medium'
                                : 'priority-low'
                          }`}
                        >
                          {item.priority}
                        </span>
                        <span>{item.status}</span>
                        <AssigneeAvatar member={item.assigneeUserId ? memberById.get(item.assigneeUserId) ?? null : null} fallbackLabel={item.assignee} />
                      </div>
                    </article>
                  ))}
                  {generalBacklogItems.length === 0 ? <BacklogEmptyState /> : null}
                </div>
              </section>
            </div>
          </>
        ) : null}

        {activeTab === 'board' ? (
          <>
            <p className="list-state">
              {activeSprint ? `Sprint activo: ${activeSprint.name}` : 'No hay sprint activo. Inicia un sprint desde Backlog.'}
            </p>
            <div className="workspace-board">
              {boardColumns.map((column) => (
                <section
                  key={column.key}
                  className={`board-column ${boardDragOverColumn === column.key ? 'drag-over' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setBoardDragOverColumn(column.key as 'todo' | 'progress');
                  }}
                  onDragLeave={() => {
                    setBoardDragOverColumn((current) => (current === column.key ? null : current));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleBoardDrop(column.key as 'todo' | 'progress');
                  }}
                >
                  <h3>{column.title}</h3>
                  <div className="board-cards">
                    {column.items.map((item) => (
                      <article
                        key={item.id}
                        className={`board-card clickable ${boardDraggedItemId === item.id ? 'dragging' : ''} ${boardDropFlashItemId === item.id ? 'drop-flash' : ''}`}
                        onClick={() => setSelectedWorkItem({ type: item.itemType, id: item.entityId })}
                        draggable
                        onDragStart={() => setBoardDraggedItemId(item.id)}
                        onDragEnd={() => {
                          setBoardDraggedItemId(null);
                          setBoardDragOverColumn(null);
                        }}
                      >
                        <div className="workspace-item-head">
                          <img
                            src={item.itemType === 'task' ? '/tarea.png' : '/bug.png'}
                            alt={item.itemType === 'task' ? 'Tarea' : 'Bug'}
                            className="workspace-item-icon"
                          />
                          <strong>{item.itemKey}</strong>
                        </div>
                        <p>{item.title}</p>
                        <div className="board-card-assignee">
                          <AssigneeAvatar member={item.assigneeMember} fallbackLabel={item.assigneeName} />
                          <span>{item.assigneeName}</span>
                        </div>
                        {item.rolloverLabel ? <span className="rollover-pill">{item.rolloverLabel}</span> : null}
                      </article>
                    ))}
                    {column.items.length === 0 ? <p className="backlog-empty">Sin tickets.</p> : null}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : null}

        {activeTab === 'done' ? (
          <>
            {Object.keys(completedBySprint).length === 0 ? <p className="list-state">No hay tickets completados.</p> : null}
            {Object.entries(completedBySprint).map(([sprintName, items]) => (
              <section key={sprintName} className="backlog-section">
                <header className="backlog-section-head">
                  <h3>{sprintName}</h3>
                  <span>{items.length}</span>
                </header>
                <div className="board-cards">
                  {items.map((item) => (
                    <article key={`${item.entity}-${item.id}`} className="board-card done-card">
                      <div className="workspace-item-head">
                        <img
                          src={item.entity === 'task' ? '/tarea.png' : '/bug.png'}
                          alt={item.entity === 'task' ? 'Tarea' : 'Bug'}
                          className="workspace-item-icon"
                        />
                        <strong>{item.key}</strong>
                      </div>
                      <p>{item.title}</p>
                      <small className="done-card-meta">{item.kind} finalizada · {formatDateTime(item.completedAt)}</small>
                      <div className="done-card-actions">
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => {
                            const sendToCurrentSprint =
                              Boolean(activeSprint) &&
                              window.confirm('¿Deseas agregar este ticket reabierto al sprint en curso?');

                            if (item.entity === 'task') {
                              reopenTaskMutation.mutate({ taskId: item.id, sendToCurrentSprint });
                              return;
                            }

                            reopenBugMutation.mutate({ bugId: item.id, sendToCurrentSprint });
                          }}
                          disabled={reopenTaskMutation.isPending || reopenBugMutation.isPending}
                        >
                          Reabrir
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </>
        ) : null}

        {activeTab === 'reports' ? (
          <ProjectReportsPanel accessToken={accessToken} projectId={projectId ?? ''} />
        ) : null}
      </section>

      {createWorkItemType === 'task' ? (
        <TaskDraftModal
          members={membersQuery.data ?? []}
          onClose={() => setCreateWorkItemType(null)}
          onSubmit={(values: TaskDraftFormValues, files: File[]) =>
            createTaskMutation.mutateAsync({ values, files }).then(() => undefined)
          }
        />
      ) : null}

      {createWorkItemType === 'bug' ? (
        <BugDraftModal
          onClose={() => setCreateWorkItemType(null)}
          onSubmit={(values: BugDraftFormValues, files: File[]) =>
            createBugMutation.mutateAsync({ values, files }).then(() => undefined)
          }
        />
      ) : null}

      {membersModalOpen ? (
        <ProjectMembersModal
          members={membersQuery.data ?? []}
          pendingInvitations={pendingInvitationsQuery.data ?? []}
          loadingPendingInvitations={pendingInvitationsQuery.isLoading}
          adding={addMemberMutation.isPending}
          removingUserId={removeMemberMutation.variables ?? null}
          cancellingInvitationId={cancelInvitationMutation.variables ?? null}
          onClose={() => setMembersModalOpen(false)}
          onAdd={(email: string, role: 'ADMIN' | 'MEMBER') =>
            addMemberMutation.mutateAsync({ email, role }).then(() => undefined)
          }
          onRemove={(userId: string) => removeMemberMutation.mutateAsync(userId).then(() => undefined)}
          onCancelInvitation={(invitationId: string) => cancelInvitationMutation.mutateAsync(invitationId).then(() => undefined)}
        />
      ) : null}

      {selectedWorkItem && (selectedTask || selectedBug) ? (
        <WorkItemDetailModal
          item={
            selectedTask
              ? { type: 'task', data: selectedTask }
              : { type: 'bug', data: selectedBug as Bug }
          }
          members={membersQuery.data ?? []}
          attachments={attachmentsQuery.data ?? []}
          attachmentPreviewUrls={attachmentPreviewUrls}
          loadingAttachments={attachmentsQuery.isLoading}
          history={historyQuery.data ?? []}
          loadingHistory={historyQuery.isLoading}
          saving={updateTaskMutation.isPending || updateBugMutation.isPending}
          onSave={(payload) => {
            if (payload.type === 'task') {
              return updateTaskMutation.mutateAsync(payload).then(() => undefined);
            }

            return updateBugMutation.mutateAsync(payload).then(() => undefined);
          }}
          onClose={() => setSelectedWorkItem(null)}
        />
      ) : null}

      {toast ? (
        <div className="toast-wrap" role="status" aria-live="polite">
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        </div>
      ) : null}

    </section>
  );
}

function ProjectMembersModal({
  members,
  pendingInvitations,
  loadingPendingInvitations,
  adding,
  removingUserId,
  cancellingInvitationId,
  onClose,
  onAdd,
  onRemove,
  onCancelInvitation,
}: {
  members: ProjectMember[];
  pendingInvitations: ProjectPendingInvitation[];
  loadingPendingInvitations: boolean;
  adding: boolean;
  removingUserId: string | null;
  cancellingInvitationId: string | null;
  onClose: () => void;
  onAdd: (email: string, role: 'ADMIN' | 'MEMBER') => Promise<void> | void;
  onRemove: (userId: string) => Promise<void> | void;
  onCancelInvitation: (invitationId: string) => Promise<void> | void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [activeSection, setActiveSection] = useState<'members' | 'pending'>('members');

  return (
    <div className="draft-modal-root" role="presentation">
      <button className="draft-modal-overlay" aria-label="Cerrar modal" onClick={onClose} />
      <section className="draft-modal" role="dialog" aria-modal="true" aria-label="Gestionar participantes">
        <header className="draft-modal-head">
          <h2>Participantes e Invitaciones</h2>
          <button type="button" className="project-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form
          className="draft-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const normalized = email.trim().toLowerCase();
            if (!normalized) {
              return;
            }

            try {
              await onAdd(normalized, role);
              setEmail('');
              setRole('MEMBER');
            } catch {
              return;
            }
          }}
        >
          <label htmlFor="memberEmail">Correo a invitar</label>
          <input
            id="memberEmail"
            type="email"
            placeholder="usuario@correo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="memberRole">Rol</label>
          <select id="memberRole" value={role} onChange={(event) => setRole(event.target.value as 'ADMIN' | 'MEMBER')}>
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>

          <button type="submit" className="primary-save-btn" disabled={adding}>
            {adding ? 'Enviando...' : 'Enviar invitacion'}
          </button>
        </form>

        <div className="members-tabs" role="tablist" aria-label="Secciones de participantes">
          <button
            type="button"
            className={`members-tab ${activeSection === 'members' ? 'active' : ''}`}
            onClick={() => setActiveSection('members')}
          >
            Participantes ({members.length})
          </button>
          <button
            type="button"
            className={`members-tab ${activeSection === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveSection('pending')}
          >
            Invitaciones pendientes ({pendingInvitations.length})
          </button>
        </div>

        {activeSection === 'members' ? (
          <div className="members-list-wrap">
            {(members ?? []).map((member) => (
              <article key={`${member.projectId}-${member.userId}`} className="members-list-item">
                <div className="members-list-person">
                  <ProjectMemberAvatar member={member} />
                  <div>
                    <strong>{member.name?.trim() || member.email}</strong>
                    <p>{member.email}</p>
                  </div>
                </div>
                <div className="members-list-actions">
                  <span className="project-meta-pill">{member.role}</span>
                  {member.role !== 'OWNER' ? (
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => onRemove(member.userId)}
                      disabled={removingUserId === member.userId}
                    >
                      {removingUserId === member.userId ? 'Removiendo...' : 'Remover'}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="members-list-wrap">
            {loadingPendingInvitations ? <p className="list-state">Cargando invitaciones pendientes...</p> : null}
            {!loadingPendingInvitations && pendingInvitations.length === 0 ? (
              <p className="list-state">No hay invitaciones pendientes para este proyecto.</p>
            ) : null}
            {pendingInvitations.map((invitation) => (
              <article key={invitation.id} className="members-list-item">
                <div>
                  <strong>{invitation.invitedEmail}</strong>
                  <p>
                    Rol: {invitation.role} - Estado: {invitation.status} - {formatDateTime(invitation.createdAt)}
                  </p>
                </div>
                <div className="members-list-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => onCancelInvitation(invitation.id)}
                    disabled={cancellingInvitationId === invitation.id}
                  >
                    {cancellingInvitationId === invitation.id ? 'Cancelando...' : 'Cancelar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BacklogEmptyState() {
  return (
    <div className="backlog-empty-state">
      <img src="/no_tacks_clear.png" alt="Backlog vacio" className="backlog-empty-image light" />
      <img src="/no_tacks_dark.png" alt="Backlog vacio" className="backlog-empty-image dark" />
      <p className="backlog-empty">Aun no hay elementos en esta seccion.</p>
    </div>
  );
}

function AssigneeAvatar({ member, fallbackLabel }: { member: ProjectMember | null; fallbackLabel: string }) {
  const displayName = member?.name?.trim() || member?.email || fallbackLabel;
  const initials = getInitials(displayName);

  if (!member) {
    return (
      <div className="assignee-avatar empty" title="Sin asignar" aria-label="Sin asignar">
        <IconUser />
      </div>
    );
  }

  if (member.avatarUrl) {
    return <img src={member.avatarUrl} alt={displayName} className="assignee-avatar image" title={displayName} />;
  }

  return (
    <div className="assignee-avatar initials" title={displayName} aria-label={displayName}>
      {initials}
    </div>
  );
}

function ProjectMemberAvatar({ member }: { member: ProjectMember }) {
  const displayName = member.name?.trim() || member.email;

  if (member.avatarUrl) {
    return <img src={member.avatarUrl} alt={displayName} className="members-avatar image" title={displayName} />;
  }

  const initials = getInitials(displayName);

  return (
    <div className="members-avatar initials" title={displayName} aria-label={displayName}>
      {initials}
    </div>
  );
}

function NotificationActorAvatar({ notification }: { notification: AppNotification }) {
  const displayName = getNotificationActorName(notification);
  const initials = getInitials(displayName);

  if (notification.actorAvatarUrl) {
    return <img src={notification.actorAvatarUrl} alt={displayName} className="notification-actor-avatar image" />;
  }

  if (notification.actorUserId || notification.actorEmail || notification.actorName) {
    return <span className="notification-actor-avatar initials">{initials}</span>;
  }

  return (
    <span className="notification-actor-avatar empty" aria-label="Usuario no identificado">
      <IconUser />
    </span>
  );
}

function WorkItemDetailModal({
  item,
  members,
  attachments,
  attachmentPreviewUrls,
  loadingAttachments,
  history,
  loadingHistory,
  saving,
  onSave,
  onClose,
}: {
  item: { type: 'task'; data: Task } | { type: 'bug'; data: Bug };
  members: ProjectMember[];
  attachments: WorkItemAttachment[];
  attachmentPreviewUrls: Record<string, string>;
  loadingAttachments: boolean;
  history: WorkItemHistoryEntry[];
  loadingHistory: boolean;
  saving: boolean;
  onSave: (
    payload:
      | {
          type: 'task';
          id: string;
          title: string;
          description: string;
          priority: 'HIGH' | 'MEDIUM' | 'LOW';
          status: 'TODO' | 'IN_PROGRESS' | 'DONE';
          section: 'NEXT_SPRINT' | 'GENERAL_BACKLOG' | 'SPRINT_BOARD';
          assignedTo: string | null;
          dueDate: string | null;
          changeNote: string;
        }
      | {
          type: 'bug';
          id: string;
          title: string;
          description: string;
          priority: 'HIGH' | 'MEDIUM' | 'LOW';
          status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
          section: 'NEXT_SPRINT' | 'GENERAL_BACKLOG' | 'SPRINT_BOARD';
          environment: string;
          expectedResult: string;
          actualResult: string;
          changeNote: string;
        },
  ) => Promise<void> | void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(item.data.title);
  const [description, setDescription] = useState(item.data.description ?? '');
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(item.data.priority);
  const [status, setStatus] = useState(item.data.status);
  const [section, setSection] = useState<'NEXT_SPRINT' | 'GENERAL_BACKLOG' | 'SPRINT_BOARD'>(item.data.section);

  const [assignedTo, setAssignedTo] = useState<string>(item.type === 'task' ? (item.data.assignedTo ?? '') : '');
  const [dueDate, setDueDate] = useState<string>(
    item.type === 'task' && item.data.dueDate ? new Date(item.data.dueDate).toISOString().slice(0, 10) : '',
  );

  const [environment, setEnvironment] = useState(item.type === 'bug' ? (item.data.environment ?? '') : '');
  const [expectedResult, setExpectedResult] = useState(item.type === 'bug' ? (item.data.expectedResult ?? '') : '');
  const [actualResult, setActualResult] = useState(item.type === 'bug' ? (item.data.actualResult ?? '') : '');
  const [changeNote, setChangeNote] = useState('');

  useEffect(() => {
    setTitle(item.data.title);
    setDescription(item.data.description ?? '');
    setPriority(item.data.priority);
    setStatus(item.data.status);
    setSection(item.data.section);

    if (item.type === 'task') {
      setAssignedTo(item.data.assignedTo ?? '');
      setDueDate(item.data.dueDate ? new Date(item.data.dueDate).toISOString().slice(0, 10) : '');
    }

    if (item.type === 'bug') {
      setEnvironment(item.data.environment ?? '');
      setExpectedResult(item.data.expectedResult ?? '');
      setActualResult(item.data.actualResult ?? '');
    }

    setChangeNote('');
  }, [item]);

  const hasUnsavedChanges =
    item.type === 'task'
      ? title.trim() !== item.data.title.trim() ||
        description.trim() !== (item.data.description ?? '').trim() ||
        priority !== item.data.priority ||
        status !== item.data.status ||
        section !== item.data.section ||
        assignedTo !== (item.data.assignedTo ?? '') ||
        dueDate !== (item.data.dueDate ? new Date(item.data.dueDate).toISOString().slice(0, 10) : '') ||
        changeNote.trim().length > 0
      : title.trim() !== item.data.title.trim() ||
        description.trim() !== (item.data.description ?? '').trim() ||
        priority !== item.data.priority ||
        status !== item.data.status ||
        section !== item.data.section ||
        environment.trim() !== (item.data.environment ?? '').trim() ||
        expectedResult.trim() !== (item.data.expectedResult ?? '').trim() ||
        actualResult.trim() !== (item.data.actualResult ?? '').trim() ||
        changeNote.trim().length > 0;

  const handleCloseRequest = () => {
    if (!hasUnsavedChanges || saving) {
      onClose();
      return;
    }

    const confirmed = window.confirm('Tienes cambios sin guardar. Si cierras, perderas los cambios.');
    if (confirmed) {
      onClose();
    }
  };

  const handleSave = () => {
    if (item.type === 'task') {
      onSave({
        type: 'task',
        id: item.data.id,
        title: title.trim(),
        description: description.trim(),
        priority,
        status: status as 'TODO' | 'IN_PROGRESS' | 'DONE',
        section,
        assignedTo: assignedTo || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        changeNote: changeNote.trim(),
      });
      return;
    }

    onSave({
      type: 'bug',
      id: item.data.id,
      title: title.trim(),
      description: description.trim(),
      priority,
      status: status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
      section,
      environment: environment.trim(),
      expectedResult: expectedResult.trim(),
      actualResult: actualResult.trim(),
      changeNote: changeNote.trim(),
    });
  };

  const priorityLabel = priority === 'HIGH' ? 'Alta' : priority === 'MEDIUM' ? 'Media' : 'Baja';
  const priorityBadgeClass =
    priority === 'HIGH' ? 'workitem-badge priority-high' : priority === 'MEDIUM' ? 'workitem-badge priority-medium' : 'workitem-badge priority-low';
  const statusLabel =
    item.type === 'task'
      ? status === 'TODO'
        ? 'Pendiente'
        : status === 'IN_PROGRESS'
          ? 'En progreso'
          : 'Completado'
      : status === 'OPEN'
        ? 'Abierto'
        : status === 'IN_PROGRESS'
          ? 'En progreso'
          : status === 'RESOLVED'
            ? 'Resuelto'
            : 'Cerrado';
  const selectedAssignee = members.find((member) => member.userId === assignedTo);
  const assigneeLabel = selectedAssignee ? selectedAssignee.name?.trim() || selectedAssignee.email : 'Sin asignar';

  return (
    <div className="draft-modal-root" role="presentation">
      <button className="draft-modal-overlay" aria-label="Cerrar modal" onClick={handleCloseRequest} />
      <section className="draft-modal workitem-modal" role="dialog" aria-modal="true" aria-label="Detalle del elemento">
        <header className="draft-modal-head">
          <h2>{item.type === 'task' ? 'Detalle de Tarea' : 'Detalle de Bug'}</h2>
          <button type="button" className="project-modal-close" onClick={handleCloseRequest} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="workitem-layout">
          <div className="workitem-main">
            <div className="workitem-head-row">
              <div className="workspace-item-head">
                <img
                  src={item.type === 'task' ? '/tarea.png' : '/bug.png'}
                  alt={item.type === 'task' ? 'Tarea' : 'Bug'}
                  className="workspace-item-icon"
                />
                <strong>{item.data.itemKey ?? item.data.id}</strong>
              </div>
              <span className="project-meta-pill">{item.type === 'task' ? 'TAREA' : 'BUG'}</span>
            </div>

            <section className="workitem-section">
              <label htmlFor="workitemTitle">Titulo</label>
              <input id="workitemTitle" type="text" value={title} onChange={(event) => setTitle(event.target.value)} />

              <label htmlFor="workitemDescription">Descripcion</label>
              <textarea
                id="workitemDescription"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </section>

            {item.type === 'bug' ? (
              <section className="workitem-section workitem-extra">
                <h4>Detalle tecnico del bug</h4>
                <label htmlFor="workitemEnv">Entorno</label>
                <input id="workitemEnv" type="text" value={environment} onChange={(event) => setEnvironment(event.target.value)} />

                <label htmlFor="workitemExpected">Resultado esperado</label>
                <textarea id="workitemExpected" rows={2} value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)} />

                <label htmlFor="workitemActual">Resultado actual</label>
                <textarea id="workitemActual" rows={2} value={actualResult} onChange={(event) => setActualResult(event.target.value)} />
              </section>
            ) : null}

            <section className="workitem-attachments workitem-section">
              <h4>Adjuntos</h4>
              {loadingAttachments ? <p className="backlog-empty">Cargando adjuntos...</p> : null}
              {!loadingAttachments && attachments.length === 0 ? <p className="backlog-empty">Sin archivos adjuntos.</p> : null}

              <div className="workitem-attachments-grid">
                {attachments.map((attachment) => {
                  const previewUrl = attachmentPreviewUrls[attachment.id];

                  if (attachment.mimeType.startsWith('image/') && previewUrl) {
                    return (
                      <article key={attachment.id} className="workitem-asset-card media">
                        <img src={previewUrl} alt={attachment.fileName} className="workitem-preview-image" />
                        <a href={previewUrl} target="_blank" rel="noreferrer">{attachment.fileName}</a>
                      </article>
                    );
                  }

                  if (attachment.mimeType.startsWith('video/') && previewUrl) {
                    return (
                      <article key={attachment.id} className="workitem-asset-card media">
                        <video controls className="workitem-preview-video" src={previewUrl} />
                        <a href={previewUrl} target="_blank" rel="noreferrer">{attachment.fileName}</a>
                      </article>
                    );
                  }

                  return (
                    <article key={attachment.id} className="workitem-asset-card">
                      <p>{attachment.fileName}</p>
                      {previewUrl ? (
                        <a href={previewUrl} target="_blank" rel="noreferrer">Abrir archivo</a>
                      ) : (
                        <span>No disponible</span>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="workitem-history workitem-section">
              <h4>Timeline de cambios</h4>
              {loadingHistory ? <p className="backlog-empty">Cargando historial...</p> : null}
              {!loadingHistory && history.length === 0 ? <p className="backlog-empty">Sin cambios registrados.</p> : null}

              <div className="workitem-timeline">
                {history.map((entry) => (
                  <article key={entry.id} className="timeline-item">
                    <span className="timeline-dot" />
                    <div className="timeline-card">
                      <header>
                        <strong>{entry.fieldName}</strong>
                        <time>{formatDateTime(entry.createdAt)}</time>
                      </header>
                      <p>
                        <span>{entry.oldValue ?? '(vacio)'}</span>
                        <span className="timeline-arrow">→</span>
                        <span>{entry.newValue ?? '(vacio)'}</span>
                      </p>
                      <small>{entry.changedByName?.trim() || entry.changedByEmail}</small>
                      {entry.changeNote ? <em>{entry.changeNote}</em> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="workitem-side">
            <section className="workitem-side-card">
              <h4>Detalles</h4>

              <div className="workitem-field-head">
                <label htmlFor="workitemPriority">Prioridad</label>
                <span className={priorityBadgeClass}>{priorityLabel}</span>
              </div>
              <select id="workitemPriority" value={priority} onChange={(event) => setPriority(event.target.value as 'HIGH' | 'MEDIUM' | 'LOW')}>
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Media</option>
                <option value="LOW">Baja</option>
              </select>

              <div className="workitem-field-head">
                <label htmlFor="workitemStatus">Estado</label>
                <span className="workitem-badge neutral">{statusLabel}</span>
              </div>
              {item.type === 'task' ? (
                <select id="workitemStatus" value={status} onChange={(event) => setStatus(event.target.value as 'TODO' | 'IN_PROGRESS' | 'DONE')}>
                  <option value="TODO">Pendiente</option>
                  <option value="IN_PROGRESS">En progreso</option>
                  <option value="DONE">Completado</option>
                </select>
              ) : (
                <select id="workitemStatus" value={status} onChange={(event) => setStatus(event.target.value as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED')}>
                  <option value="OPEN">Abierto</option>
                  <option value="IN_PROGRESS">En progreso</option>
                  <option value="RESOLVED">Resuelto</option>
                  <option value="CLOSED">Cerrado</option>
                </select>
              )}

            </section>

            <section className="workitem-side-card">
              <h4>Fechas</h4>
              <div className="workitem-side-row">
                <span>Fecha creacion</span>
                <strong>{formatDate(item.data.createdAt)}</strong>
              </div>

              {item.type === 'task' ? (
                <>
                  <label htmlFor="workitemDueDate">Fecha objetivo</label>
                  <input id="workitemDueDate" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </>
              ) : (
                <div className="workitem-side-row muted">
                  <span>Fecha objetivo</span>
                  <strong>No aplica</strong>
                </div>
              )}
            </section>

            <section className="workitem-side-card">
              <h4>Responsable</h4>
              {item.type === 'task' ? (
                <>
                  <div className="workitem-side-row">
                    <span>Actual</span>
                    <strong>{assigneeLabel}</strong>
                  </div>
                  <select id="workitemAssignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                    <option value="">Sin asignar</option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name?.trim() || member.email}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="workitem-side-note">Asignacion para bugs pendiente de habilitar.</p>
              )}
            </section>

            <section className="workitem-side-card">
              <label htmlFor="workitemChangeNote">Nota de cambio (opcional)</label>
              <textarea
                id="workitemChangeNote"
                rows={2}
                value={changeNote}
                onChange={(event) => setChangeNote(event.target.value)}
                placeholder="Ej: Ajuste por validacion QA"
              />
            </section>

            <div className="draft-form-footer workitem-side-actions">
              <button type="button" className="cancel-btn" onClick={handleCloseRequest}>
                Cancelar
              </button>
              <button type="button" className="primary-save-btn" onClick={handleSave} disabled={saving || !title.trim()}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function TaskDraftModal({
  members,
  onClose,
  onSubmit,
}: {
  members: ProjectMember[];
  onClose: () => void;
  onSubmit: (values: TaskDraftFormValues, files: File[]) => Promise<void> | void;
}) {
  const form = useForm<TaskDraftFormValues>({
    defaultValues: {
      title: '',
      description: '',
      priority: 'Medio',
      assigneeId: '',
      dueDate: '',
    },
  });
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setAttachments(selected);
  };

  return (
    <div className="draft-modal-root" role="presentation">
      <button className="draft-modal-overlay" aria-label="Cerrar modal" onClick={onClose} />
      <section className="draft-modal" role="dialog" aria-modal="true" aria-label="Crear tarea">
        <header className="draft-modal-head">
          <h2>Nueva Tarea</h2>
          <button type="button" className="project-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className="draft-form" onSubmit={form.handleSubmit((values) => onSubmit(values, attachments))}>
          <label htmlFor="taskTitle">Titulo</label>
          <input id="taskTitle" type="text" placeholder="Ej: Revisar autenticacion SSO" {...form.register('title', { required: true, minLength: 3 })} />

          <label htmlFor="taskDescription">Descripcion</label>
          <textarea
            id="taskDescription"
            placeholder="Describe alcance, objetivo y criterios de salida"
            rows={4}
            {...form.register('description', { required: true, minLength: 8 })}
          />

          <div className="draft-grid-two">
            <div>
              <label htmlFor="taskPriority">Prioridad</label>
              <select id="taskPriority" {...form.register('priority')}>
                <option value="Alta">Alta</option>
                <option value="Medio">Medio</option>
                <option value="Bajo">Bajo</option>
              </select>
            </div>

            <div>
              <label htmlFor="taskDueDate">Fecha objetivo</label>
              <input id="taskDueDate" type="date" {...form.register('dueDate')} />
            </div>
          </div>

          <label htmlFor="taskAssignee">Responsable</label>
          <select id="taskAssignee" {...form.register('assigneeId')}>
            <option value="">Sin asignar</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name?.trim() || member.email}
              </option>
            ))}
          </select>

          <label className="draft-upload-label">
            Adjuntos (documentos, imagenes, videos)
            <input type="file" multiple accept={attachmentsAccept} onChange={handleFilesSelected} />
          </label>
          <AttachmentPreview files={attachments} />

          <footer className="draft-form-footer">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-save-btn">Guardar borrador</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function BugDraftModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (values: BugDraftFormValues, files: File[]) => Promise<void> | void;
}) {
  const form = useForm<BugDraftFormValues>({
    defaultValues: {
      title: '',
      description: '',
      priority: 'Medio',
      environment: '',
      expectedResult: '',
      actualResult: '',
    },
  });
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setAttachments(selected);
  };

  return (
    <div className="draft-modal-root" role="presentation">
      <button className="draft-modal-overlay" aria-label="Cerrar modal" onClick={onClose} />
      <section className="draft-modal" role="dialog" aria-modal="true" aria-label="Reportar bug">
        <header className="draft-modal-head">
          <h2>Reporte de Bug</h2>
          <button type="button" className="project-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className="draft-form" onSubmit={form.handleSubmit((values) => onSubmit(values, attachments))}>
          <label htmlFor="bugTitle">Titulo del bug</label>
          <input id="bugTitle" type="text" placeholder="Ej: Error 500 al crear proyecto" {...form.register('title', { required: true, minLength: 3 })} />

          <label htmlFor="bugDescription">Descripcion</label>
          <textarea
            id="bugDescription"
            placeholder="Describe el contexto del fallo"
            rows={3}
            {...form.register('description', { required: true, minLength: 8 })}
          />

          <div className="draft-grid-two">
            <div>
              <label htmlFor="bugPriority">Prioridad</label>
              <select id="bugPriority" {...form.register('priority')}>
                <option value="Alta">Alta</option>
                <option value="Medio">Medio</option>
                <option value="Bajo">Bajo</option>
              </select>
            </div>

            <div>
              <label htmlFor="bugEnvironment">Entorno</label>
              <input id="bugEnvironment" type="text" placeholder="QA / Staging / Produccion" {...form.register('environment')} />
            </div>
          </div>

          <label htmlFor="bugExpected">Resultado esperado</label>
          <textarea id="bugExpected" rows={2} placeholder="Que debia ocurrir" {...form.register('expectedResult')} />

          <label htmlFor="bugActual">Resultado actual</label>
          <textarea id="bugActual" rows={2} placeholder="Que ocurrio realmente" {...form.register('actualResult')} />

          <label className="draft-upload-label">
            Evidencias (documentos, imagenes, videos)
            <input type="file" multiple accept={attachmentsAccept} onChange={handleFilesSelected} />
          </label>
          <AttachmentPreview files={attachments} />

          <footer className="draft-form-footer">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-save-btn">Guardar reporte</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function AttachmentPreview({ files }: { files: File[] }) {
  if (files.length === 0) {
    return <p className="draft-files-empty">Sin adjuntos por ahora.</p>;
  }

  return (
    <ul className="draft-files-list">
      {files.map((file) => (
        <li key={`${file.name}-${file.size}`}>{`${file.name} (${formatFileSize(file.size)})`}</li>
      ))}
    </ul>
  );
}

function ProjectReportsPanel({ accessToken, projectId }: { accessToken: string | null; projectId: string }) {
  const [view, setView] = useState<'overview' | 'sprint' | 'monthly'>('overview');
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const reportContentRef = useRef<HTMLDivElement | null>(null);

  const sprintsQuery = useQuery({
    queryKey: ['reports-sprints', projectId],
    queryFn: () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return listSprints(accessToken, projectId);
    },
    enabled: Boolean(accessToken && projectId),
    retry: false,
  });

  useEffect(() => {
    if (!selectedSprintId && (sprintsQuery.data?.length ?? 0) > 0) {
      setSelectedSprintId(sprintsQuery.data?.[0]?.id ?? '');
    }
  }, [selectedSprintId, sprintsQuery.data]);

  const overviewQuery = useQuery({
    queryKey: ['reports-overview', projectId, 8],
    queryFn: () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return getOverviewReport(accessToken, projectId, 8);
    },
    enabled: Boolean(accessToken && projectId && view === 'overview'),
    retry: false,
  });

  const sprintQuery = useQuery({
    queryKey: ['reports-sprint', projectId, selectedSprintId],
    queryFn: () => {
      if (!accessToken || !projectId || !selectedSprintId) {
        throw new Error('Falta seleccionar sprint.');
      }

      return getSprintReport(accessToken, projectId, selectedSprintId);
    },
    enabled: Boolean(accessToken && projectId && selectedSprintId && view === 'sprint'),
    retry: false,
  });

  const monthlyQuery = useQuery({
    queryKey: ['reports-monthly', projectId, selectedMonth],
    queryFn: () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      return getMonthlyReport(accessToken, projectId, selectedMonth);
    },
    enabled: Boolean(accessToken && projectId && view === 'monthly'),
    retry: false,
  });

  const exportCsvMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesion activa o proyecto invalido.');
      }

      if (view === 'overview') {
        await downloadOverviewCsv(accessToken, projectId, 8);
        return;
      }

      if (view === 'sprint') {
        if (!selectedSprintId) {
          throw new Error('Selecciona un sprint para exportar.');
        }

        await downloadSprintCsv(accessToken, projectId, selectedSprintId);
        return;
      }

      await downloadMonthlyCsv(accessToken, projectId, selectedMonth);
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: async () => {
      if (!reportContentRef.current) {
        throw new Error('No hay contenido de reporte para exportar.');
      }

      const fileName =
        view === 'overview'
          ? `reporte-general-${projectId}.pdf`
          : view === 'sprint'
            ? `reporte-sprint-${selectedSprintId || 'sin-sprint'}.pdf`
            : `reporte-mensual-${selectedMonth}.pdf`;

      await exportElementToPdf(reportContentRef.current, fileName);
    },
  });

  return (
    <div className="project-reports-wrap">
      <div className="reports-toolbar">
        <div className="reports-view-tabs" role="tablist" aria-label="Tipo de reporte">
          <button type="button" className={`reports-view-tab ${view === 'overview' ? 'active' : ''}`} onClick={() => setView('overview')}>
            General
          </button>
          <button type="button" className={`reports-view-tab ${view === 'sprint' ? 'active' : ''}`} onClick={() => setView('sprint')}>
            Sprint
          </button>
          <button type="button" className={`reports-view-tab ${view === 'monthly' ? 'active' : ''}`} onClick={() => setView('monthly')}>
            Mensual QA
          </button>
        </div>

        {view === 'sprint' ? (
          <select value={selectedSprintId} onChange={(event) => setSelectedSprintId(event.target.value)}>
            {(sprintsQuery.data ?? []).map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
              </option>
            ))}
          </select>
        ) : null}

        {view === 'monthly' ? <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /> : null}

        <button type="button" className="mini-btn" onClick={() => exportCsvMutation.mutate()} disabled={exportCsvMutation.isPending}>
          {exportCsvMutation.isPending ? 'Exportando...' : 'Exportar CSV'}
        </button>

        <button type="button" className="mini-btn" onClick={() => exportPdfMutation.mutate()} disabled={exportPdfMutation.isPending}>
          {exportPdfMutation.isPending ? 'Generando PDF...' : 'Exportar PDF'}
        </button>
      </div>

      <div ref={reportContentRef}>
        {view === 'overview' ? <OverviewReportView query={overviewQuery} /> : null}
        {view === 'sprint' ? <SprintReportView query={sprintQuery} /> : null}
        {view === 'monthly' ? <MonthlyReportView query={monthlyQuery} /> : null}
      </div>
    </div>
  );
}

function OverviewReportView({
  query,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    data: OverviewReport | undefined;
  };
}) {
  if (query.isLoading) {
    return <p className="list-state">Cargando reporte general...</p>;
  }

  if (query.isError || !query.data) {
    return <p className="list-state error">No fue posible cargar el reporte general del proyecto.</p>;
  }

  const report = query.data;
  const maxTrendValue = Math.max(1, ...report.trend.map((point) => Math.max(point.created, point.closed)));
  const maxPriority = Math.max(1, ...report.priorityDistribution.map((point) => point.count));

  return (
    <>
      <div className="workspace-reports">
        <article className="report-card"><span>Total tickets</span><strong>{report.kpis.totalTickets}</strong><p>Tickets acumulados del proyecto</p></article>
        <article className="report-card"><span>Completados</span><strong>{report.kpis.completedTickets}</strong><p>{report.kpis.completionRate}% de cumplimiento general</p></article>
        <article className="report-card"><span>Bugs abiertos</span><strong>{report.kpis.openBugs}</strong><p>Incluye abierto y en progreso</p></article>
        <article className="report-card"><span>Reabiertos y rollover</span><strong>{report.kpis.reopenedTickets} / {report.kpis.rolloverTickets}</strong><p>Reabiertos / con rollover</p></article>
      </div>
      <div className="reports-visual-grid">
        <article className="report-card chart-panel">
          <span>Tendencia semanal</span>
          <div className="trend-chart">
            {report.trend.map((point) => (
              <div key={point.bucket} className="trend-row">
                <strong>{point.bucket}</strong>
                <div className="trend-bars">
                  <span className="trend-bar created" style={{ width: `${(point.created / maxTrendValue) * 100}%` }}>{point.created}</span>
                  <span className="trend-bar closed" style={{ width: `${(point.closed / maxTrendValue) * 100}%` }}>{point.closed}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="report-card chart-panel">
          <span>Prioridad</span>
          <div className="priority-chart">
            {report.priorityDistribution.map((item) => (
              <div key={item.priority} className="priority-row">
                <strong>{item.priority === 'HIGH' ? 'Alta' : item.priority === 'MEDIUM' ? 'Media' : 'Baja'}</strong>
                <div className="priority-track"><span className={`priority-fill ${item.priority.toLowerCase()}`} style={{ width: `${(item.count / maxPriority) * 100}%` }} /></div>
                <em>{item.count}</em>
              </div>
            ))}
          </div>
        </article>
      </div>
      <article className="report-card report-table-card">
        <span>Resumen por tipo</span>
        <table className="reports-table">
          <thead><tr><th>Tipo</th><th>Pendiente</th><th>En progreso</th><th>Completado</th></tr></thead>
          <tbody>
            {report.summaryTable.map((row) => (
              <tr key={row.type}><td>{row.type === 'TASK' ? 'Tarea' : 'Bug'}</td><td>{row.open}</td><td>{row.inProgress}</td><td>{row.completed}</td></tr>
            ))}
          </tbody>
        </table>
      </article>
    </>
  );
}

function SprintReportView({
  query,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    data: SprintReport | undefined;
  };
}) {
  if (query.isLoading) {
    return <p className="list-state">Cargando reporte de sprint...</p>;
  }

  if (query.isError || !query.data) {
    return <p className="list-state error">No fue posible cargar el reporte de sprint.</p>;
  }

  const report = query.data;
  const maxBurndown = Math.max(1, ...report.burndown.map((point) => point.remaining));

  return (
    <>
      <div className="workspace-reports">
        <article className="report-card"><span>Comprometidos</span><strong>{report.kpis.committedAtStart}</strong><p>{report.sprint.name}</p></article>
        <article className="report-card"><span>Completados sprint</span><strong>{report.kpis.completedInSprint}</strong><p>{report.kpis.completionRate}% cumplimiento</p></article>
        <article className="report-card"><span>Rollover</span><strong>{report.kpis.rolloverToNext}</strong><p>Movidos al siguiente sprint</p></article>
        <article className="report-card"><span>Reabiertos sprint</span><strong>{report.kpis.reopenedInSprint}</strong><p>Reversion de estado completado</p></article>
      </div>
      <div className="reports-visual-grid">
        <article className="report-card chart-panel">
          <span>Burndown</span>
          <div className="trend-chart">
            {report.burndown.map((point) => (
              <div key={point.date} className="trend-row">
                <strong>{point.date}</strong>
                <div className="trend-bars">
                  <span className="trend-bar created" style={{ width: `${(point.remaining / maxBurndown) * 100}%` }}>{point.remaining}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="report-card chart-panel">
          <span>Entrega semanal</span>
          <table className="reports-table">
            <thead><tr><th>Semana</th><th>Tareas</th><th>Bugs</th><th>Rollover</th></tr></thead>
            <tbody>
              {report.delivery.map((row) => (
                <tr key={row.bucket}><td>{row.bucket}</td><td>{row.completedTasks}</td><td>{row.completedBugs}</td><td>{row.rollover}</td></tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    </>
  );
}

function MonthlyReportView({
  query,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    data: MonthlyReport | undefined;
  };
}) {
  if (query.isLoading) {
    return <p className="list-state">Cargando reporte mensual QA...</p>;
  }

  if (query.isError || !query.data) {
    return <p className="list-state error">No fue posible cargar el reporte mensual QA.</p>;
  }

  const report = query.data;
  const maxTrend = Math.max(1, ...report.weeklyTrend.map((point) => Math.max(point.created, point.closed)));

  return (
    <>
      <div className="workspace-reports">
        <article className="report-card"><span>Creados</span><strong>{report.kpis.created}</strong><p>Mes {report.month}</p></article>
        <article className="report-card"><span>Cerrados</span><strong>{report.kpis.closed}</strong><p>Mes {report.month}</p></article>
        <article className="report-card"><span>Lead time prom.</span><strong>{report.kpis.avgLeadTimeDays} dias</strong><p>Promedio de cierre</p></article>
        <article className="report-card"><span>Reopen rate</span><strong>{report.kpis.reopenRate}%</strong><p>Tickets reabiertos / cerrados</p></article>
      </div>
      <div className="reports-visual-grid">
        <article className="report-card chart-panel">
          <span>Tendencia semanal mensual</span>
          <div className="trend-chart">
            {report.weeklyTrend.map((point) => (
              <div key={point.week} className="trend-row">
                <strong>{point.week}</strong>
                <div className="trend-bars">
                  <span className="trend-bar created" style={{ width: `${(point.created / maxTrend) * 100}%` }}>{point.created}</span>
                  <span className="trend-bar closed" style={{ width: `${(point.closed / maxTrend) * 100}%` }}>{point.closed}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="report-card chart-panel">
          <span>Cierres por tipo</span>
          <table className="reports-table">
            <thead><tr><th>Semana</th><th>Tareas cerradas</th><th>Bugs cerrados</th></tr></thead>
            <tbody>
              {report.weeklyTypeClosure.map((row) => (
                <tr key={row.week}><td>{row.week}</td><td>{row.tasksClosed}</td><td>{row.bugsClosed}</td></tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    </>
  );
}

function SectionView({ title, description }: { title: string; description: string }) {
  return (
    <section className="section-view">
      <header className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <article className="placeholder-card">
        <h2>Vista en preparacion</h2>
        <p>Este modulo quedo listo en estructura visual para continuar con la implementacion funcional.</p>
      </article>
    </section>
  );
}

function InvitationsView() {
  const accessToken = localStorage.getItem('qualio_access_token');
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('ALL');
  const [limit, setLimit] = useState(40);
  const [toast, setToast] = useState<ToastState>(null);

  const notificationsQuery = useQuery({
    queryKey: ['invitation-notifications', accessToken, limit, 'view'],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return listInvitationNotifications(accessToken, { limit, offset: 0 });
    },
    enabled: Boolean(accessToken),
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return acceptInvitation(accessToken, invitationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation-notifications', accessToken] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'ACTIVE', 'sidebar'] });
      setToast({ message: 'Invitacion aceptada.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!accessToken) {
        throw new Error('No hay sesion activa.');
      }

      return rejectInvitation(accessToken, invitationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation-notifications', accessToken] });
      setToast({ message: 'Invitacion rechazada.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const all = (notificationsQuery.data ?? []).filter((item) => item.type.startsWith('INVITATION_'));
  const items = all.filter((item) => {
    if (filter === 'ALL') {
      return true;
    }

    if (filter === 'PENDING') {
      return item.type === 'INVITATION_PENDING';
    }

    if (filter === 'ACCEPTED') {
      return item.type === 'INVITATION_ACCEPTED';
    }

    return item.type === 'INVITATION_REJECTED';
  });
  const groupedItems = groupNotificationsByDay(items);

  return (
    <section className="section-view">
      <header className="page-header">
        <h1>Invitaciones</h1>
        <p>Administra solicitudes para participar en proyectos.</p>
      </header>

      <div className="invitation-filters">
        {(['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`mini-btn ${filter === value ? 'primary' : ''}`}
            onClick={() => setFilter(value)}
          >
            {value === 'ALL' ? 'Todas' : value}
          </button>
        ))}
      </div>

      <div className="invitation-grid">
        {notificationsQuery.isLoading ? <p className="list-state">Cargando invitaciones...</p> : null}

        {!notificationsQuery.isLoading && items.length === 0 ? (
          <article className="notification-card reel-focus">
            <strong>Sin invitaciones</strong>
            <p>No hay resultados para el filtro seleccionado.</p>
          </article>
        ) : null}

        {groupedItems.map((group) => (
          <section key={group.label} className="notification-group">
            <h4>{group.label}</h4>
            {group.items.map((notification) => (
              <article key={notification.id} className={`notification-card ${!notification.isRead ? 'unread' : ''}`}>
                <div className="notification-card-head">
                  <NotificationActorAvatar notification={notification} />
                  <div className="notification-card-head-meta">
                    <strong>{getNotificationActorName(notification)}</strong>
                    <span className={`notification-kind ${getNotificationKind(notification.type)}`}>
                      {getNotificationLabel(notification.type)}
                    </span>
                  </div>
                </div>
                <strong className="notification-title">{notification.title}</strong>
                <p>{notification.message}</p>
                <time>{formatDateTime(notification.createdAt)}</time>
                <div className="notification-actions">
                  {notification.actionType === 'INVITATION_RESPONSE' && notification.actionId ? (
                    <>
                      <button
                        type="button"
                        className="mini-btn icon-action primary"
                        onClick={() => acceptMutation.mutate(notification.actionId as string)}
                        disabled={acceptMutation.isPending || rejectMutation.isPending}
                        aria-label="Aceptar invitacion"
                        title="Aceptar invitacion"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="mini-btn icon-action"
                        onClick={() => rejectMutation.mutate(notification.actionId as string)}
                        disabled={acceptMutation.isPending || rejectMutation.isPending}
                        aria-label="Rechazar invitacion"
                        title="Rechazar invitacion"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span className="notification-result">Registro finalizado</span>
                  )}
                </div>
              </article>
            ))}
          </section>
        ))}

        {all.length >= limit ? (
          <button
            type="button"
            className="mini-btn"
            onClick={() => setLimit((value) => value + 20)}
            disabled={notificationsQuery.isFetching}
          >
            {notificationsQuery.isFetching ? 'Cargando...' : 'Cargar mas'}
          </button>
        ) : null}
      </div>

      {toast ? (
        <div className="toast-wrap" role="status" aria-live="polite">
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        </div>
      ) : null}
    </section>
  );
}

function toApiPriority(priority: 'Alta' | 'Medio' | 'Bajo'): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (priority === 'Alta') {
    return 'HIGH';
  }

  if (priority === 'Medio') {
    return 'MEDIUM';
  }

  return 'LOW';
}

function toApiSection(section: BacklogSection): 'NEXT_SPRINT' | 'GENERAL_BACKLOG' {
  return section === 'nextSprint' ? 'NEXT_SPRINT' : 'GENERAL_BACKLOG';
}

function fromTaskToBacklogItem(task: Task, memberNameById: Map<string, string>): BacklogItem {
  return {
    id: `task-${task.id}`,
    displayKey: task.itemKey ?? `TASK-${task.id.slice(0, 6).toUpperCase()}`,
    entityId: task.id,
    title: task.title,
    itemType: 'task',
    priority: fromApiPriority(task.priority),
    status: fromTaskStatus(task.status),
    assignee: task.assignedTo ? (memberNameById.get(task.assignedTo) ?? task.assignedTo) : 'Sin asignar',
    assigneeUserId: task.assignedTo,
    section: task.section === 'NEXT_SPRINT' ? 'nextSprint' : 'general',
    position: task.position,
  };
}

function fromBugToBacklogItem(bug: Bug): BacklogItem {
  return {
    id: `bug-${bug.id}`,
    displayKey: bug.itemKey ?? `BUG-${bug.id.slice(0, 6).toUpperCase()}`,
    entityId: bug.id,
    title: bug.title,
    itemType: 'bug',
    priority: fromApiPriority(bug.priority),
    status: fromBugStatus(bug.status),
    assignee: 'Sin asignar',
    assigneeUserId: null,
    section: bug.section === 'NEXT_SPRINT' ? 'nextSprint' : 'general',
    position: bug.position,
  };
}

function fromApiPriority(priority: 'HIGH' | 'MEDIUM' | 'LOW'): 'Alta' | 'Medio' | 'Bajo' {
  if (priority === 'HIGH') {
    return 'Alta';
  }

  if (priority === 'MEDIUM') {
    return 'Medio';
  }

  return 'Bajo';
}

function fromTaskStatus(status: 'TODO' | 'IN_PROGRESS' | 'DONE'): 'Pendiente' | 'En progreso' | 'Bloqueado' {
  if (status === 'TODO') {
    return 'Pendiente';
  }

  if (status === 'IN_PROGRESS') {
    return 'En progreso';
  }

  return 'Bloqueado';
}

function fromBugStatus(status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'): 'Pendiente' | 'En progreso' | 'Bloqueado' {
  if (status === 'OPEN') {
    return 'Pendiente';
  }

  if (status === 'IN_PROGRESS') {
    return 'En progreso';
  }

  return 'Bloqueado';
}

function getNotificationActorName(notification: AppNotification): string {
  return notification.actorName?.trim() || notification.actorEmail || 'Sistema';
}

function getNotificationKind(type: string): 'invitation' | 'accepted' | 'reminder' {
  if (type.endsWith('_PENDING') || type.includes('CREATED')) {
    return 'invitation';
  }

  if (type.endsWith('_ACCEPTED') || type.includes('UPDATED')) {
    return 'accepted';
  }

  return 'reminder';
}

function getNotificationLabel(type: string): string {
  if (type === 'INVITATION_PENDING') {
    return 'Invitacion';
  }

  if (type === 'INVITATION_ACCEPTED') {
    return 'Aceptada';
  }

  if (type === 'INVITATION_REJECTED') {
    return 'Rechazada';
  }

  if (type === 'TASK_CREATED' || type === 'BUG_CREATED') {
    return 'Nuevo';
  }

  return 'Actualizado';
}

function groupNotificationsByDay(notifications: AppNotification[]): Array<{ label: string; items: AppNotification[] }> {
  const formatter = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const now = new Date();
  const todayKey = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = yesterday.toDateString();

  const groups = new Map<string, AppNotification[]>();

  notifications.forEach((notification) => {
    const date = new Date(notification.createdAt);
    const key = date.toDateString() === todayKey ? 'Hoy' : date.toDateString() === yesterdayKey ? 'Ayer' : formatter.format(date);

    const current = groups.get(key) ?? [];
    current.push(notification);
    groups.set(key, current);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function getInitials(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) {
    return 'NA';
  }

  const words = cleaned.replace(/@.*/, '').split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  const compact = words[0] ?? cleaned;
  return compact.slice(0, 2).toUpperCase();
}

function formatDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function NavSubItem({ to, label, onNavigate }: { to: string; label: string; onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-sub-item ${isActive ? 'active' : ''}`}
      onClick={onNavigate}
    >
      {label}
    </NavLink>
  );
}

function NavGroup({
  icon,
  title,
  expanded,
  onToggle,
  active,
  children,
}: {
  icon: ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section className="nav-group">
      <button
        type="button"
        className={`nav-group-head ${active ? 'active' : ''}`}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="nav-group-title">
          {icon}
          {title}
        </span>
        <IconChevron direction={expanded ? 'up' : 'down'} />
      </button>

      {expanded ? <div className="nav-group-content">{children}</div> : null}
    </section>
  );
}

function IconChevron({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg viewBox="0 0 24 24" className={`icon icon-chevron ${direction}`} aria-hidden="true">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      <path d="M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 19a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 11a3 3 0 0 1 3 3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      <path d="M12 3a5 5 0 0 0-5 5v3l-2 3h14l-2-3V8a5 5 0 0 0-5-5z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 18a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      <path d="M18 14.5A6.5 6.5 0 0 1 9.5 6a7 7 0 1 0 8.5 8.5z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      <circle cx="12" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5 19a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function hasSession(): boolean {
  return Boolean(localStorage.getItem('qualio_access_token'));
}

function clearSession(): void {
  localStorage.removeItem('qualio_access_token');
  localStorage.removeItem('qualio_refresh_token');
  localStorage.removeItem('qualio_user');
}

function saveSession(accessToken: string, refreshToken: string, user: unknown): void {
  localStorage.setItem('qualio_access_token', accessToken);
  localStorage.setItem('qualio_refresh_token', refreshToken);
  localStorage.setItem('qualio_user', JSON.stringify(user));
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = localStorage.getItem('qualio_theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('qualio_theme', mode);
}

function getStoredUser(): StoredUser | null {
  const value = localStorage.getItem('qualio_user');

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as StoredUser;
  } catch {
    return null;
  }
}

function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const responseBody = error.response?.data as
      | { message?: string | string[] }
      | undefined;

    if (Array.isArray(responseBody?.message) && responseBody.message.length > 0) {
      return responseBody.message[0];
    }

    if (typeof responseBody?.message === 'string') {
      return responseBody.message;
    }

    if (error.response?.status === 401) {
      return 'Tu sesion expiro. Inicia sesion nuevamente.';
    }

    return 'No fue posible completar la solicitud de autenticacion.';
  }

  return 'Ocurrio un error inesperado.';
}
