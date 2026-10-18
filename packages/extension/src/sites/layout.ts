import type { SitePage } from './schema';

/**
 * The CSS for a page's `layout`, the same rules a site's stylesheet would use: a grid gets a gap and columns of at
 * least `minCardWidth`, a row of flex items a gap and that basis for each card.
 */
export function compileLayout(layout: NonNullable<SitePage['layout']>) {
  return layout
    .map(({ container, mode, gap, minCardWidth }) => {
      const rules = [
        gap != null && `gap: ${gap}px;`,
        mode === 'grid'
          && minCardWidth != null
          && `grid-template-columns: repeat(auto-fill, minmax(min(100%, ${minCardWidth}px), 1fr));`,
      ].filter(Boolean);
      const containerRule = rules.length
        ? `${container} {\n  ${rules.join('\n  ')}\n}`
        : '';
      const cardRule =
        mode === 'flex' && minCardWidth != null
          ? `${container} > * {\n  flex-basis: ${minCardWidth}px;\n}`
          : '';

      return [containerRule, cardRule].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Everything a page adds to the site's CSS while it applies.
 */
export const pageCss = (page: SitePage) =>
  [page.css, page.layout && compileLayout(page.layout)]
    .filter(Boolean)
    .join('\n');
