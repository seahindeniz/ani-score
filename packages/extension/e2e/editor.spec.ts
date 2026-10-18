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

  await page.getByText('1120. Bölüm').click();
  await expect(
    setup(page).getByText('Read an episode on all 2 cards'),
  ).toBeVisible();
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
