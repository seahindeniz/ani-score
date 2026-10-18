import { createMemo, createSignal, onCleanup } from 'solid-js';

import { fixedBoxes } from '../../logic/spacing';
import { useEditor } from '../context';

/**
 * The elements in the cards too short for AniScore's details, looked for again every second: the details grow as
 * they load, inside shadow roots the editor's page observer doesn't see.
 */
export function createFixedBoxes(
  cards: () => HTMLElement[],
  cardSelector: () => string,
) {
  const editor = useEditor();
  const [tick, setTick] = createSignal(0);
  const timer = setInterval(() => setTick((value) => value + 1), 1000);

  onCleanup(() => clearInterval(timer));

  return createMemo(
    () => {
      tick();
      editor.pageVersion();

      return fixedBoxes(cards(), cardSelector());
    },
    [],
    // The same boxes as a second ago aren't a change, which would draw them again
    { equals: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
}
