/**
 * Marks the elements AniScore adds to the page, so its own changes don't count as the site re-rendering.
 */
export const ownElementAttribute = 'data-ani-score';

export function createStyle(css: string) {
  const style = document.createElement('style');

  style.setAttribute(ownElementAttribute, '');
  style.textContent = css;

  return style;
}
