import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { App } from './App';

describe('App', () => {
  it('renders auth header branding', () => {
    render(<App />);

    // Hay una versión del logo por tema; el CSS muestra solo la que corresponde.
    const logos = screen.getAllByRole('img', { name: 'Qualio' });
    expect(logos.map((logo) => logo.className)).toEqual(['auth-logo auth-logo--light', 'auth-logo auth-logo--dark']);
    expect(screen.getByRole('img', { name: 'Tu aliado de QA' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Iniciar sesión' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lets both register passwords be revealed and marks failed rules only in the checklist', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));

    const toggles = screen.getAllByRole('button', { name: 'Mostrar las contraseñas' });
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[1]);
    expect(screen.getByLabelText('Repite la contraseña')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');

    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ana Pérez' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@empresa.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'corta' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'otra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    const rules = screen.getByRole('list');
    await waitFor(() => expect(within(rules).getAllByText('Falta:')).toHaveLength(2));
    // El motivo ya no se repite bajo los campos de contraseña.
    expect(screen.queryByText('Usa al menos 8 caracteres')).not.toBeInTheDocument();
    expect(screen.queryByText('Las contraseñas no coinciden')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true');
  });
});
