import type { SitePage } from '~/sites/schema';

import { relativeSelector } from './selectors';

type Layout = NonNullable<SitePage['layout']>[number];

export interface Spacing {
  mode: Layout['mode'];
  method: NonNullable<Layout['spacing']>;
  /**
   * The space the site leaves between two cards side by side.
   */
  space: number;
}

const px = (value: string) => Number.parseFloat(value) || 0;

function modeOf(display: string): Layout['mode'] {
  if (display.includes('grid')) return 'grid';
  if (display.includes('flex')) return 'flex';

  return 'block';
}

/**
 * How the element around the cards spaces them, so the editor changes the same thing: a grid's or a row's gap, or
 * the margins of the cards (side by side as floats or inline blocks, or stacked), or their padding when the visible
 * card is inside them, as with columns that have a width and padding. A container that spaces nothing yet gets a gap
 * where it has one, margins otherwise.
 */
export function detectSpacing(cell: Element): Spacing | undefined {
  const container = cell.parentElement;

  if (!container) return undefined;

  const mode = modeOf(getComputedStyle(container).display);
  const gap = px(getComputedStyle(container).columnGap);
  const style = getComputedStyle(cell);
  const margin = px(style.marginLeft) + px(style.marginRight);
  const padding = px(style.paddingLeft) + px(style.paddingRight);

  if (mode !== 'block' && gap > 0) return { mode, method: 'gap', space: gap };
  if (margin > 0) return { mode, method: 'margin', space: margin };
  if (padding > 0 && cell.firstElementChild) {
    return { mode, method: 'padding', space: padding };
  }

  return { mode, method: mode === 'block' ? 'margin' : 'gap', space: 0 };
}

export interface Box {
  /**
   * The element in every card, for the page's `sizes`.
   */
  selector: string;
  /**
   * Its CSS height and width on the first card.
   */
  height: number;
  width: number;
  /**
   * How many cards cut the details off there: too short, or too narrow.
   */
  short: number;
  narrow: number;
}

/**
 * A selector for an element in every card: the card's own, or the element's path in it under the card's.
 */
export function inCards(cardSelector: string, card: Element, element: Element) {
  if (element === card) return cardSelector;

  const relative = relativeSelector(card, element);

  return relative.startsWith(':scope')
    ? relative.replace(/^:scope/, `:is(${cardSelector})`)
    : `:is(${cardSelector}) ${relative}`;
}

/**
 * The elements from AniScore's details up to the card, the closest first, each with its size and the cards where it's
 * too short or too narrow for what's in it now that the details are there: a fixed (or maximum) height or width the
 * site set, which cuts the details off or lets them run over what's next to them.
 */
export function boxesAround(cards: Element[], cardSelector: string) {
  const found = new Map<string, Box>();

  for (const card of cards.slice(0, 24)) {
    const details = card.querySelector(`.${__NAME__}`);

    for (
      let element = details?.parentElement;
      element && card.contains(element);
      element = element.parentElement
    ) {
      const selector = inCards(cardSelector, card, element);
      let box = found.get(selector);

      if (!box) {
        const style = getComputedStyle(element);

        box = {
          selector,
          height: Math.round(px(style.height)),
          width: Math.round(px(style.width)),
          short: 0,
          narrow: 0,
        };
        found.set(selector, box);
      }

      if (element.scrollHeight > element.clientHeight + 1) box.short++;
      if (element.scrollWidth > element.clientWidth + 1) box.narrow++;
    }
  }

  return [...found.values()];
}

/**
 * Whether the box cuts the details off on some card.
 */
export const cutsOff = (box: Box) => box.short > 0 || box.narrow > 0;
