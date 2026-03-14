import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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

export function App() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [feedback, setFeedback] = useState('');
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

  const onLoginSubmit = (values: LoginValues) => {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setLoginErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      setFeedback('');
      return;
    }

    setLoginErrors({});
    setFeedback(`Login valido para ${values.email} (demo local).`);
  };

  const onRegisterSubmit = (values: RegisterValues) => {
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setRegisterErrors({
        fullName: fieldErrors.fullName?.[0],
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      });
      setFeedback('');
      return;
    }

    setRegisterErrors({});
    setFeedback(`Registro valido para ${values.fullName} (demo local).`);
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <header className="auth-header">
          <h1>Qualio</h1>
          <p>Arranque rapido de autenticacion para tu MVP v0.1.</p>
        </header>

        <div className="auth-toggle" role="tablist" aria-label="Cambiar formulario">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              setFeedback('');
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register');
              setFeedback('');
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

            <button type="submit">Iniciar sesion</button>
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

            <button type="submit">Crear cuenta</button>
          </form>
        )}

        {feedback ? <p className="feedback">{feedback}</p> : null}
      </section>
    </main>
  );
}
