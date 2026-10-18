import { afterEach, describe, expect, it } from 'bun:test';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';

import type { AnimeDetails } from '~/background/logic/fetchDetails';

import { useRefStore } from '../../../store/refStore';
import { AnimeInfoCard } from '../AnimeInfo';

const longDescription = `A <i>long</i> journey<br>begins.\n${'Elves outlive everyone. '.repeat(10)}`;

function anime(overrides: Partial<AnimeDetails> = {}) {
  return {
    id: 154587,
    popularity: 250000,
    format: 'TV',
    status: 'NOT_YET_RELEASED',
    episodes: 28,
    season: 'FALL',
    seasonYear: 2023,
    description: longDescription,
    title: { userPreferred: 'Frieren', romaji: 'Sousou no Frieren' },
    coverImage: { large: 'https://img/cover.jpg', extraLarge: null },
    genres: ['Adventure', 'Fantasy'],
    tags: [
      { name: 'Elf', rank: 95 },
      { name: 'Magic', rank: null },
    ],
    relations: {
      edges: [
        {
          id: 1,
          relationType: 'SIDE_STORY',
          node: {
            siteUrl: 'https://anilist.co/anime/2',
            title: { userPreferred: 'Frieren Mini' },
            format: 'ONA',
            type: 'ANIME',
            coverImage: { large: 'https://img/mini.jpg' },
          },
        },
        {
          id: 2,
          relationType: null,
          node: {
            siteUrl: null,
            title: null,
            format: 'MANGA',
            type: 'MANGA',
            coverImage: null,
          },
        },
        { id: 3, relationType: 'SEQUEL', node: null },
      ],
    },
    characterPreview: {
      edges: [
        {
          role: 'MAIN',
          name: null,
          node: {
            siteUrl: 'https://anilist.co/character/1',
            name: { userPreferred: 'Frieren' },
            image: { large: 'https://img/frieren.jpg' },
          },
          voiceActors: [
            {
              siteUrl: 'https://anilist.co/staff/1',
              name: { userPreferred: 'Atsumi Tanezaki' },
              language: 'Japanese',
              image: { large: 'https://img/va.jpg' },
            },
          ],
        },
        {
          role: 'SUPPORTING',
          name: null,
          node: { siteUrl: null, name: null, image: null },
          voiceActors: [],
        },
        { role: 'BACKGROUND', name: null, node: null, voiceActors: null },
      ],
    },
    ...overrides,
  } as AnimeDetails;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function openPopover(trigger: HTMLElement) {
  fireEvent.mouseMove(trigger);
  await wait(550);
}

afterEach(() => {
  cleanup();
  useRefStore().activeAnimeInfoPopoverRef = null;
});

describe('anime info card', () => {
  it('links the popularity chip to AniList', () => {
    render(() => <AnimeInfoCard anime={anime()} />);

    const chip = screen.getByTitle('Popularity [Visit AniList]');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const bubbled: Event[] = [];

    document.addEventListener('click', (event) => bubbled.push(event));
    click.preventDefault();
    chip.dispatchEvent(click);

    expect(chip.getAttribute('href')).toBe('https://anilist.co/anime/154587');
    expect(chip.textContent).toContain('250,000');
    // Clicking the chip shouldn't toggle the card around it
    expect(bubbled).toHaveLength(0);
  });

  it('shows the details popover on hover', async () => {
    render(() => <AnimeInfoCard anime={anime()} />);

    await openPopover(screen.getByTitle('Popularity [Visit AniList]'));

    expect(
      screen.getByRole('heading', { name: 'Frieren', level: 3 }),
    ).toBeTruthy();
    expect(
      screen
        .getAllByAltText('Frieren')
        .map((image) => image.getAttribute('src')),
    ).toEqual(['https://img/cover.jpg', 'https://img/frieren.jpg']);
    expect(screen.getByText('Not Yet Released')).toBeTruthy();
    expect(screen.getByText('28 Episodes')).toBeTruthy();
    expect(screen.getByText('FALL 2023')).toBeTruthy();

    const description = screen.getByText(
      /^A long journey begins\./,
    ).textContent!;

    expect(description.length).toBe(183);
    expect(description.endsWith('...')).toBe(true);
    expect(screen.getByText('Adventure')).toBeTruthy();

    expect(
      screen.getByRole('button', { name: /Tags \(\s*2\s*\)/ }),
    ).toBeTruthy();
    expect(screen.getByText('95')).toBeTruthy();

    expect(
      screen.getByRole('button', { name: /Relations \(\s*3\s*\)/ }),
    ).toBeTruthy();
    expect(
      screen.getByText('Frieren Mini').closest('a')?.getAttribute('href'),
    ).toBe('https://anilist.co/anime/2');
    expect(screen.getByText('Side story')).toBeTruthy();
    expect(screen.getByText('ONA')).toBeTruthy();
    // An untitled relation links nowhere and shows its type once, since format matches
    expect(screen.getAllByText('MANGA')).toHaveLength(1);

    expect(
      screen.getByRole('button', { name: /Characters \(\s*3\s*\)/ }),
    ).toBeTruthy();
    expect(screen.getByText('MAIN')).toBeTruthy();
    expect(screen.getByText('Atsumi Tanezaki')).toBeTruthy();
    expect(
      screen.getByAltText('Atsumi Tanezaki').closest('a')?.getAttribute('href'),
    ).toBe('https://anilist.co/staff/1');
    expect(screen.getByText('SUPPORTING')).toBeTruthy();
  });

  it('keeps short descriptions and skips empty sections', async () => {
    render(() => (
      <AnimeInfoCard
        anime={anime({
          description: 'Short.',
          status: null,
          episodes: null,
          season: null,
          title: { userPreferred: null, romaji: null },
          coverImage: null,
          genres: [],
          tags: [],
          relations: { edges: [] },
          characterPreview: { edges: [] },
        })}
      />
    ));

    await openPopover(screen.getByTitle('Popularity [Visit AniList]'));

    expect(screen.getByText('Short.')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    expect(screen.queryByText(/Episodes/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Tags/ })).toBeNull();
  });

  it('treats a missing description as empty', async () => {
    render(() => (
      <AnimeInfoCard
        anime={anime({
          description: null,
          relations: null,
          characterPreview: null,
        })}
      />
    ));

    await openPopover(screen.getByTitle('Popularity [Visit AniList]'));

    expect(screen.getByRole('button', { name: /Tags/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Relations/ })).toBeNull();
  });

  it('keeps one popover open at a time and forgets it once closed', async () => {
    render(() => (
      <>
        <AnimeInfoCard anime={anime({ id: 1, popularity: 1 })} />
        <AnimeInfoCard
          anime={anime({
            id: 2,
            popularity: 2,
            title: { userPreferred: 'Second', romaji: null },
          })}
        />
      </>
    ));

    const [first, second] = screen.getAllByTitle('Popularity [Visit AniList]');

    await openPopover(first);
    expect(screen.getByRole('heading', { name: 'Frieren' })).toBeTruthy();
    expect(useRefStore().activeAnimeInfoPopoverRef).not.toBeNull();

    await openPopover(second);
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Frieren' })).toBeNull(),
    );
    expect(screen.getByRole('heading', { name: 'Second' })).toBeTruthy();

    fireEvent.click(document.body);
    await wait(250);

    expect(screen.queryByRole('heading', { name: 'Second' })).toBeNull();
    expect(useRefStore().activeAnimeInfoPopoverRef).toBeNull();
  });
});
