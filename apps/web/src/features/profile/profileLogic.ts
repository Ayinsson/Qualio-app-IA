export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
export const AVATAR_MAX_MB = 5;
export const PASSWORD_MIN = 8;

export function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Escribe tu nombre.';
  }
  if (trimmed.length < 2) {
    return 'Usa al menos 2 caracteres.';
  }
  if (trimmed.length > 80) {
    return 'Usa como máximo 80 caracteres.';
  }
  return undefined;
}

export function validateAvatar(file: Pick<File, 'type' | 'size'>): string | undefined {
  if (!AVATAR_TYPES.includes(file.type)) {
    return 'Esa imagen no sirve. Usa JPG, PNG o GIF.';
  }
  if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
    return `La imagen pesa más de ${AVATAR_MAX_MB} MB. Prueba con una más liviana.`;
  }
  return undefined;
}

export type PasswordValues = { current: string; next: string; confirm: string };
export type PasswordErrors = Partial<Record<keyof PasswordValues, string>>;

export function validatePassword(values: PasswordValues): PasswordErrors {
  const errors: PasswordErrors = {};
  if (!values.current) {
    errors.current = 'Escribe tu contraseña actual.';
  }
  if (values.next.length < PASSWORD_MIN) {
    errors.next = `La nueva necesita al menos ${PASSWORD_MIN} caracteres.`;
  } else if (values.next === values.current) {
    errors.next = 'La nueva debe ser distinta de la actual.';
  }
  if (!errors.next && values.confirm !== values.next) {
    errors.confirm = 'No coincide con la nueva contraseña.';
  }
  return errors;
}

/** Pista bajo el campo de la nueva contraseña, y cuánto se llena la barrita (0–100). */
export function passwordProgress(value: string): { percent: number; hint: string } {
  if (!value) {
    return { percent: 0, hint: `Mínimo ${PASSWORD_MIN} caracteres.` };
  }
  if (value.length < PASSWORD_MIN) {
    const left = PASSWORD_MIN - value.length;
    return {
      percent: Math.round((value.length / PASSWORD_MIN) * 100),
      hint: `Te ${left === 1 ? 'falta 1 carácter' : `faltan ${left} caracteres`}.`,
    };
  }
  return { percent: 100, hint: 'Largo suficiente.' };
}
