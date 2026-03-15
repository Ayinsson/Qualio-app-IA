import { AxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
} from 'react-router-dom';
import { z } from 'zod';

import { changePassword, getSessionUser, login, register, updateAvatar, updateProfile } from './lib/auth';
import { supabase } from './lib/supabase';

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
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [collabOpen, setCollabOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const accessToken = localStorage.getItem('qualio_access_token');
  const [storedUser, setStoredUser] = useState<StoredUser | null>(() => getStoredUser());

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

  useEffect(() => {
    if (location.pathname.startsWith('/app/proyectos')) {
      setProjectsOpen(true);
    }

    if (location.pathname.startsWith('/app/colaborar')) {
      setCollabOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
            <NavSubItem to="/app/proyectos/activos" label="Proyectos Activos" onNavigate={closeMenu} />
            <NavSubItem to="/app/proyectos/archivados" label="Proyectos Archivados" onNavigate={closeMenu} />
          </NavGroup>

          <NavPrimaryItem to="/app/casos-prueba" label="Casos de Prueba" onNavigate={closeMenu} />
          <NavPrimaryItem to="/app/ejecuciones" label="Ejecuciones" onNavigate={closeMenu} />
          <NavPrimaryItem to="/app/reportes" label="Reportes" onNavigate={closeMenu} />

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
            <input type="text" placeholder="¿Que estas buscando?" aria-label="Busqueda global" />
          </div>

          <div className="topbar-actions">
            <button type="button" className="icon-btn" aria-label="Notificaciones">
              <IconBell />
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
            <Route path="proyectos/activos" element={<SectionView title="Proyectos Activos" description="Aqui veras los proyectos en ejecucion y su estado general." />} />
            <Route path="proyectos/archivados" element={<SectionView title="Proyectos Archivados" description="Consulta historicos, resultados cerrados y referencias de QA." />} />
            <Route path="casos-prueba" element={<SectionView title="Casos de Prueba" description="Gestiona tus casos, escenarios y criterios de aceptacion." />} />
            <Route path="ejecuciones" element={<SectionView title="Ejecuciones" description="Monitorea ejecuciones recientes, bloqueos y resultados de corrida." />} />
            <Route path="reportes" element={<SectionView title="Reportes" description="Genera reportes visuales para seguimiento del estado de calidad." />} />
            <Route path="colaborar/compartidos" element={<SectionView title="Compartidos" description="Encuentra elementos compartidos contigo por otros equipos." />} />
            <Route path="colaborar/invitaciones" element={<SectionView title="Invitaciones" description="Administra invitaciones pendientes a proyectos y espacios." />} />
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </main>
      </div>

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

function NavPrimaryItem({ to, label, onNavigate }: { to: string; label: string; onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-primary-item ${isActive ? 'active' : ''}`}
      onClick={onNavigate}
    >
      {label}
    </NavLink>
  );
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
    const responseMessage = error.response?.data as { message?: string } | undefined;

    if (typeof responseMessage?.message === 'string') {
      return responseMessage.message;
    }

    return 'No fue posible completar la solicitud de autenticacion.';
  }

  return 'Ocurrio un error inesperado.';
}
