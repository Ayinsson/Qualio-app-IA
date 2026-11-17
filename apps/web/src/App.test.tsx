import { render, screen } from '@testing-library/react';

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
});
