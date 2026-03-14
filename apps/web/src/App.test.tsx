import { render, screen } from '@testing-library/react';

import { App } from './App';

describe('App', () => {
  it('renders project bootstrap message', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Qualio' })).toBeInTheDocument();
    expect(screen.getByText(/MVP v0.1/i)).toBeInTheDocument();
  });
});
