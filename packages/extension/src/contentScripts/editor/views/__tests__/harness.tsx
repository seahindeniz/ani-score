import { mock } from 'bun:test';

import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { createSignal } from 'solid-js';

import type { PickOptions } from '../../logic/picker';
import { EditorContext } from '../context';

/**
 * Renders editor views with a picker that "clicks" the queued elements in order (`undefined` cancels), applying the
 * view's `resolve` like the real one.
 */
export function renderInEditor(view: () => JSX.Element) {
  const queue: (Element | undefined)[] = [];
  const [pageVersion, setPageVersion] = createSignal(0);
  const pick = mock(async (options: Omit<PickOptions, 'ignore'> = {}) => {
    const element = queue.shift();

    return element && (options.resolve ? options.resolve(element) : element)
      ? element
      : undefined;
  });

  const result = render(() => (
    <EditorContext.Provider value={{ pick, pageVersion }}>
      {view()}
    </EditorContext.Provider>
  ));

  return {
    ...result,
    pick,
    /**
     * Queues the elements the next picks return.
     */
    willPick: (...elements: (Element | undefined)[]) => queue.push(...elements),
    /**
     * What the editor does after the page changed.
     */
    pageChanged: () => setPageVersion((version) => version + 1),
  };
}

/**
 * Waits for the pick a click started, and the update after it.
 */
export const settle = () => new Promise((resolve) => setTimeout(resolve));
