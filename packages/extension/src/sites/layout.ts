import type { SitePage } from './schema';

const rule = (selector: string, declarations: (string | false)[]) => {
  const set = declarations.filter(Boolean);

  return set.length ? `${selector} {\n  ${set.join('\n  ')}\n}` : '';
};

/**
 * The CSS for a page's `layout`, the same rules a site's stylesheet would use. The space between the cards goes where
 * the site puts it: the container's gap, or the margins or padding of the elements in it (half on each side, the
 * whole below). A grid gets columns of at least `minCardWidth`, a row of flex items that basis for each card.
 */
export function compileLayout(layout: NonNullable<SitePage['layout']>) {
  return layout
    .map(({ container, mode, spacing = 'gap', gap, minCardWidth }) => {
      const spaced = gap != null && spacing !== 'gap';
      // The site sets these on the cards with its own selectors, which a plain rule may not outweigh
      const around = (property: 'margin' | 'padding') =>
        spaced
        && spacing === property && [
          `${property}-inline: ${gap / 2}px !important;`,
          `${property}-block-end: ${gap}px !important;`,
        ];

      return [
        rule(container, [
          spacing === 'gap' && gap != null && `gap: ${gap}px;`,
          mode === 'grid'
            && minCardWidth != null
            && `grid-template-columns: repeat(auto-fill, minmax(min(100%, ${minCardWidth}px), 1fr));`,
        ]),
        rule(`${container} > *`, [
          mode === 'flex'
            && minCardWidth != null
            && `flex-basis: ${minCardWidth}px;`,
          ...(around('margin') || []),
          ...(around('padding') || []),
        ]),
      ]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * The CSS for a page's `heights`: elements in the cards that fit their content, or get another height. Sites often
 * set the height on the element itself, so it wins over that.
 */
export const compileHeights = (heights: NonNullable<SitePage['heights']>) =>
  heights
    .map(({ selector, height }) =>
      rule(selector, [
        `height: ${height === 'auto' ? 'auto' : `${height}px`} !important;`,
        'max-height: none !important;',
      ]),
    )
    .join('\n');

/**
 * Everything a page adds to the site's CSS while it applies.
 */
export const pageCss = (page: SitePage) =>
  [
    page.css,
    page.layout && compileLayout(page.layout),
    page.heights && compileHeights(page.heights),
  ]
    .filter(Boolean)
    .join('\n');
