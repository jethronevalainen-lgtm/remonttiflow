import { describe, expect, it } from 'vitest';

import {
  DEMO_ROLE_GUIDES,
  DEMO_ROLES,
  DEMO_SCENARIOS,
  demoReviewExpectedCount,
  demoScenarioDefinition,
  isDemoScenario,
} from '@/lib/demoQuality';

describe('demo quality definitions', () => {
  it('supports all intended demo scenarios', () => {
    expect(DEMO_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'normal',
      'busy',
      'late',
      'empty',
      'handover',
    ]);
    expect(isDemoScenario('handover')).toBe(true);
    expect(isDemoScenario('unknown')).toBe(false);
  });

  it('defines unique checklist keys for every role', () => {
    for (const role of DEMO_ROLES) {
      const keys = DEMO_ROLE_GUIDES[role].checks.map((check) => check.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('counts desktop and mobile checks separately', () => {
    const rawChecks = DEMO_ROLES.reduce((sum, role) => sum + DEMO_ROLE_GUIDES[role].checks.length, 0);
    expect(demoReviewExpectedCount()).toBe(rawChecks * 2);
  });

  it('returns a stable scenario definition', () => {
    expect(demoScenarioDefinition('empty').label).toBe('Tyhjä uusi organisaatio');
  });
});
