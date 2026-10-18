import { createMutable } from 'solid-js/store';
import { render } from 'solid-js/web';

import type { AnimeDetails } from '~/background/logic/fetchDetails';
import type { EpisodeCard } from '~/contentScripts/sites/types';
import { createLogger } from '~/utils/logger';

import { CardDetail } from '../views/CardDetail/CardDetail';
import { createEncapsulatedContainer } from './createEncapsulatedContainer';
import { createStyle } from './createStyle';

// A site that keeps removing the details from an unchanged card won't win the fight forever
const maxReinjections = 3;

interface RenderedCard {
  container: HTMLElement;
  /**
   * What the card showed when it was rendered; sites that page in place reuse the card for another episode.
   */
  signature: string;
  reinjections: number;
  dispose: () => void;
}

const signatureOf = (card: EpisodeCard) =>
  `${card.title}\n${card.episodeNumber}`;

/**
 * Keeps the details of the cards on the page: `update` renders details into new cards and cards that now show
 * another episode, puts them back when the site removed them, and removes them from cards that are gone. Details are
 * fetched once per title (the background keeps them a while), and again for a card whose anime the user changed.
 */
export function createCardCustomizer(siteStyles: string) {
  const logger = createLogger('customizeCards');
  const store = createMutable({
    anime: {} as Record<string, AnimeDetails | null>,
  });
  const rendered = new Map<HTMLElement, RenderedCard>();
  const requestedTitles = new Set<string>();
  let initialized: Promise<unknown> | undefined;

  async function fetchDetails(cards: EpisodeCard[]) {
    const pending = cards.filter((card) => !requestedTitles.has(card.title));

    if (pending.length === 0) return;

    pending.forEach((card) => requestedTitles.add(card.title));
    logger.log('Fetching details for episode cards:', pending);

    initialized ??= window.messageGateway.sendMessage('initialize', null);
    await initialized;

    const animeMap = await window.messageGateway.sendMessage('fetch-details', {
      cards: pending.map(({ title, episodeNumber }) => ({
        title,
        episodeNumber,
      })),
    });

    if (!animeMap) {
      logger.log('No details fetched from background');
      return;
    }

    Object.assign(store.anime, animeMap);
  }

  // After the user changed the anime on AniList (e.g. made it a favourite), or opened its details
  async function refresh({ title, episodeNumber }: EpisodeCard) {
    const animeMap = await window.messageGateway.sendMessage('fetch-details', {
      cards: [{ title, episodeNumber }],
      fresh: true,
    });

    if (animeMap) Object.assign(store.anime, animeMap);
  }

  function renderCard(card: EpisodeCard, reinjections: number): RenderedCard {
    const { container, root, shadowDOM } = createEncapsulatedContainer();

    // The site's styles also reach into the details, as its stylesheet always has
    shadowDOM.append(createStyle(siteStyles));
    card.render(container);

    const dispose = render(
      () => (
        <CardDetail
          card={card}
          store={store}
          onRefresh={() => void refresh(card)}
        />
      ),
      root,
    );

    return {
      container,
      signature: signatureOf(card),
      reinjections,
      dispose: () => {
        dispose();
        container.remove();
        card.shimmeringElement?.classList.remove('ani-score-watching');
      },
    };
  }

  function update(cards: EpisodeCard[]) {
    const elements = new Set(cards.map((card) => card.element));
    const fresh: EpisodeCard[] = [];

    for (const [element, entry] of rendered) {
      if (!elements.has(element)) {
        entry.dispose();
        rendered.delete(element);
      }
    }

    for (const card of cards) {
      const entry = rendered.get(card.element);
      const unchanged = entry?.signature === signatureOf(card);

      if (
        entry
        && unchanged
        && (entry.container.isConnected
          || entry.reinjections >= maxReinjections)
      ) {
        continue;
      }

      entry?.dispose();
      rendered.set(
        card.element,
        renderCard(card, unchanged ? entry!.reinjections + 1 : 0),
      );
      fresh.push(card);
    }

    if (fresh.length) {
      logger.log('Customized episode cards:', fresh);
      fetchDetails(fresh).catch((error: unknown) => logger.error(error));
    }
  }

  return {
    update,
    dispose: () => update([]),
  };
}
