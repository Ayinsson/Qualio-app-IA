import { render, screen } from '@testing-library/react';

import { App } from './App';

describe('App', () => {
  it('renders auth header branding', () => {
    render(<App />);

    expect(screen.getByRole('img', { name: 'Qualio' })).toBeInTheDocument();
    expect(screen.getByText('Tu Qa aliado !')).toBeInTheDocument();
  });
});
