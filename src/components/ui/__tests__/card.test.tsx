import { render, screen } from '@testing-library/react';

import { Card, CardContent, CardFooter, CardTitle } from '@/components/ui/card';

describe('Card layout contract', () => {
  it('stretches inside grid rows and keeps its sections vertically structured', () => {
    render(
      <Card data-testid="card">
        <CardTitle data-testid="title">Pitkä otsikko saa rivittyä kokonaan</CardTitle>
        <CardContent data-testid="content">Sisältö</CardContent>
        <CardFooter data-testid="footer">Toiminnot</CardFooter>
      </Card>,
    );

    expect(screen.getByTestId('card')).toHaveClass('flex', 'h-full', 'min-w-0', 'flex-col');
    expect(screen.getByTestId('title')).toHaveClass('break-words');
    expect(screen.getByTestId('content')).toHaveClass('min-w-0', 'flex-1');
    expect(screen.getByTestId('footer')).toHaveClass('mt-auto', 'flex-wrap');
  });

  it('allows deliberately compact cards to opt out of full height', () => {
    render(<Card data-testid="compact-card" className="h-fit" />);

    expect(screen.getByTestId('compact-card')).toHaveClass('h-fit');
    expect(screen.getByTestId('compact-card')).not.toHaveClass('h-full');
  });
});
