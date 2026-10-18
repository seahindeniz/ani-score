/**
 * Marks the element under the pointer while picking; the editor's page styles outline it.
 */
export const hoverAttribute = 'data-ani-score-hover';

export interface PickOptions {
  /**
   * Maps the element under the pointer to the one that would be picked, or `null` where nothing can be picked (e.g.
   * outside the cards when picking an element of a card). The element itself by default.
   */
  resolve?: (element: Element) => Element | null;
  /**
   * Elements that are never picked, like the editor itself.
   */
  ignore: (element: Element) => boolean;
  /**
   * Stops picking, like Escape does.
   */
  signal?: AbortSignal;
}

/**
 * Lets the user point at an element of the page and click it. Resolves with the element, or `undefined` when they press
 * Escape or `signal` aborts. The click doesn't reach the site, so links don't navigate.
 */
export function pickElement({
  resolve = (element) => element,
  ignore,
  signal,
}: PickOptions) {
  return new Promise<Element | undefined>((done) => {
    let hovered: Element | null = null;

    const pickable = (event: Event) => {
      const target = event.target as Element;

      return target instanceof Element && !ignore(target)
        ? resolve(target)
        : null;
    };

    const hover = (element: Element | null) => {
      hovered?.removeAttribute(hoverAttribute);
      hovered = element;
      hovered?.setAttribute(hoverAttribute, '');
    };

    const onMove = (event: Event) => hover(pickable(event));

    // The site mustn't see the presses either, or it might open a link or a menu
    const block = (event: Event) => {
      if (!pickable(event)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const finish = (element: Element | undefined) => {
      hover(null);
      document.removeEventListener('mouseover', onMove, true);
      document.removeEventListener('mousedown', block, true);
      document.removeEventListener('pointerdown', block, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      signal?.removeEventListener('abort', onAbort);
      done(element);
    };

    const onClick = (event: Event) => {
      const element = pickable(event);

      if (!element) return;

      block(event);
      finish(element);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(undefined);
    };

    const onAbort = () => finish(undefined);

    if (signal?.aborted) {
      done(undefined);

      return;
    }

    signal?.addEventListener('abort', onAbort);
    document.addEventListener('mouseover', onMove, true);
    document.addEventListener('mousedown', block, true);
    document.addEventListener('pointerdown', block, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
  });
}
