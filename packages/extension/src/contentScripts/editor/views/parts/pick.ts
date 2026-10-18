import { onCleanup } from 'solid-js';

import type { PickOptions } from '../../logic/picker';
import { relativeSelector } from '../../logic/selectors';
import { useEditor } from '../context';

/**
 * Picks an element of the page. Starting another pick, or leaving the view, stops the one still waiting.
 */
export function createPicker() {
  const editor = useEditor();
  let controller: AbortController | undefined;

  onCleanup(() => controller?.abort());

  return (options: Pick<PickOptions, 'resolve'> = {}) => {
    controller?.abort();
    controller = new AbortController();

    return editor.pick({ ...options, signal: controller.signal });
  };
}

/**
 * Picks an element inside one of the cards: resolves with that card and a selector for the element relative to it
 * (empty for the card itself), or `undefined` when the user cancels.
 */
export function createCardPicker(cards: () => HTMLElement[]) {
  const pick = createPicker();

  return async () => {
    const cardOf = (element: Element) =>
      cards().find((card) => card.contains(element));
    const element = await pick({
      resolve: (target) => (cardOf(target) ? target : null),
    });

    if (!element) return undefined;

    const card = cardOf(element)!;

    return { card, element, selector: relativeSelector(card, element) };
  };
}
