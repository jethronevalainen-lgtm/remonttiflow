import { describe, expect, it } from 'vitest';

import {
  emptyProjectRequestForm,
  isSupportedProjectRequestFile,
  projectRequestLocationLabel,
  validateProjectRequestStep,
} from '@/lib/projectRequestIntake';

describe('project request intake', () => {
  it('requires a title, location and useful description before submission', () => {
    const values = emptyProjectRequestForm('customer-1', 'Tilaaja');
    const errors = validateProjectRequestStep(values, 3);
    expect(errors).toContain('Anna työlle vähintään kolmen merkin otsikko.');
    expect(errors).toContain('Anna kohteen osoite tai sijainti.');
    expect(errors).toContain('Kuvaile työ vähintään 20 merkillä.');
  });

  it('requires access information for an occupied home and a move-in date for an incoming resident', () => {
    const values = {
      ...emptyProjectRequestForm('customer-1', 'Tilaaja'),
      title: 'A 12 – keittiön uusiminen',
      location: 'Antoninkuja 11, Helsinki',
      description: 'Keittiö uusitaan kokonaisuudessaan tilaajan suunnitelman mukaan.',
      occupancyStatus: 'Asuttu' as const,
      incomingResidentStatus: 'Kyllä' as const,
    };
    const errors = validateProjectRequestStep(values, 3);
    expect(errors).toContain('Anna uuden asukkaan muuttopäivä.');
    expect(errors).toContain('Valitse, miten asuttuun kohteeseen päästään.');
  });

  it('builds a readable location label from structured address fields', () => {
    expect(projectRequestLocationLabel({
      location: 'Antoninkuja 11, Helsinki',
      building: 'B',
      staircase: 'A',
      apartment: '12',
    })).toBe('Antoninkuja 11, Helsinki · Rakennus B · Rappu A · Asunto 12');
  });

  it('accepts supported office files even when the browser omits the MIME type', () => {
    expect(isSupportedProjectRequestFile({ name: 'huoneistot.xlsx', type: '' })).toBe(true);
    expect(isSupportedProjectRequestFile({ name: 'suunnitelma.exe', type: '' })).toBe(false);
  });
});
