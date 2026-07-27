import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('presents the product and provides visible login paths', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Työmaa, työnjohto ja hallinto yhdessä järjestelmässä.',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /kirjaudu sisään/i }).length).toBeGreaterThan(0);
    expect(screen.getByText('Projektit ja työvaiheet')).toBeInTheDocument();
    expect(screen.getByText('Työaika ja matkakulut')).toBeInTheDocument();
  });
});
