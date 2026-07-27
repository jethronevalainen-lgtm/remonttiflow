import { describe, expect, it, vi } from 'vitest';

import {
  getLeakedPasswordCount,
  leakedPasswordCountFromRange,
} from '../passwordBreach';

describe('password breach protection', () => {
  it('matches a SHA-1 suffix case-insensitively', () => {
    const response = [
      '00112233445566778899AABBCCDDEEFF001:2',
      'ABCDEFABCDEFABCDEFABCDEFABCDEFABCDE:981',
    ].join('\r\n');

    expect(leakedPasswordCountFromRange(
      response,
      'abcdefabcdefabcdefabcdefabcdefabcde',
    )).toBe(981);
  });

  it('returns zero when the suffix is not present', () => {
    expect(leakedPasswordCountFromRange('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:5', 'BBBB')).toBe(0);
  });

  it('sends only the five-character hash prefix to the range API', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(
      'A6A8106474E377E624B4817C3E30140F66D:42',
      { status: 200 },
    ));
    const digest = vi.fn().mockResolvedValue('5BAA6A6A8106474E377E624B4817C3E30140F66D');

    await expect(getLeakedPasswordCount('not-sent-to-fetch', { digest, fetcher })).resolves.toBe(42);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe('https://api.pwnedpasswords.com/range/5BAA6');
    expect(String(fetcher.mock.calls[0][0])).not.toContain('not-sent-to-fetch');
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      headers: { 'Add-Padding': 'true' },
      cache: 'no-store',
    });
  });

  it('fails closed when the range service is unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    const digest = vi.fn().mockResolvedValue('5BAA6A6A8106474E377E624B4817C3E30140F66D');

    await expect(getLeakedPasswordCount('secret', { digest, fetcher }))
      .rejects.toThrow('tarkistuspalvelu ei vastaa');
  });
});
