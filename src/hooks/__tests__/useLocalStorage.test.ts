import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLocalStorage } from '../useLocalStorage';

const KEY = 'test-ls-key';

beforeEach(() => {
  window.localStorage.clear();
});

describe('useLocalStorage', () => {
  it('returns the initial value when storage is empty', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('writes the initial value through to storage on mount', () => {
    renderHook(() => useLocalStorage(KEY, 'fallback'));
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify('fallback'));
  });

  it('reads back previously persisted JSON instead of the initial value', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ a: 1, b: ['x'] }));
    const { result } = renderHook(() =>
      useLocalStorage(KEY, { a: 0, b: [] as string[] }),
    );
    expect(result.current[0]).toEqual({ a: 1, b: ['x'] });
  });

  it('falls back to the initial value when stored JSON is corrupted', () => {
    window.localStorage.setItem(KEY, '{not valid json!!!');
    const { result } = renderHook(() => useLocalStorage(KEY, 'safe-default'));
    expect(result.current[0]).toBe('safe-default');
  });

  it('setValue updates state and persists the new value', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, 0));
    act(() => {
      result.current[1](42);
    });
    expect(result.current[0]).toBe(42);
    expect(window.localStorage.getItem(KEY)).toBe('42');
  });

  it('setValue supports functional updates based on the previous value', () => {
    const { result } = renderHook(() => useLocalStorage<number>(KEY, 1));
    act(() => {
      result.current[1]((prev) => prev + 10);
    });
    expect(result.current[0]).toBe(11);
    act(() => {
      result.current[1]((prev) => prev * 2);
    });
    expect(result.current[0]).toBe(22);
    expect(window.localStorage.getItem(KEY)).toBe('22');
  });

  it('persists complex objects as JSON', () => {
    interface Item {
      id: string;
      tags: string[];
    }
    const { result } = renderHook(() => useLocalStorage<Item[]>(KEY, []));
    act(() => {
      result.current[1]([{ id: 'a', tags: ['x', 'y'] }]);
    });
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual([
      { id: 'a', tags: ['x', 'y'] },
    ]);
  });

  it('handles boolean values (round-trip through storage)', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, false));
    act(() => {
      result.current[1](true);
    });
    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe('true');
  });

  it('warns (does not throw) when persistence fails', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
    const { result } = renderHook(() => useLocalStorage(KEY, 'v'));
    expect(() => {
      act(() => {
        result.current[1]('new-value');
      });
    }).not.toThrow();
    // State still updates even if persistence fails.
    expect(result.current[0]).toBe('new-value');
    expect(warnSpy).toHaveBeenCalled();
    setSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
