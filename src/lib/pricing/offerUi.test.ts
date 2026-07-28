import { describe, expect, it } from 'vitest';

import {
  centsInput,
  daysUntil,
  expiryLabel,
  latestVersionForOffer,
  moneyInput,
  workflowStep,
} from '../../pages/offers/offerUi';
import type { OfferVersion } from '../supabase/offers';

describe('offerUi helpers', () => {
  it('parsii suomalaiset rahasyötteet senteiksi', () => {
    expect(moneyInput('12,50')).toBe(12.5);
    expect(centsInput('12,50')).toBe(1250);
    expect(centsInput('1 200,00')).toBe(120_000);
  });

  it('tunnistaa vanhenevat tarjoukset', () => {
    const today = new Date();
    const iso = (offsetDays: number) => {
      const value = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays);
      return value.toISOString().slice(0, 10);
    };
    expect(daysUntil(iso(0))).toBe(0);
    expect(daysUntil(iso(3))).toBe(3);
    expect(daysUntil(iso(-2))).toBe(-2);
    expect(expiryLabel(iso(-1), 'Lähetetty')).toContain('Vanhentunut');
    expect(expiryLabel(iso(3), 'Luonnos')).toContain('Voimassa 3 pv');
    expect(expiryLabel(iso(3), 'Hyväksytty')).toBeNull();
  });

  it('valitsee aktiivisimman version listanäkymään', () => {
    const versions = [
      { id: 'v3', offerId: 'o1', versionNumber: 3, status: 'Korvattu' },
      { id: 'v2', offerId: 'o1', versionNumber: 2, status: 'Lähetetty' },
      { id: 'v1', offerId: 'o1', versionNumber: 1, status: 'Korvattu' },
      { id: 'd1', offerId: 'o2', versionNumber: 2, status: 'Luonnos' },
      { id: 'd0', offerId: 'o2', versionNumber: 1, status: 'Hylätty' },
    ] as OfferVersion[];

    expect(latestVersionForOffer(versions, 'o1')?.id).toBe('v2');
    expect(latestVersionForOffer(versions, 'o2')?.id).toBe('d1');
  });

  it('karttaa työnkulun vaiheet', () => {
    expect(workflowStep('Luonnos')).toBe(0);
    expect(workflowStep('Lähetetty')).toBe(1);
    expect(workflowStep('Hyväksytty')).toBe(2);
    expect(workflowStep('Arkistoitu')).toBe(3);
  });
});
