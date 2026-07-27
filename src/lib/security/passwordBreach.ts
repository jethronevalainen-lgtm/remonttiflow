const PWNED_PASSWORDS_RANGE_URL = 'https://api.pwnedpasswords.com/range';

export type PasswordDigest = (password: string) => Promise<string>;
export type PasswordRangeFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function sha1Hex(password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Selain ei tue salasanan turvallista paikallista tarkistusta.');
  }

  const bytes = new TextEncoder().encode(password);
  const digest = await globalThis.crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function leakedPasswordCountFromRange(responseBody: string, hashSuffix: string): number {
  const expected = hashSuffix.trim().toUpperCase();
  for (const line of responseBody.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const suffix = line.slice(0, separator).trim().toUpperCase();
    if (suffix !== expected) continue;
    const count = Number.parseInt(line.slice(separator + 1).trim(), 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }
  return 0;
}

export async function getLeakedPasswordCount(
  password: string,
  options: {
    digest?: PasswordDigest;
    fetcher?: PasswordRangeFetcher;
  } = {},
): Promise<number> {
  const digest = await (options.digest ?? sha1Hex)(password);
  if (!/^[A-F0-9]{40}$/i.test(digest)) {
    throw new Error('Salasanan paikallinen tarkistus epäonnistui.');
  }

  const normalized = digest.toUpperCase();
  const prefix = normalized.slice(0, 5);
  const suffix = normalized.slice(5);
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const response = await fetcher(`${PWNED_PASSWORDS_RANGE_URL}/${prefix}`, {
    method: 'GET',
    headers: {
      'Add-Padding': 'true',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Vuotaneiden salasanojen tarkistuspalvelu ei vastaa. Yritä hetken kuluttua uudelleen.');
  }

  return leakedPasswordCountFromRange(await response.text(), suffix);
}
