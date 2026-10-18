import { mock } from 'bun:test';

import { fireEvent, render, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { createSignal } from 'solid-js';

import type { SiteCard } from '~/sites/schema';

import type { Marks } from '../../logic/highlight';
import type { PickOptions } from '../../logic/picker';
import { EditorContext } from '../context';

/**
 * Renders editor views with a picker that "clicks" the queued elements in order (`undefined` cancels), applying the
 * view's `resolve` like the real one. A pick with nothing queued waits until its signal aborts.
 */
export function renderInEditor(
  view: () => JSX.Element,
  /**
   * What the first picks return, for views that pick as they open.
   */
  picks: (Element | undefined)[] = [],
) {
  const queue = [...picks];
  const [pageVersion, setPageVersion] = createSignal(0);
  const [picking, setPicking] = createSignal(false);
  let marks: Marks = {};
  const pick = mock(async (options: Omit<PickOptions, 'ignore'> = {}) => {
    setPicking(true);

    if (!queue.length) {
      return new Promise<undefined>((resolve) =>
        options.signal?.addEventListener('abort', () => {
          setPicking(false);
          resolve(undefined);
        }),
      );
    }

    const element = queue.shift();

    // The click comes after the view showed that it's waiting for it
    await new Promise((resolve) => setTimeout(resolve));
    setPicking(false);

    return element && (options.resolve ? options.resolve(element) : element)
      ? element
      : undefined;
  });
  const mark = mock((shown: Marks) => {
    marks = shown;

    return () => {
      if (marks === shown) marks = {};
    };
  });

  let pointed: Element[] = [];
  const point = mock((elements: Element[]) => {
    pointed = elements;
  });
  const result = render(() => (
    <EditorContext.Provider value={{ pick, picking, pageVersion, mark, point }}>
      {view()}
    </EditorContext.Provider>
  ));

  return {
    ...result,
    pick,
    mark,
    /**
     * What the view points out on the page now.
     */
    marks: () => marks,
    /**
     * What a setting outlines on the page now.
     */
    pointed: () => pointed,
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
export async function settle() {
  for (let tick = 0; tick < 3; tick++) {
    await new Promise((resolve) => setTimeout(resolve));
  }
}

/**
 * A grid of episode cards like the sites', each in a cell: a poster, the name, and the episode in Turkish.
 */
export function episodeGrid(
  entries: [title: string, episode: string][] = [
    ['Sousou no Frieren', '12. Bölüm'],
    ['Dandadan', '7. Bölüm'],
    ['Kusuriya no Hitorigoto', '2. Sezon 5. Bölüm'],
    ['Kaijuu 8-gou', '3. Bölüm'],
    ['Blue Lock', '2. Sezon 14. Bölüm'],
  ],
) {
  document.body.innerHTML = `<div class="episodes" style="display: grid; column-gap: 20px">${entries
    .map(
      ([title, episode]) =>
        `<div class="cell"><article class="card"><div class="poster"><img alt=""></div><h3>${title}</h3><span>${episode}</span></article></div>`,
    )
    .join('')}</div>`;

  return Array.from(document.querySelectorAll<HTMLElement>('article.card'));
}

export const cardSpec = (changes: Partial<SiteCard> = {}): SiteCard => ({
  selector: 'article.card',
  title: { selector: 'h3' },
  inject: { position: 'append' },
  ...changes,
});

/**
 * Chooses an option of a dropdown, the way the user does: opening it, then clicking the option.
 */
export function chooseOption(dropdown: HTMLElement, option: string | RegExp) {
  fireEvent.click(dropdown);
  fireEvent.click(screen.getByRole('option', { name: option }));
}
