import { createStyle } from '~/contentScripts/engagement/logic/createStyle';

import { hoverAttribute } from './picker';

import globalStyles from '~/contentScripts/engagement/global.css?raw';

/**
 * Marks what the editor points out on the page; the editor's page styles outline it.
 */
export const markAttribute = 'data-ani-score-mark';

/**
 * Marks the elements a setting in the editor is about while the user points at it.
 */
export const pointAttribute = 'data-ani-score-point';

/**
 * Shows the "on your list" glow on an element, as if the anime were on the user's list.
 */
export const glowAttribute = 'data-ani-score-glow';

export interface Marks {
  /**
   * The cards found, outlined with dashes.
   */
  card?: Element[];
  /**
   * What's read from the cards, e.g. their titles.
   */
  part?: Element[];
  /**
   * Cards that can't be read, in a warning color.
   */
  skipped?: Element[];
  /**
   * The elements that glow while their anime is on the user's list.
   */
  glow?: Element[];
}

const css = `
${globalStyles}
[${hoverAttribute}] { outline: 2px solid #8b5cf6 !important; outline-offset: -2px !important; cursor: crosshair !important; }
[${pointAttribute}] { outline: 2px solid #8b5cf6 !important; outline-offset: -2px !important; background-color: rgb(139 92 246 / 0.15) !important; }
[${markAttribute}="card"] { outline: 2px dashed #8b5cf6 !important; outline-offset: 2px !important; }
[${markAttribute}="part"] { outline: 2px solid #8b5cf6 !important; outline-offset: -2px !important; background-color: rgb(139 92 246 / 0.2) !important; }
[${markAttribute}="skipped"] { outline: 2px dashed #f59e0b !important; outline-offset: 2px !important; }
[${glowAttribute}] { position: relative; animation: ani-score-shimmer 3s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { [${glowAttribute}] { animation: none; box-shadow: 0 0 0 3px oklch(55% 0.24 264 / 0.8); } }
`;

/**
 * Points out elements on the page: the one under the pointer while picking (see `pickElement`), and the given marks.
 * Each `show` replaces the previous marks.
 */
export function createHighlight() {
  const style = createStyle(css);
  let marked: Element[] = [];
  let pointed: Element[] = [];

  document.head.append(style);

  function clear() {
    for (const element of marked) {
      element.removeAttribute(markAttribute);
      element.removeAttribute(glowAttribute);
    }

    marked = [];
  }

  // Outlines the elements a setting is about, on top of the marks; nothing stops pointing
  function point(elements: Element[]) {
    for (const element of pointed) element.removeAttribute(pointAttribute);

    pointed = elements;

    for (const element of pointed) element.setAttribute(pointAttribute, '');
  }

  return {
    show(marks: Marks) {
      clear();

      for (const kind of ['card', 'skipped', 'part'] as const) {
        for (const element of marks[kind] ?? []) {
          element.setAttribute(markAttribute, kind);
          marked.push(element);
        }
      }

      for (const element of marks.glow ?? []) {
        element.setAttribute(glowAttribute, '');
        marked.push(element);
      }
    },
    point,
    dispose() {
      clear();
      point([]);
      style.remove();
    },
  };
}
