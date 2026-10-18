import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { anizmNewEpisodesPage, frieren, mockNetwork } from './mocks';

const newEpisodesURL = 'https://anizm.net/yeniler';

function episodeCard(page: Page, title: string) {
  return page.locator('article.v3-episode-card', {
    has: page.locator('h3', { hasText: title }),
  });
}

function cardDetails(page: Page, title: string) {
  return episodeCard(page, title).locator('.ani-score');
}

test('shows AniList details on new episode cards', async ({
  context,
  page,
}) => {
  const recorded = await mockNetwork(context, {
    media: [frieren],
    pages: {
      [newEpisodesURL]: anizmNewEpisodesPage([
        { title: 'Sousou no Frieren', episode: 5 },
      ]),
    },
  });

  await page.goto(newEpisodesURL);

  const details = cardDetails(page, 'Sousou no Frieren');

  await expect(details.getByTitle('Add Favorite')).toHaveText('1234');
  await expect(details.getByTitle('Popularity [Visit AniList]')).toContainText(
    '250,000',
  );
  await expect(
    details.getByTitle('Popularity [Visit AniList]'),
  ).toHaveAttribute('href', 'https://anilist.co/anime/154587');
  await expect(details.getByTitle('Trending')).toHaveCount(0);
  await expect(details.getByTitle('Watching')).toHaveCount(0);

  for (const genre of ['Adventure', 'Drama', 'Fantasy'])
    await expect(details.getByText(genre, { exact: true })).toBeVisible();

  // Only the top five tags are shown
  for (const tag of ['Elf', 'Magic', 'Travel', 'Time Skip', 'Iyashikei'])
    await expect(details.getByText(tag, { exact: true })).toBeVisible();
  await expect(details.getByText('Female Protagonist')).toHaveCount(0);

  // The title was matched to its AniList ID through the anime database
  expect(recorded.lookups).toEqual([
    { alias: 'a_1_sousou_no_frieren', by: 'id', value: '154587' },
  ]);
});

test('shows "Not Found" for anime that neither the database nor AniList know', async ({
  context,
  page,
}) => {
  const recorded = await mockNetwork(context, {
    pages: {
      [newEpisodesURL]: anizmNewEpisodesPage([
        { title: 'Totally Unlisted Anime', episode: 1 },
      ]),
    },
  });

  await page.goto(newEpisodesURL);

  await expect(cardDetails(page, 'Totally Unlisted Anime')).toHaveText(
    'Not Found',
  );
  // Titles missing from the database fall back to AniList's search
  expect(recorded.lookups).toEqual([
    {
      alias: 'a_1_totally_unlisted_anime',
      by: 'search',
      value: 'Totally Unlisted Anime',
    },
  ]);
});

test('highlights anime the signed-in viewer is watching', async ({
  context,
  page,
  setStorage,
}) => {
  const recorded = await mockNetwork(context, {
    media: [{ ...frieren, progress: 5 }],
    pages: {
      [newEpisodesURL]: anizmNewEpisodesPage([
        { title: 'Sousou no Frieren', episode: 5 },
      ]),
    },
  });

  await setStorage({ token: { anilist: 'test-token' } });
  await page.goto(newEpisodesURL);

  const card = episodeCard(page, 'Sousou no Frieren');

  await expect(card.locator('.ani-score').getByTitle('Watching')).toContainText(
    '5/ 28',
  );
  await expect(card.locator('.v3-poster-frame')).toHaveClass(
    /\bani-score-watching\b/,
  );
  expect(recorded.authorizations).toContain('Bearer test-token');
});

test('toggles the anime as a favorite on AniList', async ({
  context,
  page,
  setStorage,
}) => {
  const recorded = await mockNetwork(context, {
    media: [frieren],
    pages: {
      [newEpisodesURL]: anizmNewEpisodesPage([
        { title: 'Sousou no Frieren', episode: 5 },
      ]),
    },
  });

  await setStorage({ token: { anilist: 'test-token' } });
  await page.goto(newEpisodesURL);

  const details = cardDetails(page, 'Sousou no Frieren');

  await details.getByTitle('Add Favorite').click();
  await expect(details.getByTitle('Remove Favorite')).toHaveText('1235');

  await details.getByTitle('Remove Favorite').click();
  await expect(details.getByTitle('Add Favorite')).toHaveText('1234');

  expect(recorded.favoriteToggles).toEqual([frieren.id, frieren.id]);
});

test('colors genres and tags as configured in the side panel', async ({
  context,
  page,
  setStorage,
}) => {
  await mockNetwork(context, {
    media: [frieren],
    pages: {
      [newEpisodesURL]: anizmNewEpisodesPage([
        { title: 'Sousou no Frieren', episode: 5 },
      ]),
    },
  });

  await setStorage({
    settings: {
      genreColor: [{ id: 'genre', name: 'Fantasy', color: '#ff0000' }],
      // Tag names are matched in lower case
      tagColor: [{ id: 'tag', name: 'magic', color: '#00ff00' }],
    },
  });
  await page.goto(newEpisodesURL);

  const details = cardDetails(page, 'Sousou no Frieren');

  await expect(details.getByText('Fantasy', { exact: true })).toHaveCSS(
    'color',
    'rgb(255, 0, 0)',
  );
  await expect(details.getByText('Magic', { exact: true })).toHaveCSS(
    'color',
    'rgb(0, 255, 0)',
  );
});

test('loads the fallback anime database when the preferred source is down', async ({
  context,
  page,
}) => {
  const recorded = await mockNetwork(context, {
    media: [frieren],
    primaryDatabaseDown: true,
    pages: {
      [newEpisodesURL]: anizmNewEpisodesPage([
        { title: 'Sousou no Frieren', episode: 5 },
      ]),
    },
  });

  await page.goto(newEpisodesURL);

  await expect(
    cardDetails(page, 'Sousou no Frieren').getByTitle('Add Favorite'),
  ).toHaveText('1234');
  expect(recorded.databaseDownloads).toEqual([
    expect.stringContaining('athanasso/anime-offline-database'),
  ]);
  expect(recorded.lookups).toEqual([
    expect.objectContaining({ by: 'id', value: '154587' }),
  ]);
});

test('leaves pages that are not episode listings alone', async ({
  context,
  page,
}) => {
  const animePageURL = 'https://anizm.net/sousou-no-frieren';
  const recorded = await mockNetwork(context, {
    media: [frieren],
    pages: {
      [animePageURL]: anizmNewEpisodesPage([
        { title: 'Sousou no Frieren', episode: 5 },
      ]),
    },
  });

  await page.goto(animePageURL);
  // Give the content scripts time to run; nothing observable happens when they skip a page
  await page.waitForTimeout(2000);

  await expect(page.locator('.ani-score')).toHaveCount(0);
  expect(recorded.lookups).toEqual([]);
});

test('asks to sign in on the toolbar badge again after signing out', async ({
  context,
  page,
  background,
  extensionId,
  setStorage,
}) => {
  await mockNetwork(context, {
    media: [frieren],
    pages: {
      [newEpisodesURL]: anizmNewEpisodesPage([
        { title: 'Sousou no Frieren', episode: 5 },
      ]),
    },
  });
  await setStorage({ token: { anilist: 'test-token' } });

  // Visiting a supported site starts the background's work, including the badge
  await page.goto(newEpisodesURL);
  await expect(
    cardDetails(page, 'Sousou no Frieren').getByTitle('Add Favorite'),
  ).toHaveText('1234');

  const badge = async () =>
    (await background.evaluate(() => chrome.action.getBadgeText({}))).trim();

  await expect.poll(badge).toBe('');

  const sidePanel = await context.newPage();

  await sidePanel.goto(
    `chrome-extension://${extensionId}/dist/sidepanel/index.html`,
  );
  await sidePanel.getByRole('button', { name: 'Sign out of AniList' }).click();

  await expect.poll(badge).toBe('Login');
});
