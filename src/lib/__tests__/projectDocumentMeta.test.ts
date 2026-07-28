import { describe, expect, it } from 'vitest';

import {
  formatProjectFileSize,
  inferProjectDocumentType,
  projectDocumentKind,
} from '@/lib/projectDocumentMeta';

describe('projectDocumentMeta', () => {
  it('infers document types from extension and mime', () => {
    expect(inferProjectDocumentType('julkisivu.jpg')).toBe('Valokuva');
    expect(inferProjectDocumentType('sopimus.PDF')).toBe('PDF');
    expect(inferProjectDocumentType('budjetti.xlsx')).toBe('Excel / taulukko');
    expect(inferProjectDocumentType('muistiinpanot.txt')).toBe('Muu');
    expect(inferProjectDocumentType('tiedosto', 'image/png')).toBe('Valokuva');
    expect(inferProjectDocumentType('tiedosto', 'application/pdf')).toBe('PDF');
  });

  it('maps kinds and formats sizes', () => {
    expect(projectDocumentKind('a.png')).toBe('image');
    expect(projectDocumentKind('a.pdf')).toBe('pdf');
    expect(projectDocumentKind('a.xlsx')).toBe('spreadsheet');
    expect(formatProjectFileSize(512)).toBe('512 B');
    expect(formatProjectFileSize(2048)).toBe('2.0 kt');
    expect(formatProjectFileSize(2 * 1024 * 1024)).toBe('2.0 Mt');
  });
});
