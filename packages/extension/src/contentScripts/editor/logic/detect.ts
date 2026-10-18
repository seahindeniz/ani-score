import type { SiteCard, SiteField } from '~/sites/schema';

/**
 * The elements a card type matches on the page, as the runtime filters them.
 */
export function cardElements(card: SiteCard) {
  try {
    return Array.from(
      document.querySelectorAll<HTMLElement>(card.selector || ':not(*)'),
    ).filter(
      (element) =>
        !(card.exclude && element.closest(card.exclude))
        && !(card.has && !element.querySelector(card.has)),
    );
  } catch {
    // A selector being typed
    return [];
  }
}

/**
 * A field's first extraction, the one the editor's guided parts set and show.
 */
export const firstExtract = (field: SiteField | undefined) =>
  Array.isArray(field) ? field[0] : field;

/**
 * The element around the card's first image, where details can sit on top of the poster. `undefined` when the card has
 * no image, or the image sits right in the card.
 */
export function posterOf(card: Element) {
  const frame = card.querySelector('img, picture, video')?.parentElement;

  return frame && frame !== card && card.contains(frame) ? frame : undefined;
}

const rgb = (color: string) =>
  /^rgba?\(/.test(color) ? color.match(/[\d.]+/g)!.map(Number) : undefined;

/**
 * Whether the page is dark around the element: the first background behind it that isn't transparent is.
 */
export function looksDark(element: Element) {
  for (
    let current: Element | null = element;
    current;
    current = current.parentElement
  ) {
    const [red, green, blue, alpha = 1] =
      rgb(getComputedStyle(current).backgroundColor) ?? [];

    if (blue !== undefined && alpha > 0) {
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 128;
    }
  }

  return false;
}

/**
 * How the element around the cards lays them out, and the space it leaves between them.
 */
export function containerLayout(container: Element) {
  const style = getComputedStyle(container);

  return {
    mode: style.display.includes('grid')
      ? ('grid' as const)
      : ('flex' as const),
    gap: Number.parseFloat(style.columnGap || style.gap) || 0,
  };
}
