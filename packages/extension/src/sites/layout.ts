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

const length = (size: 'auto' | number) =>
  size === 'auto' ? 'auto' : `${size}px`;

/**
 * The CSS for a page's `sizes`: elements in the cards freed of their height or width limit, or given another one.
 * Sites often set these on the element itself, so it wins over that.
 */
export const compileSizes = (sizes: NonNullable<SitePage['sizes']>) =>
  sizes
    .map(({ selector, height, width }) =>
      rule(selector, [
        height !== undefined && `height: ${length(height)} !important;`,
        height !== undefined && 'max-height: none !important;',
        width !== undefined && `width: ${length(width)} !important;`,
        width !== undefined && 'max-width: none !important;',
      ]),
    )
    .filter(Boolean)
    .join('\n');

/**
 * Everything a page adds to the site's CSS while it applies.
 */
export const pageCss = (page: SitePage) =>
  [
    page.css,
    page.layout && compileLayout(page.layout),
    page.sizes && compileSizes(page.sizes),
  ]
    .filter(Boolean)
    .join('\n');
