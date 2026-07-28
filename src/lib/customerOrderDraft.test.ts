import { describe, expect, it } from 'vitest';

import { EMPTY_ORDER_DRAFT, EMPTY_ORDER_ITEM } from '@/lib/customerOrderDraft';


describe('customer order draft', () => {
  it('starts with one editable work item and canonical defaults', () => {
    expect(EMPTY_ORDER_DRAFT).toMatchObject({
      customerId: '',
      projectId: '',
      urgency: 'Normaali',
      items: [expect.objectContaining({ title: '', unit: 'kpl', priority: 'Normaali' })],
    });
  });

  it('keeps the reusable item template independent from draft mutations', () => {
    const draftItem = { ...EMPTY_ORDER_DRAFT.items[0], title: 'Maalaus' };

    expect(draftItem.title).toBe('Maalaus');
    expect(EMPTY_ORDER_ITEM.title).toBe('');
    expect(EMPTY_ORDER_DRAFT.items[0].title).toBe('');
  });

  it('does not contain organization identity in the client-side customer draft', () => {
    expect('organizationId' in EMPTY_ORDER_DRAFT).toBe(false);
  });
});
