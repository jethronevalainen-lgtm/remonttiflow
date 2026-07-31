import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ProjectUnitImportSource, ProjectWorkTargetDraft } from '@/lib/projectWorkPlanBuilder';
import type { Project } from '@/types';

import ProjectWorkTargetsStep from './ProjectWorkTargetsStep';

const project: Project = {
  id: 'project-1',
  name: 'Supikuja PTS Keittiöt',
  customer: 'Taloyhtiö',
  status: 'Aktiivinen',
  startDate: '2026-08-03',
  endDate: '2026-08-28',
  progress: 0,
  budget: 0,
  spent: 0,
};

const units: ProjectUnitImportSource[] = [
  { id: 'unit-1', unitCode: 'A1', buildingName: 'Talo 1', floor: '1' },
  { id: 'unit-2', unitCode: 'A2', buildingName: 'Talo 1', floor: '2' },
];

function renderStep(overrides: Partial<Parameters<typeof ProjectWorkTargetsStep>[0]> = {}) {
  const onTargetsChange = vi.fn();
  render(
    <ProjectWorkTargetsStep
      project={project}
      people={[]}
      planName="Supikuja PTS Keittiöt – työkokonaisuus"
      planDescription=""
      targets={[]}
      unitOptions={[]}
      unitsLoading={false}
      unitsError=""
      onReloadUnits={vi.fn()}
      onPlanNameChange={vi.fn()}
      onPlanDescriptionChange={vi.fn()}
      onTargetsChange={onTargetsChange}
      {...overrides}
    />,
  );
  return { onTargetsChange };
}

describe('ProjectWorkTargetsStep', () => {
  it('shows only the chosen way of adding targets at a time', () => {
    renderStep({ unitOptions: units });

    const chooser = screen.getByRole('group', { name: 'Kohteiden lisäystapa' });
    expect(within(chooser).getAllByRole('button')).toHaveLength(3);
    expect(within(chooser).getByRole('button', { name: /Projektin huoneistoista/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Valitse huoneisto A1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Montako kohdetta')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Liitä kohderivit')).not.toBeInTheDocument();

    fireEvent.click(within(chooser).getByRole('button', { name: /Numerosarjana/ }));

    expect(screen.getByLabelText('Montako kohdetta')).toBeInTheDocument();
    expect(screen.queryByLabelText('Valitse huoneisto A1')).not.toBeInTheDocument();
  });

  it('defaults to the number sequence when the project has no unit register', () => {
    renderStep();

    const chooser = screen.getByRole('group', { name: 'Kohteiden lisäystapa' });
    expect(within(chooser).getByRole('button', { name: /Numerosarjana/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chooser).getByRole('button', { name: /Ei huoneistoja rekisterissä/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Montako kohdetta')).toBeInTheDocument();
  });

  it('previews the generated sequence before anything is added', () => {
    const { onTargetsChange } = renderStep();

    fireEvent.change(screen.getByLabelText('Montako kohdetta'), { target: { value: '3' } });

    expect(screen.getByText('Lisätään 3 uutta kohdetta.')).toBeInTheDocument();
    expect(screen.getByText('Huoneisto 1')).toBeInTheDocument();
    expect(screen.getByText('Huoneisto 3')).toBeInTheDocument();
    expect(onTargetsChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Lisää 3 kohdetta listaan' }));

    const added = onTargetsChange.mock.calls[0][0] as ProjectWorkTargetDraft[];
    expect(added.map((target) => target.title)).toEqual(['Huoneisto 1', 'Huoneisto 2', 'Huoneisto 3']);
    expect(added[0].startDate).toBe('2026-08-03');
  });

  it('continues the sequence after adding so the next batch is not a duplicate', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Montako kohdetta'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lisää 3 kohdetta listaan' }));

    expect(screen.getByLabelText('Ensimmäinen numero')).toHaveValue(4);
    expect(screen.getByLabelText('Ensimmäinen aloituspäivä')).toHaveValue('2026-09-14');
    expect(screen.getByText('Huoneisto 4')).toBeInTheDocument();
  });

  it('reports an invalid sequence instead of silently generating nothing', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Montako kohdetta'), { target: { value: '250' } });

    expect(screen.getByText('• Kohteiden määrän pitää olla 1–100.')).toBeInTheDocument();
    expect(screen.getByText('Tarkista numerosarjan tiedot, niin näet mitä lisätään.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lisää kohteet listaan' })).toBeDisabled();
  });

  it('parses a pasted spreadsheet row and completes missing dates from the project', () => {
    const { onTargetsChange } = renderStep();

    fireEvent.click(screen.getByRole('button', { name: /Liittämällä lista/ }));
    fireEvent.change(screen.getByLabelText('Liitä kohderivit'), {
      target: { value: 'A1\t1. kerros\tKeittiö + vinyyli\t3.8.2026\t14.8.2026\nA2\t2. kerros\tVain keittiö' },
    });

    expect(screen.getByText('Lisätään 2 uutta kohdetta.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lisää 2 kohdetta listaan' }));

    const added = onTargetsChange.mock.calls[0][0] as ProjectWorkTargetDraft[];
    expect(added[0]).toMatchObject({ title: 'A1', location: '1. kerros', startDate: '2026-08-03', endDate: '2026-08-14' });
    expect(added[1]).toMatchObject({ title: 'A2', startDate: '2026-08-03', endDate: '2026-08-28' });
  });

  it('marks register units that are already on the target list', () => {
    renderStep({
      unitOptions: units,
      targets: [{
        id: 'target-1',
        key: '001-a1',
        title: 'A1',
        location: 'Talo 1 · 1. kerros',
        description: '',
        startDate: '2026-08-03',
        endDate: '2026-08-28',
        assigneeUserIds: [],
      }],
    });

    expect(screen.getByLabelText('Valitse huoneisto A1')).toBeDisabled();
    expect(screen.getByLabelText('Valitse huoneisto A2')).toBeEnabled();
    expect(screen.getByText('Jo listalla')).toBeInTheDocument();
    expect(screen.getByText('Valittu 0 / 1 lisättävissä olevaa huoneistoa.')).toBeInTheDocument();
  });
});
