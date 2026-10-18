import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

import type { EpisodeCard } from '~/contentScripts/sites/types';
import { wait } from '~/utils/wait';

import { createCardCustomizer } from '../customizeCards';

function episodeCard(
  title: string,
  episodeNumber: number,
  element = document.createElement('article'),
): EpisodeCard {
  document.body.append(element);

  return {
    element,
    title,
    episodeNumber,
    render: (container) => element.append(container),
    shimmeringElement: element,
  };
}

function setUp(fetchDetails: unknown) {
  const sendMessage = mock(async (id: string) =>
    id === 'fetch-details' ? fetchDetails : undefined,
  );

  window.messageGateway = {
    sendMessage,
  } as unknown as typeof window.messageGateway;

  return { sendMessage, customizer: createCardCustomizer('.site {}') };
}

const shadowOf = (card: EpisodeCard) =>
  card.element.querySelector('.ani-score')!.shadowRoot!;

describe('createCardCustomizer', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'messageGateway');
  });

  it('renders details into each card with the engagement and site styles', () => {
    const frieren = episodeCard('Frieren', 5);
    const { customizer } = setUp({});

    customizer.update([frieren]);

    expect(
      Array.from(
        shadowOf(frieren).querySelectorAll('style'),
        (style) => style.textContent,
      ),
    ).toEqual(['__ANI_SCORE_INLINE_CSS__', '.site {}']);
    customizer.dispose();
  });

  it('tries a failed request again, a few times, and starts the background over if that failed', async () => {
    const frieren = episodeCard('Frieren', 5);
    // The background's answers in turn: a failed start, a start, no details, then the details
    const answers: (() => unknown)[] = [
      () => {
        throw new Error('Restarting');
      },
      () => undefined,
      () => undefined,
      () => ({ Frieren: { id: 1, favourites: 10, isFavourite: false } }),
    ];
    const sendMessage = mock(async (_id: string) => answers.shift()!());

    window.messageGateway = {
      sendMessage,
    } as unknown as typeof window.messageGateway;

    const customizer = createCardCustomizer('', { retryDelay: 5 });

    customizer.update([frieren]);
    await wait(60);

    expect(sendMessage.mock.calls.map(([id]) => id)).toEqual([
      'initialize',
      'initialize',
      'fetch-details',
      'fetch-details',
    ]);
    expect(
      shadowOf(frieren).querySelector('[title="Add Favorite"]')!.textContent,
    ).toBe('10');
    customizer.dispose();
  });

  it('gives up after a few tries, and stops trying once disposed', async () => {
    const { sendMessage } = setUp(undefined);
    // Other test files' cards may retry through the same gateway, so this counts only its own titles
    const requestsFor = (title: string) =>
      sendMessage.mock.calls.filter(
        (call) =>
          call[0] === 'fetch-details'
          && JSON.stringify(call[1 as never]).includes(title),
      ).length;
    const retrying = createCardCustomizer('', { retryDelay: 5 });

    retrying.update([episodeCard('Given up', 1)]);
    await wait(120);

    // One request, then three more
    expect(requestsFor('Given up')).toBe(4);
    retrying.dispose();

    const disposed = createCardCustomizer('', { retryDelay: 20 });

    disposed.update([episodeCard('Disposed', 1)]);
    await wait(5);
    disposed.dispose();
    await wait(100);

    expect(requestsFor('Disposed')).toBe(1);
  });

  it("asks the background for every card's details once", async () => {
    const cards = [episodeCard('Frieren', 5), episodeCard('Dandadan', 12)];
    const { sendMessage, customizer } = setUp({
      Frieren: null,
      Dandadan: null,
    });

    customizer.update(cards);
    customizer.update(cards);
    await wait(10);

    expect(sendMessage.mock.calls).toEqual([
      ['initialize', null],
      [
        'fetch-details',
        {
          cards: [
            { title: 'Frieren', episodeNumber: 5 },
            { title: 'Dandadan', episodeNumber: 12 },
          ],
        },
      ],
    ] as unknown as typeof sendMessage.mock.calls);
    customizer.dispose();
  });

  it('only asks for the titles it has not asked for yet', async () => {
    const frieren = episodeCard('Frieren', 5);
    const { sendMessage, customizer } = setUp({});

    customizer.update([frieren]);
    await wait(10);
    customizer.update([
      frieren,
      episodeCard('Frieren', 6),
      episodeCard('Dandadan', 12),
    ]);
    await wait(10);

    expect(sendMessage.mock.calls.slice(2)).toEqual([
      ['fetch-details', { cards: [{ title: 'Dandadan', episodeNumber: 12 }] }],
    ] as unknown as typeof sendMessage.mock.calls);
    customizer.dispose();
  });

  it('shows the fetched details', async () => {
    const frieren = episodeCard('Frieren', 5);
    const { customizer } = setUp({ Frieren: null });

    customizer.update([frieren]);
    await wait(10);

    expect(shadowOf(frieren).textContent).toContain('Not Found');
    customizer.dispose();
  });

  it('asks again past what the background keeps after the user made the anime a favorite', async () => {
    const frieren = episodeCard('Frieren', 5);
    const details = { id: 1, favourites: 10, isFavourite: false };
    const { customizer, sendMessage } = setUp({ Frieren: details });

    customizer.update([frieren]);
    await wait(10);

    const favorite = shadowOf(frieren).querySelector<HTMLElement>(
      '[title="Add Favorite"]',
    )!;

    sendMessage.mockImplementation(async (id: string) =>
      id === 'fetch-details'
        ? { Frieren: { ...details, favourites: 11, isFavourite: true } }
        : {},
    );
    favorite.click();
    await wait(10);

    expect(sendMessage).toHaveBeenLastCalledWith('fetch-details', {
      cards: [{ title: 'Frieren', episodeNumber: 5 }],
      maxAge: 0,
    });
    expect(
      shadowOf(frieren).querySelector('[title="Remove Favorite"]')!.textContent,
    ).toBe('11');

    // Nothing to show when the background has no answer
    sendMessage.mockImplementation(async () => undefined);
    shadowOf(frieren)
      .querySelector<HTMLElement>('[title="Remove Favorite"]')!
      .click();
    await wait(10);

    customizer.dispose();
  });

  it('keeps waiting when the background has no answer', async () => {
    const frieren = episodeCard('Frieren', 5);
    const { customizer } = setUp(undefined);

    customizer.update([frieren]);
    await wait(10);

    expect(shadowOf(frieren).textContent).not.toContain('Not Found');
    customizer.dispose();
  });

  it('logs a failed request', async () => {
    const error = spyOn(console, 'error').mockImplementation(() => {});
    const { sendMessage, customizer } = setUp({});

    sendMessage.mockImplementation(async () => {
      throw new Error('Extension context invalidated.');
    });
    customizer.update([episodeCard('Frieren', 5)]);
    await wait(10);

    expect(error).toHaveBeenCalled();
    error.mockRestore();
    customizer.dispose();
  });

  it('renders again when a card shows another episode', () => {
    const element = document.createElement('article');
    const { customizer } = setUp({});

    customizer.update([episodeCard('Frieren', 5, element)]);

    const before = element.querySelector('.ani-score')!;

    customizer.update([episodeCard('Frieren', 6, element)]);

    expect(before.isConnected).toBe(false);
    expect(element.querySelectorAll('.ani-score')).toHaveLength(1);
    customizer.dispose();
  });

  it('removes the details and the shimmer of cards that are gone', () => {
    const frieren = episodeCard('Frieren', 5);
    const { customizer } = setUp({});

    customizer.update([frieren]);
    frieren.element.classList.add('ani-score-watching');
    customizer.update([]);

    expect(frieren.element.querySelector('.ani-score')).toBeNull();
    expect(frieren.element.classList.contains('ani-score-watching')).toBe(
      false,
    );
  });

  it('puts removed details back up to three times', () => {
    const frieren = episodeCard('Frieren', 5);
    const { customizer } = setUp({});

    customizer.update([frieren]);

    for (let removal = 1; removal <= 4; removal++) {
      frieren.element.querySelector('.ani-score')!.remove();
      customizer.update([frieren]);

      expect(frieren.element.querySelectorAll('.ani-score')).toHaveLength(
        removal <= 3 ? 1 : 0,
      );
    }

    customizer.dispose();
  });

  it('removes all details when disposed', () => {
    const frieren = episodeCard('Frieren', 5);
    const { customizer } = setUp({});

    customizer.update([frieren]);
    customizer.dispose();

    expect(frieren.element.querySelector('.ani-score')).toBeNull();
  });
});
