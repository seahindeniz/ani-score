import { describe, expect, it } from 'bun:test';

import { createAlias, unHashAlias } from '../hash';

describe('createAlias', () => {
  it('encodes titles as GraphQL-safe base64 without padding', () => {
    const alias = createAlias('Sousou no Frieren?>');

    expect(alias).toMatch(/^[\w-]+$/);
    expect(alias).not.toContain('=');
  });

  it('round-trips through unHashAlias, including non-ASCII titles', () => {
    for (const title of [
      'Frieren',
      'İzle Bölüm 3',
      '葬送のフリーレン',
      '???>>>',
    ])
      expect(unHashAlias(createAlias(title))).toBe(title);
  });

  it('replaces the base64 characters GraphQL does not allow', () => {
    // "???>>>" encodes to "Pz8/Pj4+" in standard base64
    expect(createAlias('???>>>')).toBe('Pz8_Pj4-');
  });
});
