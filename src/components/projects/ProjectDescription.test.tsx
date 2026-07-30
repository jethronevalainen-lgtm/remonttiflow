import { describe, expect, it } from 'vitest';

import {
  RICH_DESCRIPTION_PREFIX,
  decodeRichDescription,
  encodeRichDescription,
  type RichTextDocument,
} from './ProjectDescription';

describe('ProjectDescription rich text format', () => {
  it('muuntaa vanhan tekstikuvauksen muotoiltavaksi dokumentiksi', () => {
    const documentValue = decodeRichDescription([
      '## Aikataulu',
      '- **A1:** 20.7.–31.7.2026',
      '',
      '> [!HUOMIO] Huoneistoa A2 voidaan käyttää taukotilana.',
    ].join('\n'));

    expect(documentValue.blocks[0]).toMatchObject({
      type: 'heading',
      level: 2,
      runs: [{ text: 'Aikataulu' }],
    });
    expect(documentValue.blocks[1]).toMatchObject({
      type: 'bulletList',
      items: [[
        { text: 'A1:', bold: true },
        { text: ' 20.7.–31.7.2026' },
      ]],
    });
    expect(documentValue.blocks.at(-1)).toMatchObject({
      type: 'callout',
      tone: 'info',
    });
  });

  it('säilyttää otsikot, listat, värit ja korostukset tallennuksessa', () => {
    const source: RichTextDocument = {
      version: 1,
      blocks: [
        { type: 'heading', level: 2, runs: [{ text: 'Aikataulu', bold: true }] },
        {
          type: 'bulletList',
          items: [[
            { text: 'B12', color: 'blue' },
            { text: ' valmis', highlight: true },
          ]],
        },
        { type: 'callout', tone: 'warning', runs: [{ text: 'Kulkureitti pidettävä vapaana.' }] },
      ],
    };

    const encoded = encodeRichDescription(source);

    expect(encoded.startsWith(RICH_DESCRIPTION_PREFIX)).toBe(true);
    expect(decodeRichDescription(encoded)).toEqual(source);
  });

  it('ei tulkitse vanhan kuvauksen html-tekstiä suoritettavaksi sisällöksi', () => {
    const documentValue = decodeRichDescription('<script>alert(1)</script>');

    expect(documentValue.blocks).toEqual([
      {
        type: 'paragraph',
        runs: [{ text: '<script>alert(1)</script>' }],
      },
    ]);
  });

  it('säilyttää viallisen versionoidun arvon näkyvänä tekstinä', () => {
    const invalidValue = `${RICH_DESCRIPTION_PREFIX}{not-json}`;
    const documentValue = decodeRichDescription(invalidValue);

    expect(documentValue.blocks[0]).toEqual({
      type: 'paragraph',
      runs: [{ text: invalidValue }],
    });
  });
});
