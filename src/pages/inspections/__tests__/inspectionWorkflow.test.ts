import { describe, expect, it } from 'vitest';

import {
  findingBlocksHandover,
  findingRequiresDueDate,
  findingRequiresOwner,
  findingWorkflowStage,
  suggestedFindingDueDate,
} from '../inspectionWorkflow';

describe('inspectionWorkflow', () => {
  it('treats all non-minor findings as handover blockers', () => {
    expect(findingBlocksHandover('Vähäinen')).toBe(false);
    expect(findingBlocksHandover('Korjattava ennen luovutusta')).toBe(true);
    expect(findingBlocksHandover('Merkittävä')).toBe(true);
    expect(findingBlocksHandover('Kriittinen')).toBe(true);
    expect(findingRequiresDueDate('Merkittävä')).toBe(true);
    expect(findingRequiresOwner('Kriittinen')).toBe(true);
  });

  it('suggests due dates according to severity', () => {
    expect(suggestedFindingDueDate('Kriittinen', '2026-07-29')).toBe('2026-07-29');
    expect(suggestedFindingDueDate('Merkittävä', '2026-07-29')).toBe('2026-07-30');
    expect(suggestedFindingDueDate('Korjattava ennen luovutusta', '2026-07-29')).toBe('2026-08-01');
    expect(suggestedFindingDueDate('Vähäinen', '2026-07-29')).toBe('2026-08-05');
  });

  it('maps finding statuses to a controlled workflow stage', () => {
    expect(findingWorkflowStage('Avoin')).toBe('assignment');
    expect(findingWorkflowStage('Hylätty')).toBe('assignment');
    expect(findingWorkflowStage('Työn alla')).toBe('correction');
    expect(findingWorkflowStage('Ilmoitettu korjatuksi')).toBe('verification');
    expect(findingWorkflowStage('Odottaa uusintatarkastusta')).toBe('verification');
    expect(findingWorkflowStage('Hyväksytty')).toBe('closed');
    expect(findingWorkflowStage('Mitätöity')).toBe('closed');
  });
});
