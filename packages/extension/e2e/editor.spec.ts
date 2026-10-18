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

const editor = (page: Page) =>
  page.getByRole('dialog', { name: 'AniScore site editor' });

test('edits a site on the page, with a live preview, and saves it', async ({
  context,
  page,
  background,
  getStorage,
}) => {
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

  await openEditor(background);

  // It starts from the config in effect
  await expect(editor(page)).toContainText('AniScore · Anizm');
  await expect(editor(page).getByText('2 cards on this page')).toBeVisible();

  // Picking a title selects the cards around it
  await editor(page).getByRole('textbox', { name: 'Card selector' }).fill('');
  await expect(editor(page).getByText('0 cards on this page')).toBeVisible();
  await editor(page).getByRole('button', { name: 'Pick a card' }).click();
  await expect(
    editor(page).getByText('Click an element on the page'),
  ).toBeVisible();
  await page.getByRole('heading', { name: 'One Piece' }).click();
  await expect(editor(page).getByText('2 cards on this page')).toBeVisible();

  // The preview puts the details where the edited config says
  await editor(page)
    .getByRole('combobox', { name: 'Position' })
    .selectOption('before');
  await expect(page.locator('.v3-card-copy > .ani-score + h3')).toHaveCount(2);

  await editor(page).getByRole('tab', { name: 'Save' }).click();
  await editor(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor(page).getByRole('status')).toContainText(
    'Saved to your sites',
  );

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
                  selector: 'div.v3-latest-grid > article.v3-episode-card',
                  inject: { position: 'before' },
                },
              ],
            },
            expect.anything(),
          ],
        },
      },
    ]);

  // Closing hands the page back to AniScore, now with the saved config
  await editor(page).getByRole('button', { name: 'Close' }).click();
  await expect(editor(page)).toHaveCount(0);
  await expect(page.locator('.v3-card-copy > .ani-score + h3')).toHaveCount(2);
});
