/**
 * Single source of truth for brand identity.
 *
 * The UI is currently branded "VaKantti" while the repo/README say
 * "remonttiflow" — the final product name is pending a business decision.
 * Until then, ALL brand strings must be imported from here so a future
 * rename is a one-line change.
 *
 * The ONLY sanctioned duplicate is index.html (static HTML cannot import
 * TS); it carries a comment pointing back to this file.
 */
export const BRAND = {
  name: 'VaKantti',
  shortName: 'VK',
  tagline: 'Rakennusalan työnhallinta',
  aiAssistantName: 'VaKantti AI -assistentti',
  emailDomain: 'vakantti.fi',
  storagePrefix: 'vakantti-v1',
} as const;

export type Brand = typeof BRAND;
