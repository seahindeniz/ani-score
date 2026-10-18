import { describe, expect, it } from 'bun:test';

import { compileLayout, pageCss } from '../layout';
import type { SitePage } from '../schema';

describe('compileLayout', () => {
  it('spaces a grid and sizes its columns, like a site stylesheet would', () => {
    expect(
      compileLayout([
        { container: '.grid', mode: 'grid', gap: 30, minCardWidth: 180 },
      ]),
    ).toBe(
      '.grid {\n  gap: 30px;\n  grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));\n}',
    );
  });

  it('spaces a row and sizes each card in it', () => {
    expect(
      compileLayout([
        { container: '.rail', mode: 'flex', gap: 30, minCardWidth: 220 },
      ]),
    ).toBe('.rail {\n  gap: 30px;\n}\n.rail > * {\n  flex-basis: 220px;\n}');
  });

  it("spaces the cards with their margins or padding when that's how the site does", () => {
    expect(
      compileLayout([
        { container: '.list', mode: 'block', spacing: 'margin', gap: 20 },
        { container: '.row', mode: 'flex', spacing: 'padding', gap: 30 },
        // Without a gap, there's nothing to space
        { container: '.none', mode: 'block', spacing: 'margin' },
      ]),
    ).toBe(
      [
        '.list > * {\n  margin-inline: 10px !important;\n  margin-block-end: 20px !important;\n}',
        '.row > * {\n  padding-inline: 15px !important;\n  padding-block-end: 30px !important;\n}',
      ].join('\n'),
    );
  });

  it('only writes what is set', () => {
    expect(
      compileLayout([
        { container: '.rail', mode: 'flex', minCardWidth: 220 },
        { container: '.grid', mode: 'grid', gap: 8 },
        { container: '.empty', mode: 'grid' },
      ]),
    ).toBe('.rail > * {\n  flex-basis: 220px;\n}\n.grid {\n  gap: 8px;\n}');
  });
});

describe('pageCss', () => {
  const page: SitePage = { match: {}, cards: [] };

  it("joins the page's CSS and layout", () => {
    expect(pageCss(page)).toBe('');
    expect(pageCss({ ...page, css: '.a {}' })).toBe('.a {}');
    expect(
      pageCss({
        ...page,
        css: '.a {}',
        layout: [{ container: '.b', mode: 'grid', gap: 4 }],
      }),
    ).toBe('.a {}\n.b {\n  gap: 4px;\n}');
  });

  it('lifts the height or width limit of elements in the cards, or sets another', () => {
    expect(
      pageCss({
        ...page,
        sizes: [
          { selector: ':is(.card) .info', height: 'auto' },
          { selector: '.card', height: 320, width: 'auto' },
          { selector: '.title', width: 180 },
          // Nothing set, nothing written
          { selector: '.empty' },
        ],
      }),
    ).toBe(
      [
        ':is(.card) .info {\n  height: auto !important;\n  max-height: none !important;\n}',
        '.card {\n  height: 320px !important;\n  max-height: none !important;\n  width: auto !important;\n  max-width: none !important;\n}',
        '.title {\n  width: 180px !important;\n  max-width: none !important;\n}',
      ].join('\n'),
    );
  });
});
