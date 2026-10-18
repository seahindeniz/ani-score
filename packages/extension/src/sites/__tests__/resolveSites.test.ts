import { describe, expect, it } from 'bun:test';

import { resolveSites, siteFingerprint } from '../resolveSites';
import type { SiteConfig } from '../schema';

function site(id: string, overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    schemaVersion: 1,
    id,
    name: id,
    matches: [`*://${id}.com/*`],
    pages: [
      {
        match: {},
        cards: [
          {
            selector: '.card',
            title: {},
            inject: { position: 'append' },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('resolveSites', () => {
  it("puts the user's configs first, replacing bundled ones with the same id", () => {
    const bundled = [site('anizm', { access: 'required' }), site('openani')];
    const edited = site('anizm', { name: 'My Anizm' });

    expect(
      resolveSites(
        [
          { config: edited, savedAt: 1 },
          { config: site('animex'), savedAt: 2 },
        ],
        bundled,
      ).sites.map(({ id, name, access }) => ({ id, name, access })),
    ).toEqual([
      // A user's config never gets access from install
      { id: 'anizm', name: 'My Anizm', access: 'optional' },
      { id: 'animex', name: 'animex', access: 'optional' },
      { id: 'openani', name: 'openani', access: undefined },
    ]);
  });

  it('reports the configs that no longer validate', () => {
    expect(
      resolveSites(
        [
          { config: { ...site('broken'), pages: [] }, savedAt: 1 },
          { config: null, savedAt: 2 },
        ],
        [],
      ),
    ).toEqual({
      sites: [],
      invalid: [
        { index: 0, id: 'broken', error: expect.any(String) },
        { index: 1, id: undefined, error: expect.any(String) },
      ],
    });
  });
});

describe('siteFingerprint', () => {
  it('changes with the config', () => {
    expect(siteFingerprint(site('anizm'))).toBe(siteFingerprint(site('anizm')));
    expect(siteFingerprint(site('anizm'))).not.toBe(
      siteFingerprint(site('anizm', { name: 'Anizm' })),
    );
  });
});
