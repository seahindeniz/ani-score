import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { createMutable } from 'solid-js/store';

import type { AnimeDetails } from '~/background/logic/fetchDetails';
import type { EpisodeCard } from '~/contentScripts/sites/types';
import { useSettingsStore } from '~/logic';

import { CardDetail } from '../CardDetail';

const sendMessage = mock(
  async (_name: string, _data: unknown): Promise<unknown> => ({}),
);

function anime(overrides: Partial<AnimeDetails> = {}) {
  return {
    id: 1,
    favourites: 10,
    isFavourite: false,
    popularity: null,
    genres: [],
    tags: [],
    episodes: 12,
    mediaListEntry: null,
    nextAiringEpisode: null,
    startDate: null,
    ...overrides,
  } as AnimeDetails;
}

function setup(
  details: AnimeDetails | null | undefined,
  { withShimmer = true, onRefresh = mock() } = {},
) {
  const shimmering = document.createElement('div');
  const card: EpisodeCard = {
    element: document.createElement('article'),
    render: () => {},
    title: 'Frieren',
    episodeNumber: 1,
    shimmeringElement: withShimmer ? shimmering : null,
  };
  const store = createMutable({
    anime: details === undefined ? {} : { Frieren: details },
  }) as {
    anime: Record<string, AnimeDetails>;
  };
  render(() => <CardDetail card={card} store={store} onRefresh={onRefresh} />);

  return { store, shimmering, onRefresh };
}

beforeEach(() => {
  Object.assign(window, { messageGateway: { sendMessage } });
  sendMessage.mockReset();
  sendMessage.mockImplementation(async () => ({}));
  useSettingsStore().setData({ genreColor: [], tagColor: [] });
});

afterEach(cleanup);

describe('card detail', () => {
  it('shows a spinner until details arrive', async () => {
    const { store } = setup(undefined);

    expect(screen.queryByText('Not Found')).toBeNull();
    expect(document.querySelector('[part="container"] svg')).toBeTruthy();

    store.anime = { Frieren: anime() };

    expect(await screen.findByTitle('Add Favorite')).toBeTruthy();
  });

  it('says when the anime was not found', () => {
    setup(null);

    expect(screen.getByText('Not Found')).toBeTruthy();
  });

  it('shows favourites, trending, watching progress, genres and top tags with configured colors', () => {
    useSettingsStore().setData({
      genreColor: [
        { id: 'a', name: 'Fantasy', color: '#ff0000' },
        { id: 'b', name: '', color: '#00ff00' },
      ],
      // The older record shape is still read
      tagColor: { c: { name: 'magic', color: '#0000ff' } },
    });

    const { shimmering } = setup(
      anime({
        favourites: 5000,
        startDate: {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          day: new Date().getDate(),
        },
        mediaListEntry: { progress: 3 },
        episodes: 12,
        nextAiringEpisode: { episode: 14 },
        popularity: 1234,
        genres: ['Fantasy', 'Drama'],
        tags: [
          { name: 'Magic', rank: 90 },
          null,
          { name: 'Elf', rank: 80 },
          { name: 'Travel', rank: 70 },
          { name: 'Time Skip', rank: 60 },
          { name: 'Iyashikei', rank: 50 },
          { name: 'Female Protagonist', rank: 40 },
        ],
      }),
    );

    expect(screen.getByTitle('Add Favorite').textContent).toBe('5000');
    expect(screen.getByTitle('Trending').textContent).toBe('Trending');
    expect(screen.getByTitle('Watching').textContent).toBe('3/14');
    expect(
      screen.getByTitle('Popularity [Visit AniList]').textContent,
    ).toContain('1.2K');
    expect(screen.getByText('Fantasy').style.color).toBe('#ff0000');
    expect(screen.getByText('Drama').style.color).toBe('');
    expect(screen.getByText('Magic').style.color).toBe('#0000ff');
    expect(screen.getByText('Iyashikei')).toBeTruthy();
    expect(screen.queryByText('Female Protagonist')).toBeNull();
    expect(shimmering.classList.contains('ani-score-watching')).toBe(true);
  });

  it('leaves out what the details lack', () => {
    const { shimmering } = setup(anime({ favourites: null, episodes: null }));

    expect(screen.queryByTitle('Add Favorite')).toBeNull();
    expect(screen.queryByTitle('Trending')).toBeNull();
    expect(screen.queryByTitle('Watching')).toBeNull();
    expect(screen.queryByTitle('Popularity [Visit AniList]')).toBeNull();
    expect(shimmering.classList.contains('ani-score-watching')).toBe(false);
  });

  it('counts unreleased episodes as zero', () => {
    setup(anime({ mediaListEntry: { progress: 0 }, episodes: null }));

    expect(screen.getByTitle('Watching').textContent).toBe('0/0');
  });

  it('works on pages without a shimmering element', () => {
    setup(anime({ mediaListEntry: { progress: 1 } }), { withShimmer: false });

    expect(screen.getByTitle('Watching')).toBeTruthy();
  });

  it('toggles the favorite through the background', async () => {
    setup(anime());

    fireEvent.click(screen.getByTitle('Add Favorite'));
    expect(sendMessage).toHaveBeenCalledWith('make-anime-favorite', 1);

    const remove = await screen.findByTitle('Remove Favorite');

    expect(remove.textContent).toBe('11');

    fireEvent.mouseEnter(remove.parentElement!);
    expect(screen.getByTitle('Remove Favorite')).toBeTruthy();
    fireEvent.mouseLeave(remove.parentElement!);

    fireEvent.click(remove);

    expect((await screen.findByTitle('Add Favorite')).textContent).toBe('10');
  });

  it("asks for AniList's details again after a toggle, which replace the count it kept", async () => {
    const { store, onRefresh } = setup(anime());

    fireEvent.click(screen.getByTitle('Add Favorite'));

    expect((await screen.findByTitle('Remove Favorite')).textContent).toBe(
      '11',
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);

    store.anime.Frieren = anime({ isFavourite: true, favourites: 11 });

    expect(screen.getByTitle('Remove Favorite').textContent).toBe('11');
  });

  it('asks for the details again when the user opens them, unless they were asked for just now', async () => {
    const { onRefresh } = setup(anime({ popularity: 250_000 }));

    fireEvent.mouseMove(screen.getByTitle('Popularity [Visit AniList]'));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1), {
      timeout: 1000,
    });
    expect(onRefresh).toHaveBeenCalledWith(60_000);
  });

  it('starts as a favorite when AniList says so', () => {
    setup(anime({ isFavourite: true }));

    expect(screen.getByTitle('Remove Favorite')).toBeTruthy();
  });

  it('keeps the favorite state when AniList returns an error', async () => {
    sendMessage.mockImplementation(async () => ({
      error: new Error('Invalid token'),
    }));
    setup(anime());

    fireEvent.click(screen.getByTitle('Add Favorite'));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(screen.getByTitle('Add Favorite').textContent).toBe('10');
  });

  it('ignores clicks while a toggle is in flight or without an id', async () => {
    let resolve!: (value: unknown) => void;

    sendMessage.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    setup(anime());

    fireEvent.click(screen.getByTitle('Add Favorite'));
    fireEvent.click(screen.getByTitle('Add Favorite'));
    expect(sendMessage).toHaveBeenCalledTimes(1);

    resolve({});
    await screen.findByTitle('Remove Favorite');

    cleanup();
    sendMessage.mockClear();
    setup(anime({ id: null as unknown as number }));
    fireEvent.click(screen.getByTitle('Add Favorite'));
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
