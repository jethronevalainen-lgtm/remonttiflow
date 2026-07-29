import { render, screen } from '@testing-library/react';
import { FileText, ShieldCheck } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from '@/components/ui/empty-state';
import { StatusPanel } from '@/components/ui/status-panel';

describe('dashboard state components', () => {
  it('renders an intentional empty state with complete text and action', () => {
    render(
      <EmptyState
        icon={FileText}
        title="Ei vielä työselosteita"
        description="Kun työntekijät kirjaavat työselosteita, ne näkyvät tässä."
        action={<button type="button">Avaa tuntikirjaukset</button>}
      />,
    );

    expect(screen.getByText('Ei vielä työselosteita')).toBeInTheDocument();
    expect(screen.getByText('Kun työntekijät kirjaavat työselosteita, ne näkyvät tässä.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avaa tuntikirjaukset' })).toBeInTheDocument();
    expect(screen.getByText('Ei vielä työselosteita').closest('[data-slot="empty-state"]')).toHaveClass('border-dashed');
  });

  it('renders a clearly toned status panel', () => {
    render(
      <StatusPanel
        tone="success"
        icon={ShieldCheck}
        title="Ei havaittuja poikkeamia"
        description="Aktiiviset kirjautumiset ovat kunnossa."
      />,
    );

    const panel = screen.getByText('Ei havaittuja poikkeamia').closest('[data-slot="status-panel"]');
    expect(panel).toHaveClass('border-emerald-200', 'bg-emerald-50');
    expect(screen.getByText('Aktiiviset kirjautumiset ovat kunnossa.')).toBeInTheDocument();
  });
});
