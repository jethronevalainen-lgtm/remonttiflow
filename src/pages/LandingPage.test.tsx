import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('presents the current product scope and provides visible login paths', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Johda remontti yhdestä paikasta – tarjouksesta luovutukseen.',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /kirjaudu/i }).length).toBeGreaterThan(0);
    expect(screen.getByText('Tarjoukset ja määrälaskenta')).toBeInTheDocument();
    expect(screen.getByText('Projektit ja työkokonaisuudet')).toBeInTheDocument();
    expect(screen.getByText('Työaika, matkat ja palkka-aineisto')).toBeInTheDocument();
    expect(screen.getByText('Tilaajayhteistyö ja viestintä')).toBeInTheDocument();
    expect(screen.getByText('Projektikoordinaattori')).toBeInTheDocument();
    expect(screen.getByText('Ei tuotantodataa')).toBeInTheDocument();
    expect(screen.getByText(/julkista itsepalvelurekisteröitymistä ei ole/i)).toBeInTheDocument();
  });
});
