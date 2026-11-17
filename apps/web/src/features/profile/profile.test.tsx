import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { ProfileModal } from './ProfileModal';
import { passwordProgress, validateAvatar, validateName, validatePassword } from './profileLogic';

describe('profileLogic', () => {
  it('checks the visible name', () => {
    expect(validateName('  ')).toBe('Escribe tu nombre.');
    expect(validateName('A')).toBe('Usa al menos 2 caracteres.');
    expect(validateName('Ana')).toBeUndefined();
  });

  it('rejects photos of the wrong type or too heavy', () => {
    expect(validateAvatar({ type: 'image/webp', size: 10 })).toMatch(/JPG, PNG o GIF/);
    expect(validateAvatar({ type: 'image/png', size: 6 * 1024 * 1024 })).toMatch(/más de 5 MB/);
    expect(validateAvatar({ type: 'image/png', size: 1024 })).toBeUndefined();
  });

  it('validates a password change and tells how much is left', () => {
    expect(validatePassword({ current: '', next: 'corta', confirm: '' })).toEqual({
      current: 'Escribe tu contraseña actual.',
      next: 'La nueva necesita al menos 8 caracteres.',
    });
    expect(validatePassword({ current: 'vieja-123', next: 'vieja-123', confirm: 'vieja-123' }).next).toBe(
      'La nueva debe ser distinta de la actual.',
    );
    expect(validatePassword({ current: 'vieja-123', next: 'nueva-456', confirm: 'nueva-45' }).confirm).toBe(
      'No coincide con la nueva contraseña.',
    );
    expect(passwordProgress('abcdef').hint).toBe('Te faltan 2 caracteres.');
    expect(passwordProgress('abcdefg').hint).toBe('Te falta 1 carácter.');
    expect(passwordProgress('abcdefgh').percent).toBe(100);
  });
});

function renderProfile(avatarUrl: string | null = null) {
  const props = {
    user: { name: 'Ayinsson Solano', email: 'a@b.com', avatarUrl },
    onSaveName: vi.fn().mockResolvedValue(undefined),
    onChangePassword: vi.fn().mockResolvedValue(undefined),
    onUploadPhoto: vi.fn().mockResolvedValue(undefined),
    onRemovePhoto: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
  };
  render(<ProfileModal {...props} />);
  return props;
}

describe('ProfileModal', () => {
  it('only offers to save when the name changed', async () => {
    const props = renderProfile();
    expect(screen.getByRole('button', { name: 'Sin cambios' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Nombre visible'), { target: { value: '  Ayinsson S.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(props.onSaveName).toHaveBeenCalledWith('Ayinsson S.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sin cambios' })).toBeInTheDocument());
  });

  it('keeps the password form folded until asked, and clears it after saving', async () => {
    const props = renderProfile();
    expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    expect(screen.getByText('Escribe tu contraseña actual.')).toBeInTheDocument();
    expect(props.onChangePassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'vieja-123' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'nueva-456' } });
    fireEvent.change(screen.getByLabelText('Repite la nueva'), { target: { value: 'nueva-456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    expect(props.onChangePassword).toHaveBeenCalledWith('vieja-123', 'nueva-456');
    await waitFor(() => expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument());
  });

  it('asks before closing with unsaved changes', () => {
    const props = renderProfile();
    fireEvent.change(screen.getByLabelText('Nombre visible'), { target: { value: 'Otro nombre' } });
    const closeButtons = screen.getAllByRole('button', { name: 'Cerrar' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Tienes cambios sin guardar.');
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('uploads a valid photo, rejects a wrong one, and can remove it', async () => {
    const props = renderProfile('https://cdn/avatar.png');
    const input = screen.getByLabelText('Elegir foto de perfil');

    fireEvent.change(input, { target: { files: [new File(['x'], 'foto.webp', { type: 'image/webp' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Usa JPG, PNG o GIF');
    expect(props.onUploadPhoto).not.toHaveBeenCalled();

    const photo = new File(['x'], 'foto.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [photo] } });
    expect(props.onUploadPhoto).toHaveBeenCalledWith(photo);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Quitar' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(props.onRemovePhoto).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Quitar' })).toBeEnabled());
  });
});
