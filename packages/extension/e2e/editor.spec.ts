import type { Page, Worker } from '@playwright/test';

import { expect, test } from './fixtures';
import { anizmNewEpisodesPage, frieren, mockNetwork } from './mocks';

const newEpisodesURL = 'https://anizm.net/yeniler';

// What the context menu does; anizm.net is allowed from install, so the editor can be injected without a click
async function openEditor(background: Worker) {
  await background.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://anizm.net/*' });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      files: ['dist/contentScripts/editor/main.js'],
    });
  });
}

const alreadySetUp = (page: Page) =>
  page.getByRole('dialog', { name: 'anizm.net is already set up' });
const setup = (page: Page) =>
  page.getByRole('dialog', { name: 'AniScore setup' });
const editor = (page: Page) =>
  page.getByRole('dialog', { name: 'AniScore editor' });

test.beforeEach(async ({ context, page }) => {
  await mockNetwork(context, {
    media: [frieren],
    pages: {
      [newEpisodesURL]: anizmNewEpisodesPage([
        { title: 'Sousou no Frieren', episode: 5 },
        { title: 'One Piece', episode: 1120 },
      ]),
    },
  });
  await page.goto(newEpisodesURL);
  await expect(page.locator('.v3-card-copy > .ani-score')).toHaveCount(2);
});

test('edits the setup a site has, with a live preview, and saves it', async ({
  page,
  background,
  getStorage,
}) => {
  await openEditor(background);

  // The site comes with a setup, so it asks what to do first
  await expect(alreadySetUp(page)).toContainText(
    'AniScore comes with a setup for this site',
  );
  await alreadySetUp(page)
    .getByRole('button', { name: /^Edit the setup/ })
    .click();

  await expect(editor(page)).toContainText("AniScore's built-in setup");
  await expect(
    editor(page).getByRole('button', { name: /Episode cards/ }),
  ).toContainText('2 on this page');

  // The preview puts the details where the edited setup says
  await editor(page)
    .getByRole('button', { name: /Score position/ })
    .click();
  await editor(page).getByText('Above the name').click();
  await expect(page.locator('.v3-card-copy > .ani-score + h3')).toHaveCount(2);
  await expect(editor(page).getByRole('status')).toHaveText(
    'Unsaved changes, shown on the page',
  );

  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor(page).getByRole('status')).toHaveText('Saved');

  await expect
    .poll(() => getStorage<{ config: { pages: unknown[] } }[]>('userSites'))
    .toMatchObject([
      {
        config: {
          id: 'anizm',
          pages: [
            {
              cards: [
                {
                  inject: { selector: '.v3-card-copy h3', position: 'before' },
                },
              ],
            },
            expect.anything(),
          ],
        },
      },
    ]);

  // Closing hands the page back to AniScore, now with the saved setup
  await editor(page).getByRole('button', { name: 'Close' }).click();
  await expect(editor(page)).toHaveCount(0);
  await expect(page.locator('.v3-card-copy > .ani-score + h3')).toHaveCount(2);
});

test('sets a site up again, one step at a time', async ({
  page,
  background,
  getStorage,
}) => {
  await openEditor(background);
  await alreadySetUp(page)
    .getByRole('button', { name: /^Start from scratch/ })
    .click();

  const next = () => setup(page).getByRole('button', { name: 'Next' }).click();

  // Each step waits for a click on the page
  await expect(setup(page)).toContainText('Find the episode cards');
  await expect(setup(page)).toContainText('Waiting for your click on the page');
  await page.getByRole('heading', { name: 'One Piece' }).click();
  await expect(setup(page).getByText('Found 2 cards')).toBeVisible();
  await next();

  await expect(setup(page)).toContainText("Pick the anime's name");
  await page.getByRole('heading', { name: 'One Piece' }).click();
  await expect(
    setup(page).getByText('Read a name on all 2 cards'),
  ).toBeVisible();
  await next();

  // It found the episode, so there's nothing to click
  await expect(
    setup(page).getByText('Read an episode on all 2 cards'),
  ).toBeVisible();
  await next();

  await expect(setup(page)).toContainText('AniScore found no season');
  await next();

  // The score goes under the name, and shows on the page
  await expect(setup(page)).toContainText('Choose where the score goes');
  await expect(page.locator('.v3-card-copy > h3 + .ani-score')).toHaveCount(2);
  await next();
  await setup(page).getByRole('button', { name: 'Skip' }).click();
  await setup(page).getByRole('button', { name: 'Skip' }).click();

  await expect(setup(page)).toContainText('Check and save');
  await setup(page).getByRole('button', { name: 'Save' }).click();
  await expect(setup(page)).toContainText('anizm.net is set up');

  await expect
    .poll(() => getStorage<{ config: unknown }[]>('userSites'))
    .toMatchObject([
      {
        config: {
          id: 'anizm',
          pages: [
            {
              match: { path: '^/yeniler$' },
              cards: [
                {
                  selector: 'div.v3-latest-grid > article.v3-episode-card',
                  title: { selector: 'h3' },
                  episode: { selector: 'span' },
                  inject: { selector: 'h3', position: 'after' },
                },
              ],
            },
          ],
        },
      },
    ]);

  await setup(page).getByRole('button', { name: 'Done' }).click();
  await expect(setup(page)).toHaveCount(0);
  await expect(page.locator('.v3-card-copy > h3 + .ani-score')).toHaveCount(2);
});

test('reads the name alone from a line that also holds the season and the episode', async ({
  context,
  page,
  background,
  getStorage,
}) => {
  const url = 'https://anizm.net/son-bolumler';
  const entries = [
    ['Tensei Kizoku, Kantei Skill de Nariagaru', '3.Sezon', '4.Bölüm izle'],
    ['Vertex Force', '', '3.Bölüm Türkçe'],
  ];

  const recorded = await mockNetwork(context, {
    media: [frieren],
    pages: {
      [url]: `<!doctype html><html><head><meta charset="utf-8"><title>Site</title></head><body><div class="list">${entries
        .map(([name, season, episode]) => {
          const full = [name, season].filter(Boolean).join(' ');

          return `<div class="item"><b>${full}</b><small>${full} ${episode}</small></div>`;
        })
        .join('')}</div></body></html>`,
    },
  });
  await page.goto(url);
  await openEditor(background);
  await alreadySetUp(page)
    .getByRole('button', { name: /^Start from scratch/ })
    .click();

  const next = () => setup(page).getByRole('button', { name: 'Next' }).click();
  const line = page.getByText('Vertex Force 3.Bölüm Türkçe');

  await line.click();
  await next();

  // The line holds more than the name, so it suggests the name alone
  await line.click();
  await expect(setup(page)).toContainText('This text holds more than the name');
  await expect(
    setup(page).getByRole('radio', {
      name: /^Tensei Kizoku, Kantei Skill de Nariagaru/,
    }),
  ).toBeChecked();
  await next();

  // The episode comes from the same line, the season from the name above it
  await expect(
    setup(page).getByText('Read an episode on all 2 cards'),
  ).toBeVisible();
  await next();
  await expect(
    setup(page).getByRole('radio', { name: /^Season 3, on 1 of 2 cards/ }),
  ).toBeChecked();

  for (const step of ['season', 'placement', 'colors', 'highlight']) {
    await expect(setup(page), step).toBeVisible();
    await next();
  }

  await setup(page).getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() =>
      getStorage<{ config: { pages: { cards: unknown[] }[] } }[]>('userSites'),
    )
    .toMatchObject([
      {
        config: {
          pages: [
            {
              cards: [
                {
                  title: { selector: 'small', steps: [expect.anything()] },
                  episode: { selector: 'small' },
                  season: { selector: 'b' },
                },
              ],
            },
          ],
        },
      },
    ]);

  // AniList is searched by the name alone (the other name matches the offline database, so it goes by id)
  await expect(page.locator('.item .ani-score')).toHaveCount(2);
  await expect
    .poll(() => recorded.lookups.map(({ value }) => value))
    .toContain('Vertex Force');
  expect(
    recorded.lookups.filter(({ value }) =>
      /Bölüm|Sezon|izle|Türkçe/.test(value),
    ),
  ).toEqual([]);
});
