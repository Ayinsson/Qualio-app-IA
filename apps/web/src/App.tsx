import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { useForm } from 'react-hook-form';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { z } from 'zod';

import { changePassword, login, register, removeAvatar, resolveSession, updateAvatar, updateProfile } from './lib/auth';
import { getProject, listProjects } from './lib/projects';
import { listAttachments, registerAttachment } from './lib/attachments';
import { createBug, listBugHistory, listBugs, moveBug, reopenBug, updateBug, type Bug } from './lib/bugs';
import { createComment, listComments } from './lib/comments';
import {
  acceptInvitation,
  cancelProjectInvitation,
  createInvitation,
  listInvitationNotifications,
  listProjectPendingInvitations,
  markAllInvitationsRead,
  rejectInvitation,
} from './lib/invitations';
import { listProjectMembers, removeProjectMember } from './lib/project-members';
import { DashboardView } from './features/dashboard/DashboardView';
import { getApiErrorMessage } from './lib/apiErrors';
import { ProjectsView } from './features/projects/ProjectsView';
import { BacklogPanel } from './features/project/BacklogPanel';
import { BoardPanel } from './features/project/BoardPanel';
import { DonePanel } from './features/project/DonePanel';
import { ReportsPanel } from './features/project/reports/ReportsPanel';
import { InvitationsPage } from './features/collab/InvitationsPage';
import { MembersModal } from './features/collab/MembersModal';
import { SharedProjectsView } from './features/collab/SharedProjectsView';
import { ApiTokensDialog } from './features/profile/ApiTokensDialog';
import { ProfileModal } from './features/profile/ProfileModal';
import { CreateTicketModal } from './features/ticket/CreateTicketModal';
import { TicketDetailModal } from './features/ticket/TicketDetailModal';
import { DESTINATION_LABEL } from './features/ticket/types';
import type { Destination, NewBugValues, NewTaskValues } from './features/ticket/types';
import { ProjectHeader } from './features/project/ProjectHeader';
import { ProjectTabs } from './features/project/ProjectTabs';
import { SprintBar } from './features/project/SprintBar';
import type {
  BacklogSectionId,
  BoardCard,
  BoardColumnId,
  DoneItem,
  PlanItem,
  ProjectTabId,
} from './features/project/types';
import { computeProgress } from './features/projects/progress';
import './features/project/project.css';
import { Button, ToastProvider, useToast } from './ui';
import {
  CommandPalette,
  getBreadcrumb,
  isPendingInvitation,
  NotificationsPanel,
  Sidebar,
  Topbar,
} from './layout';
import type { BrowserAlertsState, NavProject, NotificationFilter } from './layout';
import { getActiveSprint, startSprint } from './lib/sprints';
import { supabase } from './lib/supabase';
import { createTask, listTaskHistory, listTasks, moveTask, reopenTask, updateTask, type Task } from './lib/tasks';

const loginSchema = z.object({
  email: z.string().email('Escribe un correo válido, como tu@empresa.com'),
  password: z.string().min(6, 'La contraseña tiene al menos 6 caracteres'),
});

const registerSchema = z
  .object({
    fullName: z.string().min(3, 'Escribe tu nombre completo'),
    email: z.string().email('Escribe un correo válido, como tu@empresa.com'),
    password: z.string().min(8, 'Usa al menos 8 caracteres'),
    confirmPassword: z.string().min(8, 'Repite la contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });

// Referencia del sistema base: solo existe en desarrollo y se carga aparte (no entra en producción).
const DesignSystemPreview = import.meta.env.DEV
  ? lazy(() => import('./ui/DesignSystemPreview').then((module) => ({ default: module.DesignSystemPreview })))
  : null;

const authRunCases: Array<{ id: string; name: string }> = [
  { id: 'CP-01', name: 'Inicio de sesión' },
  { id: 'CP-02', name: 'Crear proyecto' },
  { id: 'CP-03', name: 'Reportar bug' },
  { id: 'CP-04', name: 'Cerrar sprint' },
];

function CrossIcon() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true" focusable="false">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {crossed ? (
        <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;
type AuthMode = 'login' | 'register';
type ToastType = 'success' | 'error';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

type ThemeMode = 'light' | 'dark';

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
  dueDate: string | null;
  section: BacklogSection;
  position: number;
};

type CreateWorkItemType = 'task' | 'bug' | null;

type SelectedWorkItem =
  | { type: 'task'; id: string }
  | { type: 'bug'; id: string }
  | null;

const workspaceTabs: Array<{ id: ProjectWorkspaceTab; label: string }> = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'board', label: 'Tablero' },
  { id: 'done', label: 'Completado' },
  { id: 'reports', label: 'Reportes' },
];

const initialBacklogItems: BacklogItem[] = [];


type StoredUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  avatarUrl?: string | null;
};

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </ToastProvider>
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
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    const commit = () => {
      flushSync(() => setTheme(next));
      applyTheme(next);
    };

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (typeof document.startViewTransition !== 'function' || reduceMotion) {
      commit();
      return;
    }

    // Barrido de izquierda a derecha: el nuevo tema "empuja" al anterior (ver ::view-transition en styles.css).
    document.startViewTransition(commit);
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
          authenticated ? (
            <Navigate to="/app/dashboard" replace />
          ) : (
            <AuthPage onAuthSuccess={handleAuthSuccess} theme={theme} onToggleTheme={toggleTheme} />
          )
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

function AuthPage({
  onAuthSuccess,
  theme,
  onToggleTheme,
}: {
  onAuthSuccess: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
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
      showToast(`Sesión iniciada como ${data.user.email}.`, 'success');
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

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setShowPassword(false);
  };

  const registerPasswordValue = registerForm.watch('password');
  const registerConfirmValue = registerForm.watch('confirmPassword');
  const passwordLongEnough = registerPasswordValue.length >= 8;
  const passwordsMatch = registerConfirmValue.length > 0 && registerPasswordValue === registerConfirmValue;
  const passwordInputType = showPassword ? 'text' : 'password';

  // Un solo estado para mostrar u ocultar: en el registro, el botón de cada campo muestra ambas
  // contraseñas, así el usuario puede compararlas.
  const passwordToggle = (what: string, controls: string) => (
    <button
      type="button"
      className="auth-reveal"
      onClick={() => setShowPassword((current) => !current)}
      aria-label={`${showPassword ? 'Ocultar' : 'Mostrar'} ${what}`}
      aria-pressed={showPassword}
      aria-controls={controls}
    >
      <EyeIcon crossed={showPassword} />
    </button>
  );

  // Tras un envío con errores, la regla que no se cumple se marca en la lista en lugar de repetirse bajo el campo.
  const ruleState = (met: boolean, failed: boolean) => (met ? 'is-met' : failed ? 'is-failed' : '');

  return (
    <main className="auth-shell">
      <aside className="auth-brand">
        <ol className="auth-run" aria-hidden="true">
          {authRunCases.map((testCase, index) => (
            <li key={testCase.id} style={{ '--run-step': index } as CSSProperties}>
              <span className="auth-run-check">
                <CheckIcon />
              </span>
              <span className="auth-run-id">{testCase.id}</span>
              <span className="auth-run-name">{testCase.name}</span>
              <span className="auth-run-status">Aprobado</span>
            </li>
          ))}
        </ol>
        <div className="auth-brand-copy">
          <svg
            className="auth-signature"
            viewBox="0 0 500 120"
            role="img"
            aria-label="Tu aliado de QA"
          >
            <text x="6" y="88">
              Tu aliado de QA
            </text>
          </svg>
          <p className="auth-tagline-sub">Casos de prueba, bugs y sprints de tu equipo en un solo lugar.</p>
        </div>
      </aside>

      <section className="auth-panel">
        <div className="auth-theme">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <div className="auth-panel-inner">
          <header className="auth-header">
            {!logoFailed ? (
              <span className="auth-logo-wink">
                <img
                  className="auth-logo auth-logo--light"
                  src="/qualio-logo.png"
                  alt="Qualio"
                  onError={() => setLogoFailed(true)}
                />
                {/* En modo oscuro, la versión monocroma blanca (la misma del menú lateral). */}
                <img className="auth-logo auth-logo--dark" src="/logo-menu-dark.png" alt="Qualio" />
              </span>
            ) : (
              <h1>Qualio</h1>
            )}
          </header>

          <div className="auth-tabs" role="tablist" aria-label="Elige cómo entrar">
            <button
              type="button"
              role="tab"
              id="auth-tab-login"
              aria-selected={mode === 'login'}
              aria-controls="auth-form-panel"
              onClick={() => switchMode('login')}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              role="tab"
              id="auth-tab-register"
              aria-selected={mode === 'register'}
              aria-controls="auth-form-panel"
              onClick={() => switchMode('register')}
            >
              Crear cuenta
            </button>
          </div>

          <div
            id="auth-form-panel"
            role="tabpanel"
            aria-labelledby={mode === 'login' ? 'auth-tab-login' : 'auth-tab-register'}
          >
            {mode === 'login' ? (
              <form className="auth-form" onSubmit={loginForm.handleSubmit(onLoginSubmit)} noValidate>
                <div className="auth-field">
                  <label htmlFor="email">Correo</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@empresa.com"
                    aria-invalid={Boolean(loginErrors.email)}
                    aria-describedby={loginErrors.email ? 'email-error' : undefined}
                    {...loginForm.register('email')}
                  />
                  {loginErrors.email ? (
                    <span id="email-error" className="field-error">
                      {loginErrors.email}
                    </span>
                  ) : null}
                </div>

                <div className="auth-field">
                  <label htmlFor="password">Contraseña</label>
                  <div className="auth-input-wrap">
                    <input
                      id="password"
                      type={passwordInputType}
                      autoComplete="current-password"
                      aria-invalid={Boolean(loginErrors.password)}
                      aria-describedby={loginErrors.password ? 'password-error' : undefined}
                      {...loginForm.register('password')}
                    />
                    {passwordToggle('contraseña', 'password')}
                  </div>
                  {loginErrors.password ? (
                    <span id="password-error" className="field-error">
                      {loginErrors.password}
                    </span>
                  ) : null}
                </div>

                <button type="submit" className="auth-submit" disabled={submitting}>
                  {submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
                </button>

                <p className="auth-switch">
                  ¿Aún no tienes cuenta?{' '}
                  <button type="button" onClick={() => switchMode('register')}>
                    Crea una
                  </button>
                </p>
              </form>
            ) : (
              <form className="auth-form" onSubmit={registerForm.handleSubmit(onRegisterSubmit)} noValidate>
                <div className="auth-field">
                  <label htmlFor="fullName">Nombre completo</label>
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Ana Pérez"
                    aria-invalid={Boolean(registerErrors.fullName)}
                    aria-describedby={registerErrors.fullName ? 'fullName-error' : undefined}
                    {...registerForm.register('fullName')}
                  />
                  {registerErrors.fullName ? (
                    <span id="fullName-error" className="field-error">
                      {registerErrors.fullName}
                    </span>
                  ) : null}
                </div>

                <div className="auth-field">
                  <label htmlFor="registerEmail">Correo</label>
                  <input
                    id="registerEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@empresa.com"
                    aria-invalid={Boolean(registerErrors.email)}
                    aria-describedby={registerErrors.email ? 'registerEmail-error' : undefined}
                    {...registerForm.register('email')}
                  />
                  {registerErrors.email ? (
                    <span id="registerEmail-error" className="field-error">
                      {registerErrors.email}
                    </span>
                  ) : null}
                </div>

                <div className="auth-field">
                  <label htmlFor="registerPassword">Contraseña</label>
                  <div className="auth-input-wrap">
                    <input
                      id="registerPassword"
                      type={passwordInputType}
                      autoComplete="new-password"
                      aria-invalid={Boolean(registerErrors.password)}
                      aria-describedby="password-rules"
                      {...registerForm.register('password')}
                    />
                    {passwordToggle('las contraseñas', 'registerPassword confirmPassword')}
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="confirmPassword">Repite la contraseña</label>
                  <div className="auth-input-wrap">
                    <input
                      id="confirmPassword"
                      type={passwordInputType}
                      autoComplete="new-password"
                      aria-invalid={Boolean(registerErrors.confirmPassword)}
                      aria-describedby="password-rules"
                      {...registerForm.register('confirmPassword')}
                    />
                    {passwordToggle('las contraseñas', 'registerPassword confirmPassword')}
                  </div>
                </div>

                <ul id="password-rules" className="auth-rules">
                  {(
                    [
                      ['Al menos 8 caracteres', passwordLongEnough, Boolean(registerErrors.password)],
                      ['Las dos contraseñas coinciden', passwordsMatch, Boolean(registerErrors.confirmPassword)],
                    ] as const
                  ).map(([rule, met, failed]) => {
                    const state = ruleState(met, failed);
                    return (
                      <li key={rule} className={state}>
                        <span className="auth-rule-mark">{state === 'is-failed' ? <CrossIcon /> : <CheckIcon />}</span>
                        {state === 'is-failed' ? <span className="sr-only">Falta: </span> : null}
                        {rule}
                      </li>
                    );
                  })}
                </ul>

                <button type="submit" className="auth-submit" disabled={submitting}>
                  {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
                </button>

                <p className="auth-switch">
                  ¿Ya tienes cuenta?{' '}
                  <button type="button" onClick={() => switchMode('login')}>
                    Inicia sesión
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLimit, setNotificationsLimit] = useState(20);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('ALL');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [apiTokensOpen, setApiTokensOpen] = useState(false);
  const [browserAlerts, setBrowserAlerts] = useState<BrowserAlertsState>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported',
  );
  const accessToken = localStorage.getItem('qualio_access_token');
  const [storedUser, setStoredUser] = useState<StoredUser | null>(() => getStoredUser());
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsBootstrappedRef = useRef(false);

  const [sessionRenewals, setSessionRenewals] = useState(0);

  const sessionQuery = useQuery({
    queryKey: ['session-user', accessToken],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('No hay token activo.');
      }

      return resolveSession(accessToken, localStorage.getItem('qualio_refresh_token'));
    },
    enabled: Boolean(accessToken),
    retry: false,
  });
  const sessionResolution = sessionQuery.data;
  const sessionUser = sessionResolution?.status === 'valid' ? sessionResolution.session : undefined;
  const handledSessionResolutionRef = useRef<typeof sessionResolution>(undefined);

  // A stored session the API no longer accepts (expired, signed with another secret, or a
  // deleted user) must not leave the user inside an app where every request fails.
  useEffect(() => {
    if (!sessionResolution || handledSessionResolutionRef.current === sessionResolution) {
      return;
    }

    handledSessionResolutionRef.current = sessionResolution;

    if (sessionResolution.status === 'invalid') {
      queryClient.clear();
      onLogout();
      return;
    }

    if (sessionResolution.status === 'refreshed') {
      const { accessToken: nextAccessToken, refreshToken, user } = sessionResolution.auth;
      saveSession(nextAccessToken, refreshToken, user);
      setStoredUser(user);
      setSessionRenewals((count) => count + 1);
    }
  }, [sessionResolution, onLogout, queryClient]);

  // After a renewal the component re-renders with the new token; refetch data that may
  // have failed with the expired one.
  useEffect(() => {
    if (sessionRenewals > 0) {
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'session-user' });
    }
  }, [sessionRenewals, queryClient]);

  const activeProjectsQuery = useQuery({
    queryKey: ['projects', 'ACTIVE', 'sidebar'],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('No hay sesión activa.');
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
        throw new Error('No hay sesión activa.');
      }

      return listInvitationNotifications(accessToken, { limit: notificationsLimit, offset: 0 });
    },
    enabled: Boolean(accessToken),
    retry: false,
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!accessToken) {
        throw new Error('No hay sesión activa.');
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
        throw new Error('No hay sesión activa.');
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
        throw new Error('No hay sesión activa.');
      }

      return markAllInvitationsRead(accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation-notifications', accessToken] });
    },
  });

  const notificationsFeed = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);
  const currentUserId = storedUser?.id ?? sessionUser?.user.sub ?? null;
  const unreadNotifications = notificationsFeed.filter((item) => !item.isRead).length;
  const pendingInvitations = notificationsFeed.filter(isPendingInvitation).length;
  const navProjects: NavProject[] = useMemo(
    () => (activeProjectsQuery.data ?? []).map(({ id, name, logoUrl }) => ({ id, name, logoUrl })),
    [activeProjectsQuery.data],
  );
  const breadcrumb = getBreadcrumb(location.pathname, navProjects);
  const userEmail = sessionUser?.user.email ?? storedUser?.email ?? '';
  const userName = storedUser?.name?.trim() || userEmail.split('@')[0] || 'Tu cuenta';

  useEffect(() => {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setSearchOpen(false);
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

  // Ctrl/Cmd + K abre el buscador; Escape cierra los paneles.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setNotificationsOpen(false);
        setSearchOpen((value) => !value);
        return;
      }

      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        setMenuOpen(false);
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

  // Avisos del navegador: solo para notificaciones nuevas y si la persona los activó.
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
        browserNotification.close();
      };
    });
  }, [notificationsFeed]);

  const enableBrowserAlerts = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    void window.Notification.requestPermission().then((permission) => setBrowserAlerts(permission));
  };

  const logout = () => {
    onLogout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="ql-shell">
      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNewProject={() => {
          setMenuOpen(false);
          navigate('/app/proyectos/nuevo');
        }}
        projects={navProjects}
        projectsLoading={activeProjectsQuery.isLoading}
        projectsError={activeProjectsQuery.isError}
        pendingInvitations={pendingInvitations}
        user={{ name: userName, email: userEmail, avatarUrl: storedUser?.avatarUrl ?? null }}
        onEditProfile={() => {
          setMenuOpen(false);
          setProfileModalOpen(true);
        }}
        onLogout={logout}
      />

      {menuOpen ? (
        <div className="ql-panel-backdrop ql-sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      ) : null}

      <div className="ql-main">
        <Topbar
          breadcrumb={breadcrumb}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenSearch={() => {
            setNotificationsOpen(false);
            setSearchOpen(true);
          }}
          unreadNotifications={unreadNotifications}
          notificationsOpen={notificationsOpen}
          onToggleNotifications={() => setNotificationsOpen((value) => !value)}
          themeToggle={<ThemeToggle theme={theme} onToggle={onToggleTheme} />}
        />

        <main className="content-area">
          <Routes>
            <Route
              path="dashboard"
              element={<DashboardView user={{ id: currentUserId, name: storedUser?.name ?? null, email: userEmail || null }} />}
            />
            <Route path="proyectos/nuevo" element={<ProjectsView tab="active" createOpen currentUserId={currentUserId} />} />
            <Route path="proyectos/activos" element={<ProjectsView tab="active" currentUserId={currentUserId} />} />
            <Route path="proyectos/archivados" element={<ProjectsView tab="archived" currentUserId={currentUserId} />} />
            <Route path="proyectos/:projectId" element={<ProjectDetailView />} />
            <Route path="colaborar/compartidos" element={<SharedProjectsView currentUserId={currentUserId} />} />
            <Route path="colaborar/invitaciones" element={<InvitationsPage />} />
            {DesignSystemPreview ? (
              <Route
                path="sistema"
                element={
                  <Suspense fallback={null}>
                    <DesignSystemPreview />
                  </Suspense>
                }
              />
            ) : null}
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notificationsFeed}
        loading={notificationsQuery.isLoading}
        filter={notificationFilter}
        onFilterChange={setNotificationFilter}
        unreadCount={unreadNotifications}
        onMarkAllRead={() => readAllNotificationsMutation.mutate()}
        markingAllRead={readAllNotificationsMutation.isPending}
        onAccept={(invitationId) => acceptInvitationMutation.mutate(invitationId)}
        onReject={(invitationId) => rejectInvitationMutation.mutate(invitationId)}
        responding={acceptInvitationMutation.isPending || rejectInvitationMutation.isPending}
        canLoadMore={notificationsFeed.length >= notificationsLimit}
        loadingMore={notificationsQuery.isFetching && !notificationsQuery.isLoading}
        onLoadMore={() => setNotificationsLimit((value) => value + 20)}
        browserAlerts={browserAlerts}
        onEnableBrowserAlerts={enableBrowserAlerts}
      />

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} projects={navProjects} />

      {profileModalOpen ? (
        <ProfileDialog
          accessToken={accessToken}
          userName={storedUser?.name ?? userName}
          userEmail={userEmail}
          avatarUrl={storedUser?.avatarUrl ?? null}
          onUserUpdated={setStoredUser}
          onManageApiTokens={() => {
            setProfileModalOpen(false);
            setApiTokensOpen(true);
          }}
          onClose={() => setProfileModalOpen(false)}
        />
      ) : null}

      {apiTokensOpen ? <ApiTokensDialog accessToken={accessToken} onClose={() => setApiTokensOpen(false)} /> : null}
    </div>
  );
}

// Conecta el modal de perfil con la API, Supabase Storage y la sesión guardada.
function ProfileDialog({
  accessToken,
  userName,
  userEmail,
  avatarUrl,
  onUserUpdated,
  onManageApiTokens,
  onClose,
}: {
  accessToken: string | null;
  userName: string;
  userEmail: string;
  avatarUrl: string | null;
  onUserUpdated: (user: StoredUser) => void;
  onManageApiTokens: () => void;
  onClose: () => void;
}) {
  const toast = useToast();

  const requireToken = () => {
    if (!accessToken) {
      throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    }
    return accessToken;
  };

  const persist = (user: StoredUser) => {
    localStorage.setItem('qualio_user', JSON.stringify(user));
    onUserUpdated(user);
  };

  // Envuelve cada acción: muestra el aviso de error y vuelve a lanzarlo para que el modal no limpie el formulario.
  const run = async (action: () => Promise<string>) => {
    try {
      toast(await action());
    } catch (error) {
      toast(getApiErrorMessage(error), 'error');
      throw error;
    }
  };

  const removeStoredPhotos = async (userId: string, keep?: string) => {
    const { data } = await supabase.storage.from('avatars').list(userId);
    const paths = (data ?? []).map((file) => `${userId}/${file.name}`).filter((path) => path !== keep);
    if (paths.length > 0) {
      await supabase.storage.from('avatars').remove(paths);
    }
  };

  return (
    <ProfileModal
      user={{ name: userName, email: userEmail, avatarUrl }}
      onManageApiTokens={onManageApiTokens}
      onClose={onClose}
      onSaveName={(name) =>
        run(async () => {
          const response = await updateProfile(requireToken(), { name, email: userEmail });
          persist({ ...response.user, avatarUrl: getStoredUser()?.avatarUrl ?? avatarUrl });
          return 'Nombre actualizado.';
        })
      }
      onChangePassword={(currentPassword, newPassword) =>
        run(async () => {
          await changePassword(requireToken(), { currentPassword, newPassword });
          return 'Contraseña actualizada.';
        })
      }
      onUploadPhoto={(file) =>
        run(async () => {
          const token = requireToken();
          const userId = getStoredUser()?.id;
          if (!userId) {
            throw new Error('No pudimos identificar tu cuenta. Vuelve a iniciar sesión.');
          }
          const extension = file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'jpg';
          const filePath = `${userId}/avatar.${extension}`;
          const { error } = await supabase.storage.from('avatars').upload(filePath, file, { cacheControl: '3600', upsert: true });
          if (error) {
            throw new Error('No pudimos subir la foto. Inténtalo de nuevo.');
          }
          const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
          const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
          const response = await updateAvatar(token, publicUrl);
          persist({ ...response.user, avatarUrl: publicUrl });
          // La foto anterior pudo tener otra extensión: la borramos ya con la nueva guardada.
          await removeStoredPhotos(userId, filePath).catch(() => undefined);
          return 'Foto actualizada.';
        })
      }
      onRemovePhoto={() =>
        run(async () => {
          const response = await removeAvatar(requireToken());
          persist({ ...response.user, avatarUrl: null });
          const userId = getStoredUser()?.id;
          if (userId) {
            // Si falla, la foto ya no se muestra; solo queda el archivo.
            await removeStoredPhotos(userId).catch(() => undefined);
          }
          return 'Foto quitada.';
        })
      }
    />
  );
}

const TASK_STATUS_BY_COLUMN: Record<BoardColumnId, Task['status']> = {
  todo: 'TODO',
  progress: 'IN_PROGRESS',
  done: 'DONE',
};

const BUG_STATUS_BY_COLUMN: Record<BoardColumnId, Bug['status']> = {
  todo: 'OPEN',
  progress: 'IN_PROGRESS',
  done: 'RESOLVED',
};

function boardColumnOf(status: string): BoardColumnId {
  if (status === 'IN_PROGRESS') {
    return 'progress';
  }
  if (status === 'DONE' || status === 'RESOLVED' || status === 'CLOSED') {
    return 'done';
  }
  return 'todo';
}

// Dónde queda un ticket nuevo, en los términos de la API.
function destinationToApi(destination: Destination): 'GENERAL_BACKLOG' | 'NEXT_SPRINT' | 'SPRINT_BOARD' {
  if (destination === 'sprint') {
    return 'SPRINT_BOARD';
  }
  return destination === 'next' ? 'NEXT_SPRINT' : 'GENERAL_BACKLOG';
}

function ProjectDetailView() {
  const accessToken = localStorage.getItem('qualio_access_token');
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  // La pestaña vive en la dirección (?tab=tablero) para poder recargar o compartir el enlace.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: ProjectWorkspaceTab = workspaceTabs.some((tab) => tab.id === tabParam)
    ? (tabParam as ProjectWorkspaceTab)
    : 'backlog';
  const setActiveTab = (tab: ProjectWorkspaceTab) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (tab === 'backlog') {
          next.delete('tab');
        } else {
          next.set('tab', tab);
        }
        return next;
      },
      { replace: true },
    );
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>(initialBacklogItems);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<BacklogSection | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [backlogDropFlashItemId, setBacklogDropFlashItemId] = useState<string | null>(null);
  const [createWorkItemType, setCreateWorkItemType] = useState<CreateWorkItemType>(null);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [selectedWorkItem, setSelectedWorkItem] = useState<SelectedWorkItem>(null);
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState>(null);

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesión activa o proyecto inválido.');
      }

      return getProject(accessToken, projectId);
    },
    retry: false,
  });

  const tasksQuery = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesión activa o proyecto inválido.');
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
        throw new Error('No hay sesión activa o proyecto inválido.');
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
        throw new Error('No hay sesión activa o proyecto inválido.');
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
        throw new Error('No hay sesión activa o proyecto inválido.');
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
        throw new Error('No hay sesión activa o proyecto inválido.');
      }

      return listProjectPendingInvitations(accessToken, projectId);
    },
    // Solo el dueño puede ver (y gestionar) las invitaciones del proyecto.
    enabled: Boolean(accessToken && projectId && projectQuery.data && projectQuery.data.ownerId === getStoredUser()?.id),
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

  const commentsQuery = useQuery({
    queryKey: ['comments', selectedWorkItem?.type, selectedWorkItem?.id],
    queryFn: () => {
      if (!accessToken || !selectedWorkItem) {
        throw new Error('No hay elemento seleccionado.');
      }

      return listComments(accessToken, selectedWorkItem.type === 'task' ? 'TASK' : 'BUG', selectedWorkItem.id);
    },
    enabled: Boolean(accessToken && selectedWorkItem),
    retry: false,
  });

  const addMemberMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesión activa o proyecto inválido.');
      }

      // Todas las personas invitadas entran como miembros: el rol no cambia permisos hoy.
      return createInvitation(accessToken, projectId, { email, role: 'MEMBER' });
    },
    onSuccess: (_result, email) => {
      queryClient.invalidateQueries({ queryKey: ['project-pending-invitations', projectId] });
      setToast({ message: `Invitación enviada a ${email}.`, type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesión activa o proyecto inválido.');
      }

      return removeProjectMember(accessToken, projectId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setToast({ message: 'Participante quitado del proyecto.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesión activa o proyecto inválido.');
      }

      return cancelProjectInvitation(accessToken, projectId, invitationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-pending-invitations', projectId] });
      queryClient.invalidateQueries({ queryKey: ['invitation-notifications', accessToken] });
      setToast({ message: 'Invitación cancelada.', type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ values, files, destination }: { values: NewTaskValues; files: File[]; destination: Destination }) => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesión activa o proyecto inválido.');
      }

      const created = await createTask(accessToken, projectId, {
        title: values.title,
        description: values.description || undefined,
        priority: values.priority,
        section: destinationToApi(destination),
        sprintId: destination === 'sprint' ? activeSprintQuery.data?.id : undefined,
        assignedTo: values.assignedTo || undefined,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
      });

      await uploadAttachments('TASK', created.id, files);
      return created;
    },
    onSuccess: (created, { destination }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setActiveTab(destination === 'sprint' ? 'board' : 'backlog');
      setCreateWorkItemType(null);
      setToast({ message: `${created.itemKey ?? 'La tarea'} se creó en ${DESTINATION_LABEL[destination]}.`, type: 'success' });
    },
    onError: (error) => {
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const createBugMutation = useMutation({
    mutationFn: async ({ values, files, destination }: { values: NewBugValues; files: File[]; destination: Destination }) => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesión activa o proyecto inválido.');
      }

      const created = await createBug(accessToken, projectId, {
        title: values.title,
        description: values.description,
        priority: values.priority,
        section: destinationToApi(destination),
        environment: values.environment || undefined,
        expectedResult: values.expectedResult || undefined,
        actualResult: values.actualResult || undefined,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
      });

      await uploadAttachments('BUG', created.id, files);
      return created;
    },
    onSuccess: (created, { destination }) => {
      queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      setActiveTab(destination === 'sprint' ? 'board' : 'backlog');
      setCreateWorkItemType(null);
      setToast({ message: `${created.itemKey ?? 'El bug'} se reportó en ${DESTINATION_LABEL[destination]}.`, type: 'success' });
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

  // Un movimiento del backlog solo se anuncia como hecho cuando el servidor lo confirma; si falla,
  // se restaura la lista anterior y se avisa, para que el usuario no crea que se movió.
  type BacklogMovePayload = {
    id: string;
    section: BacklogSection;
    targetPosition: number;
    displayKey: string;
    announce: boolean;
  };
  type BacklogMoveContext = { previous?: Task[] | Bug[] };

  const sectionLabel = (section: BacklogSection) => (section === 'nextSprint' ? 'Próximo Sprint' : 'Backlog general');

  const onBacklogMoveSuccess = (payload: BacklogMovePayload) => {
    if (payload.announce) {
      setToast({ message: `${payload.displayKey} se movió a ${sectionLabel(payload.section)}.`, type: 'success' });
    }
  };

  const onBacklogMoveError = (key: 'tasks' | 'bugs', error: unknown, payload: BacklogMovePayload, context?: BacklogMoveContext) => {
    if (context?.previous) {
      queryClient.setQueryData([key, projectId], context.previous);
    }
    setToast({
      message: `No pudimos mover ${payload.displayKey}; volvió a su lugar. ${getApiErrorMessage(error)}`,
      type: 'error',
    });
  };

  const moveTaskMutation = useMutation({
    // Mismo ámbito para tareas y bugs: los movimientos se envían en fila, en el orden en que
    // se hicieron. Si viajan a la vez, el servidor puede aplicarlos al revés.
    scope: { id: `backlog-move-${projectId}` },
    mutationFn: async (payload: BacklogMovePayload) => {
      if (!accessToken) {
        throw new Error('No hay sesión activa.');
      }

      return moveTask(accessToken, payload.id, {
        section: toApiSection(payload.section),
        targetPosition: payload.targetPosition,
      });
    },
    // Actualización optimista: cancelamos recargas en curso para que una respuesta vieja
    // (de un movimiento anterior) no pise este cambio mientras llega la confirmación.
    onMutate: async (payload): Promise<BacklogMoveContext> => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      queryClient.setQueryData<Task[]>(['tasks', projectId], (current) =>
        current?.map((item) =>
          item.id === payload.id
            ? { ...item, section: toApiSection(payload.section), position: payload.targetPosition - 0.5 }
            : item,
        ),
      );
      return { previous };
    },
    onSuccess: (_result, payload) => onBacklogMoveSuccess(payload),
    onError: (error, payload, context) => onBacklogMoveError('tasks', error, payload, context),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const moveBugMutation = useMutation({
    // Mismo ámbito para tareas y bugs: los movimientos se envían en fila, en el orden en que
    // se hicieron. Si viajan a la vez, el servidor puede aplicarlos al revés.
    scope: { id: `backlog-move-${projectId}` },
    mutationFn: async (payload: BacklogMovePayload) => {
      if (!accessToken) {
        throw new Error('No hay sesión activa.');
      }

      return moveBug(accessToken, payload.id, {
        section: toApiSection(payload.section),
        targetPosition: payload.targetPosition,
      });
    },
    // Actualización optimista: cancelamos recargas en curso para que una respuesta vieja
    // (de un movimiento anterior) no pise este cambio mientras llega la confirmación.
    onMutate: async (payload): Promise<BacklogMoveContext> => {
      await queryClient.cancelQueries({ queryKey: ['bugs', projectId] });
      const previous = queryClient.getQueryData<Bug[]>(['bugs', projectId]);
      queryClient.setQueryData<Bug[]>(['bugs', projectId], (current) =>
        current?.map((item) =>
          item.id === payload.id
            ? { ...item, section: toApiSection(payload.section), position: payload.targetPosition - 0.5 }
            : item,
        ),
      );
      return { previous };
    },
    onSuccess: (_result, payload) => onBacklogMoveSuccess(payload),
    onError: (error, payload, context) => onBacklogMoveError('bugs', error, payload, context),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
    },
  });

  const startSprintMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !projectId) {
        throw new Error('No hay sesión activa o proyecto inválido.');
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
    mutationFn: async (payload: { taskId: string; displayKey: string; sendToCurrentSprint: boolean }) => {
      if (!accessToken) {
        throw new Error('No hay sesión activa.');
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
    // Actualización inmediata: reabrir hace dos llamadas y tarda; la fila sale de Completado
    // al confirmar, y si algo falla se restaura.
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      queryClient.setQueryData<Task[]>(['tasks', projectId], (current) =>
        current?.map((item) =>
          item.id === payload.taskId
            ? {
                ...item,
                status: 'TODO',
                section: payload.sendToCurrentSprint ? 'SPRINT_BOARD' : 'GENERAL_BACKLOG',
                completedInSprintId: null,
              }
            : item,
        ),
      );
      return { previous };
    },
    onSuccess: (_result, payload) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setToast({
        message: payload.sendToCurrentSprint
          ? `${payload.displayKey} volvió al tablero del sprint en curso.`
          : `${payload.displayKey} volvió al backlog general.`,
        type: 'success',
      });
    },
    onError: (error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks', projectId], context.previous);
      }
      setToast({ message: getApiErrorMessage(error), type: 'error' });
    },
  });

  const reopenBugMutation = useMutation({
    mutationFn: async (payload: { bugId: string; displayKey: string; sendToCurrentSprint: boolean }) => {
      if (!accessToken) {
        throw new Error('No hay sesión activa.');
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
    // Actualización inmediata: reabrir hace dos llamadas y tarda; la fila sale de Completado
    // al confirmar, y si algo falla se restaura.
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['bugs', projectId] });
      const previous = queryClient.getQueryData<Bug[]>(['bugs', projectId]);
      queryClient.setQueryData<Bug[]>(['bugs', projectId], (current) =>
        current?.map((item) =>
          item.id === payload.bugId
            ? {
                ...item,
                status: 'OPEN',
                section: payload.sendToCurrentSprint ? 'SPRINT_BOARD' : 'GENERAL_BACKLOG',
                completedInSprintId: null,
              }
            : item,
        ),
      );
      return { previous };
    },
    onSuccess: (_result, payload) => {
      queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      setToast({
        message: payload.sendToCurrentSprint
          ? `${payload.displayKey} volvió al tablero del sprint en curso.`
          : `${payload.displayKey} volvió al backlog general.`,
        type: 'success',
      });
    },
    onError: (error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['bugs', projectId], context.previous);
      }
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
        throw new Error('No hay sesión activa.');
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
      dueDate: string | null;
      changeNote: string;
    }) => {
      if (!accessToken) {
        throw new Error('No hay sesión activa.');
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
        dueDate: payload.dueDate,
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
    // En fila, igual que el backlog: varios cambios rápidos llegan al servidor en orden.
    scope: { id: `board-status-${projectId}` },
    mutationFn: async (payload: {
      itemType: 'task' | 'bug';
      entityId: string;
      displayKey: string;
      targetColumn: BoardColumnId;
    }) => {
      if (!accessToken) {
        throw new Error('No hay sesión activa.');
      }

      if (payload.itemType === 'task') {
        await updateTask(accessToken, payload.entityId, {
          section: 'SPRINT_BOARD',
          status: TASK_STATUS_BY_COLUMN[payload.targetColumn],
          changeNote: 'Cambio de estado desde tablero.',
        });
        return;
      }

      await updateBug(accessToken, payload.entityId, {
        section: 'SPRINT_BOARD',
        status: BUG_STATUS_BY_COLUMN[payload.targetColumn],
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
                  status: TASK_STATUS_BY_COLUMN[payload.targetColumn],
                  completedInSprintId: payload.targetColumn === 'done' ? task.sprintId : null,
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
                  status: BUG_STATUS_BY_COLUMN[payload.targetColumn],
                  completedInSprintId: payload.targetColumn === 'done' ? bug.sprintId : null,
                }
              : bug,
          ),
        );
      }

      return { previousTasks, previousBugs };
    },
    onSuccess: (_result, payload) => {
      setToast({
        message:
          payload.targetColumn === 'done'
            ? `${payload.displayKey} quedó como hecho.`
            : `${payload.displayKey} pasó a ${payload.targetColumn === 'todo' ? 'Por hacer' : 'En progreso'}.`,
        type: 'success',
      });
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

  // isPending (no isLoading): en React Query v5 una consulta pausada o en espera no está
  // "cargando" pero tampoco tiene datos, y antes eso se mostraba como error.
  if (projectQuery.isError) {
    return (
      <div className="q-empty">
        <h2 className="q-empty__title">No pudimos abrir este proyecto</h2>
        <p className="q-empty__text">{getApiErrorMessage(projectQuery.error)}</p>
        <div className="q-empty__action">
          <Button variant="primary" onClick={() => void projectQuery.refetch()} loading={projectQuery.isFetching}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (projectQuery.isPending) {
    return <p className="list-state">Cargando el proyecto…</p>;
  }

  const memberById = new Map((membersQuery.data ?? []).map((member) => [member.userId, member]));
  const selectedTask = selectedWorkItem?.type === 'task'
    ? (tasksQuery.data ?? []).find((task) => task.id === selectedWorkItem.id) ?? null
    : null;
  const selectedBug = selectedWorkItem?.type === 'bug'
    ? (bugsQuery.data ?? []).find((bug) => bug.id === selectedWorkItem.id) ?? null
    : null;
  const nextSprintTotal = backlogItems.filter((item) => item.section === 'nextSprint').length;
  // La API responde con cuerpo vacío cuando no hay sprint activo.
  const activeSprint = activeSprintQuery.data || null;
  const isOwner = getStoredUser()?.id === projectQuery.data.ownerId;
  const sprintProgress = computeProgress(tasksQuery.data, bugsQuery.data, activeSprint);
  // Lo terminado solo cuenta si pertenece al sprint activo; lo de sprints cerrados va a Completado.
  const inActiveSprint = (item: {
    section: string;
    status: string;
    sprintId: string | null;
    completedInSprintId: string | null;
  }) =>
    item.section === 'SPRINT_BOARD' &&
    (boardColumnOf(item.status) !== 'done' ||
      (activeSprint !== null && (item.sprintId === activeSprint.id || item.completedInSprintId === activeSprint.id)));
  const boardCards: BoardCard[] = [
    ...(tasksQuery.data ?? []).filter(inActiveSprint).map((task) => ({
      id: `task-${task.id}`,
      entityId: task.id,
      itemType: 'task' as const,
      displayKey: task.itemKey ?? `TASK-${task.id.slice(0, 6).toUpperCase()}`,
      title: task.title,
      priority: task.priority,
      column: boardColumnOf(task.status),
      assigneeUserId: task.assignedTo,
      dueDate: task.dueDate,
      environment: null,
      rolloverFrom: task.rolloverFromSprintName,
    })),
    ...(bugsQuery.data ?? []).filter(inActiveSprint).map((bug) => ({
      id: `bug-${bug.id}`,
      entityId: bug.id,
      itemType: 'bug' as const,
      displayKey: bug.itemKey ?? `BUG-${bug.id.slice(0, 6).toUpperCase()}`,
      title: bug.title,
      priority: bug.priority,
      column: boardColumnOf(bug.status),
      assigneeUserId: null,
      dueDate: bug.dueDate,
      environment: bug.environment,
      rolloverFrom: bug.rolloverFromSprintName,
    })),
  ];
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
  const doneItems: DoneItem[] = [
    ...(tasksQuery.data ?? [])
      .filter((task) => task.status === 'DONE' && task.completedInSprintId)
      .map((task) => ({
        id: `task-${task.id}`,
        entityId: task.id,
        itemType: 'task' as const,
        displayKey: task.itemKey ?? `TASK-${task.id.slice(0, 6).toUpperCase()}`,
        title: task.title,
        priority: task.priority,
        sprintId: task.completedInSprintId as string,
        sprintName: task.completedInSprintName ?? 'Sprint',
        sprintSequence: task.completedInSprintSequence ?? 0,
        completedAt: task.updatedAt,
      })),
    ...(bugsQuery.data ?? [])
      .filter((bug) => (bug.status === 'RESOLVED' || bug.status === 'CLOSED') && bug.completedInSprintId)
      .map((bug) => ({
        id: `bug-${bug.id}`,
        entityId: bug.id,
        itemType: 'bug' as const,
        displayKey: bug.itemKey ?? `BUG-${bug.id.slice(0, 6).toUpperCase()}`,
        title: bug.title,
        priority: bug.priority,
        sprintId: bug.completedInSprintId as string,
        sprintName: bug.completedInSprintName ?? 'Sprint',
        sprintSequence: bug.completedInSprintSequence ?? 0,
        completedAt: bug.updatedAt,
      })),
  ];

  const persistMove = (item: BacklogItem, section: BacklogSection, targetPosition: number, announce = false) => {
    const payload = { id: item.entityId, section, targetPosition, displayKey: item.displayKey, announce };
    if (item.itemType === 'task') {
      moveTaskMutation.mutate(payload);
      return;
    }

    moveBugMutation.mutate(payload);
  };

  const composeBacklog = (nextSprint: BacklogItem[], general: BacklogItem[]): BacklogItem[] => {
    const withNextPositions = nextSprint.map((item, index) => ({ ...item, section: 'nextSprint' as const, position: index }));
    const withGeneralPositions = general.map((item, index) => ({ ...item, section: 'general' as const, position: index }));
    return [...withNextPositions, ...withGeneralPositions];
  };

  const moveToSection = (item: PlanItem, targetSection: BacklogSectionId) => {
    const source = backlogItems.find((candidate) => candidate.id === item.id);
    if (!source || source.section === targetSection) {
      return;
    }

    const nextSprint = backlogItems.filter((candidate) => candidate.section === 'nextSprint' && candidate.id !== item.id);
    const general = backlogItems.filter((candidate) => candidate.section === 'general' && candidate.id !== item.id);
    const target = targetSection === 'nextSprint' ? nextSprint : general;
    target.push({ ...source, section: targetSection });
    setBacklogItems(composeBacklog(nextSprint, general));
    persistMove(source, targetSection, target.length - 1, true);
    setBacklogDropFlashItemId(source.id);
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
    <section className="project-workspace-view qx-view">
      <ProjectHeader
        project={projectQuery.data}
        isOwner={isOwner}
        members={membersQuery.data ?? []}
        onCreate={(type) => setCreateWorkItemType(type)}
        onOpenMembers={() => setMembersModalOpen(true)}
      />

      <SprintBar
        sprint={activeSprint}
        progress={sprintProgress}
        nextSprintCount={nextSprintTotal}
        unfinishedCount={boardItems.length}
        isOwner={isOwner}
        starting={startSprintMutation.isPending}
        onStart={() => startSprintMutation.mutate()}
      />

      <ProjectTabs
        active={activeTab as ProjectTabId}
        counts={{
          backlog: backlogItems.length,
          board: boardItems.length,
          done: doneItems.length,
        }}
        onChange={(tab) => setActiveTab(tab)}
      />

      <section className="project-tab-panel is-plain" role="tabpanel" id="project-tab-panel" aria-labelledby={`project-tab-${activeTab}`}>
        {activeTab === 'backlog' ? (
          <BacklogPanel
            items={backlogItems}
            memberById={memberById}
            onOpen={(item) => setSelectedWorkItem({ type: item.itemType, id: item.entityId })}
            onMove={moveToSection}
            emptyProject={
              tasksQuery.isSuccess && bugsQuery.isSuccess && tasksQuery.data.length === 0 && bugsQuery.data.length === 0
                ? { onCreateTask: () => setCreateWorkItemType('task'), onCreateBug: () => setCreateWorkItemType('bug') }
                : undefined
            }
            drag={{
              draggedId: draggedItemId,
              overSection: dragOverSection,
              overItemId: dragOverItemId,
              flashId: backlogDropFlashItemId,
              onDragStart: (itemId) => setDraggedItemId(itemId),
              onDragEnd: () => {
                setDraggedItemId(null);
                setDragOverSection(null);
                setDragOverItemId(null);
              },
              onDragOverSection: (section) => setDragOverSection(section),
              onDragOverItem: (section, itemId) => {
                setDragOverSection(section);
                setDragOverItemId(itemId);
              },
              onDragLeaveSection: (section) => {
                setDragOverSection((current) => (current === section ? null : current));
                setDragOverItemId(null);
              },
              onDropSection: (section) => handleDropInto(section),
              onDropItem: (section, itemId) => handleDropOnItem(section, itemId),
            }}
          />
        ) : null}

        {activeTab === 'board' ? (
          <BoardPanel
            hasSprint={Boolean(activeSprint)}
            cards={boardCards}
            memberById={memberById}
            currentUserId={getStoredUser()?.id ?? null}
            onOpen={(card) => setSelectedWorkItem({ type: card.itemType, id: card.entityId })}
            onMove={(card, column) =>
              boardStatusMutation.mutate({
                itemType: card.itemType,
                entityId: card.entityId,
                displayKey: card.displayKey,
                targetColumn: column,
              })
            }
            onGoToBacklog={() => setActiveTab('backlog')}
          />
        ) : null}

        {activeTab === 'done' ? (
          <DonePanel
            items={doneItems}
            activeSprint={activeSprint ? { id: activeSprint.id, name: activeSprint.name } : null}
            reopening={reopenTaskMutation.isPending || reopenBugMutation.isPending}
            onOpen={(item) => setSelectedWorkItem({ type: item.itemType, id: item.entityId })}
            onReopen={(item, destination) => {
              const sendToCurrentSprint = destination === 'sprint';
              if (item.itemType === 'task') {
                reopenTaskMutation.mutate({ taskId: item.entityId, displayKey: item.displayKey, sendToCurrentSprint });
                return;
              }
              reopenBugMutation.mutate({ bugId: item.entityId, displayKey: item.displayKey, sendToCurrentSprint });
            }}
          />
        ) : null}

        {activeTab === 'reports' ? (
          <ReportsPanel accessToken={accessToken ?? ''} projectId={projectId ?? ''} />
        ) : null}
      </section>

      {createWorkItemType === 'task' ? (
        <CreateTicketModal
          type="task"
          members={membersQuery.data ?? []}
          activeSprintName={activeSprint?.name ?? null}
          submitting={createTaskMutation.isPending}
          onClose={() => setCreateWorkItemType(null)}
          onSubmit={(values, files, destination) => createTaskMutation.mutate({ values, files, destination })}
        />
      ) : null}

      {createWorkItemType === 'bug' ? (
        <CreateTicketModal
          type="bug"
          members={membersQuery.data ?? []}
          activeSprintName={activeSprint?.name ?? null}
          submitting={createBugMutation.isPending}
          onClose={() => setCreateWorkItemType(null)}
          onSubmit={(values, files, destination) => createBugMutation.mutate({ values, files, destination })}
        />
      ) : null}

      {membersModalOpen ? (
        <MembersModal
          projectName={projectQuery.data.name}
          members={membersQuery.data ?? []}
          pendingInvitations={pendingInvitationsQuery.data ?? []}
          loadingPending={pendingInvitationsQuery.isPending}
          isOwner={isOwner}
          currentUserId={getStoredUser()?.id ?? null}
          inviting={addMemberMutation.isPending}
          removingUserId={removeMemberMutation.isPending ? (removeMemberMutation.variables ?? null) : null}
          cancellingInvitationId={cancelInvitationMutation.isPending ? (cancelInvitationMutation.variables ?? null) : null}
          onClose={() => setMembersModalOpen(false)}
          onInvite={(email) => addMemberMutation.mutateAsync(email).then(() => undefined)}
          onRemove={(userId) => removeMemberMutation.mutate(userId)}
          onCancelInvitation={(invitationId) => cancelInvitationMutation.mutate(invitationId)}
        />
      ) : null}

      {selectedWorkItem && (selectedTask || selectedBug) ? (
        <TicketDetailModal
          item={
            selectedTask
              ? { type: 'task', data: selectedTask }
              : { type: 'bug', data: selectedBug as Bug }
          }
          members={membersQuery.data ?? []}
          activeSprintName={activeSprint?.name ?? null}
          attachments={attachmentsQuery.data ?? []}
          attachmentPreviewUrls={attachmentPreviewUrls}
          loadingAttachments={attachmentsQuery.isLoading}
          history={historyQuery.data ?? []}
          loadingHistory={historyQuery.isLoading}
          comments={commentsQuery.data ?? []}
          loadingComments={commentsQuery.isLoading}
          onAddComment={async (body) => {
            if (!accessToken || !selectedWorkItem) {
              return;
            }
            try {
              await createComment(accessToken, selectedWorkItem.type === 'task' ? 'TASK' : 'BUG', selectedWorkItem.id, body);
              await queryClient.invalidateQueries({ queryKey: ['comments', selectedWorkItem.type, selectedWorkItem.id] });
            } catch (error) {
              setToast({ message: getApiErrorMessage(error), type: 'error' });
              throw error;
            }
          }}
          saving={updateTaskMutation.isPending || updateBugMutation.isPending}
          onSave={(payload) => {
            if (payload.type === 'task') {
              return updateTaskMutation.mutateAsync(payload).then(() => undefined);
            }

            return updateBugMutation.mutateAsync(payload).then(() => undefined);
          }}
          onAddAttachments={async (files) => {
            if (!selectedWorkItem) {
              return;
            }
            try {
              await uploadAttachments(selectedWorkItem.type === 'task' ? 'TASK' : 'BUG', selectedWorkItem.id, files);
              await queryClient.invalidateQueries({ queryKey: ['attachments', selectedWorkItem.type, selectedWorkItem.id] });
              setToast({ message: files.length === 1 ? 'Archivo agregado.' : `${files.length} archivos agregados.`, type: 'success' });
            } catch (error) {
              setToast({ message: getApiErrorMessage(error), type: 'error' });
            }
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
    dueDate: task.dueDate,
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
    dueDate: bug.dueDate,
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

// Selector de tema compartido entre el inicio de sesión y la barra superior de la app.
function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-sky${isDark ? ' is-night' : ''}`}
      onClick={onToggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      <span className="theme-sky-cloud" aria-hidden="true" />
      <span className="theme-sky-star" aria-hidden="true" />
      <span className="theme-sky-star" aria-hidden="true" />
      <span className="theme-sky-star" aria-hidden="true" />
      <span className="theme-sky-orb" aria-hidden="true" />
    </button>
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

