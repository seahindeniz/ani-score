import { createStyle } from '~/contentScripts/engagement/logic/createStyle';

import { hoverAttribute } from './picker';

const canQuery = (selector: string) => {
  try {
    document.querySelector(selector);

    return true;
  } catch {
    return false;
  }
};

/**
 * Outlines elements on the page: the one under the pointer while picking, and the matches of the given selectors
 * (e.g. every card the current selector finds).
 */
export function createHighlight() {
  const style = createStyle('');

  document.head.append(style);

  return {
    show(selectors: string[]) {
      const valid = selectors.filter(
        (selector) => selector && canQuery(selector),
      );

      style.textContent = [
        `[${hoverAttribute}] { outline: 2px solid #8b5cf6 !important; outline-offset: -2px !important; cursor: crosshair !important; }`,
        ...valid.map(
          (selector) =>
            `:is(${selector}) { outline: 2px dashed #8b5cf6 !important; outline-offset: 2px !important; }`,
        ),
      ].join('\n');
    },
    dispose: () => style.remove(),
  };
}
