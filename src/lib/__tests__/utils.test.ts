import { describe, expect, it } from 'vitest';

import { cn } from '../utils';

describe('cn', () => {
  it('merges multiple class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('ignores falsy conditional values', () => {
    expect(cn('px-4', false && 'hidden', undefined, null)).toBe('px-4');
  });

  it('supports conditional object syntax', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('resolves conflicting Tailwind classes (last one wins)', () => {
    expect(cn('px-4', 'px-8')).toBe('px-8');
    expect(cn('text-sm text-red-500', 'text-blue-500')).toBe('text-sm text-blue-500');
  });

  it('returns an empty string for no input', () => {
    expect(cn()).toBe('');
  });
});
