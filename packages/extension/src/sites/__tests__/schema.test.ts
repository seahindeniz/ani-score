import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sites from 'virtual:ani-score/sites';

import {
  createSiteJsonSchema,
  siteSchemaPath,
} from '../../../scripts/site-schema';
import { loadBundledSites } from '../../../scripts/sites';
import { presets } from '../presets';
import { parseSiteConfig } from '../schema';

function config(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'example',
    name: 'Example',
    matches: ['*://example.com/*'],
    pages: [
      {
        match: { path: '^/$' },
        cards: [
          {
            selector: '.card',
            title: { selector: 'h3' },
            inject: { position: 'append' },
          },
        ],
      },
    ],
    ...overrides,
  };
}

function withCard(card: Record<string, unknown>) {
  return config({
    pages: [
      {
        match: {},
        cards: [
          {
            selector: '.card',
            title: {},
            inject: { position: 'append' },
            ...card,
          },
        ],
      },
    ],
  });
}

const errorOf = (input: unknown) => {
  const result = parseSiteConfig(input);

  return result.success ? undefined : result.error;
};

describe('parseSiteConfig', () => {
  it('accepts a valid config', () => {
    expect(parseSiteConfig(config())).toEqual({
      success: true,
      config: config() as never,
    });
  });

  it('accepts every bundled config', () => {
    expect(sites.map((site) => site.id)).toEqual(['anizm', 'tranimeizle']);

    for (const site of sites) {
      expect(errorOf(site)).toBeUndefined();
    }
  });

  it('says when a config needs a newer AniScore', () => {
    expect(errorOf(config({ schemaVersion: 2 }))).toBe(
      'This config needs a newer AniScore (schema version 2)',
    );
  });

  it('rejects unknown keys instead of ignoring them', () => {
    expect(errorOf(config({ layout: [] }))).toContain('layout');
  });

  it('rejects broken selectors and regular expressions', () => {
    expect(errorOf(withCard({ selector: 'div[' }))).toContain(
      'Invalid CSS selector: div[',
    );
    expect(errorOf(withCard({ title: { steps: [{ match: '(' }] } }))).toContain(
      'Invalid regular expression: (',
    );
    expect(
      errorOf(withCard({ title: { steps: [{ match: 'a', flags: 'g' }] } })),
    ).toContain('Regular expression flags may only be i, m, s and u');
    // Valid without the `u` flag, but not with it
    expect(
      errorOf(withCard({ title: { steps: [{ match: '\\-', flags: 'u' }] } })),
    ).toContain('The flags do not fit this regular expression');
    expect(
      errorOf(
        withCard({
          title: { steps: [{ replace: '\\-', with: '', flags: 'u' }] },
        }),
      ),
    ).toContain('The flags do not fit this regular expression');
    expect(
      errorOf(withCard({ title: { steps: [{ match: '(a)', group: 2 }] } })),
    ).toContain('The regular expression has no such capture group');
  });

  it('accepts every kind of step, source and field', () => {
    expect(
      errorOf(
        withCard({
          title: [
            {
              source: 'ownText',
              steps: [
                { match: 'a(b)', flags: 'i', group: 0 },
                { replace: 'b', with: 'c', flags: 'i' },
                { preset: 'tr-season-markers' },
              ],
            },
            { selector: 'a', source: { attr: 'href' } },
          ],
          episode: { source: 'text' },
          season: { steps: [{ match: '(\\d+)' }] },
          exclude: '.cloned',
          has: 'a[href*="/episode/"]',
          shimmer: {},
        }),
      ),
    ).toBeUndefined();
  });

  it('accepts every kind of theme', () => {
    for (const theme of [
      'system',
      { dark: { selector: 'body.dark' } },
      { dark: { localStorage: { key: 'theme', equals: 'dark' } } },
      { dark: { any: [{ selector: 'html.dark' }] } },
    ]) {
      expect(errorOf(config({ theme }))).toBeUndefined();
    }

    expect(errorOf(config({ theme: { dark: { any: [] } } }))).toBeDefined();
  });

  it('only takes match patterns and lowercase ids', () => {
    expect(errorOf(config({ matches: ['example.com'] }))).toContain(
      'Use match patterns like *://example.com/*',
    );
    expect(errorOf(config({ id: 'Example Site' }))).toContain(
      'The id may only contain lowercase letters, digits and dashes',
    );
  });

  it("keeps a layout's container from writing CSS of its own", () => {
    const withContainer = (container: string) =>
      config({
        pages: [
          {
            ...config().pages[0],
            layout: [{ container, mode: 'grid', gap: 8 }],
          },
        ],
      });

    expect(errorOf(withContainer('main > .grid'))).toBeUndefined();

    for (const container of [
      '.a {} .b { background: red }',
      '.a; .b',
      '.a /* x */',
    ]) {
      expect(errorOf(withContainer(container))).toContain(
        'A container selector cannot contain {, }, ; or comments',
      );
    }
  });

  it('keeps CSS from loading anything', () => {
    const cssError =
      'CSS may not load other resources: @import, image-set(), src() and url() other than data: URLs are not allowed';

    for (const css of [
      "@import 'https://example.com/a.css';",
      '.a { background: url(https://example.com/?leak) }',
      ".a { background: url( '//example.com/a.png') }",
      '.a { background: \\75 rl(https://example.com/a.png) }',
      '.a { background: image-set("a.png" 1x) }',
    ]) {
      expect(errorOf(config({ css }))).toContain(cssError);
    }

    expect(
      errorOf(
        config({
          css: '.a { background: url("data:image/png;base64,AAAA") }',
          pages: [{ ...config().pages[0], css: '.b { gap: 8px }' }],
        }),
      ),
    ).toBeUndefined();
  });
});

describe('presets', () => {
  it('writes Turkish season and part markers the way the database does', () => {
    expect(presets['tr-season-markers']('Titan 4. Sezon 2. Kısım')).toBe(
      'Titan Season 4 Part 2',
    );
  });
});

describe('bundled configs', () => {
  it('appends style.css to the config and fails the build on invalid ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ani-score-sites-'));

    mkdirSync(join(dir, 'example'));
    writeFileSync(
      join(dir, 'example/site.json'),
      JSON.stringify({ $schema: '../site.schema.json', ...config() }),
    );
    writeFileSync(join(dir, 'example/style.css'), '.card { gap: 8px }');

    expect(loadBundledSites(dir)).toEqual([
      { ...config(), css: '.card { gap: 8px }' } as never,
    ]);

    writeFileSync(
      join(dir, 'example/site.json'),
      JSON.stringify(config({ id: 'Bad' })),
    );

    expect(() => loadBundledSites(dir)).toThrow('Invalid site config');
  });

  it('has an up-to-date JSON schema for editors', async () => {
    expect(await Bun.file(siteSchemaPath).text()).toBe(createSiteJsonSchema());
  });
});
