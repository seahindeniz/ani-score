import { expect, test } from './fixtures';
import { anizmNewEpisodesPage, frieren, mockNetwork } from './mocks';

const newEpisodesURL = 'https://anizm.net/yeniler';

// Anizm's config, but with the details inside the poster rather than after the title
const editedAnizm = {
  schemaVersion: 1,
  id: 'anizm',
  name: 'Anizm (edited)',
  matches: ['*://anizm.net/*'],
  theme: 'dark',
  pages: [
    {
      match: { path: '^/yeniler$' },
      cards: [
        {
          selector: '.v3-latest-grid > article.v3-episode-card',
          title: { selector: '.v3-card-copy h3' },
          episode: {
            selector: '.v3-card-copy span',
            steps: [{ match: '(\\d+)' }],
          },
          inject: { selector: '.v3-poster-frame', position: 'append' },
        },
      ],
    },
  ],
};

test("follows the user's edited config, also when it changes on an open page", async ({
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

  await page.goto(newEpisodesURL);

  // The built-in config puts the details after the title
  await expect(
    page.locator('.v3-card-copy > .ani-score').getByTitle('Add Favorite'),
  ).toHaveText('1234');

  await setStorage({ userSites: [{ config: editedAnizm, savedAt: 1 }] });

  await expect(
    page.locator('.v3-poster-frame > .ani-score').getByTitle('Add Favorite'),
  ).toHaveText('1234');
  // Moved, not added
  await expect(page.locator('.v3-episode-card .ani-score')).toHaveCount(1);

  // And it applies from the start on the next visit
  await page.reload();

  await expect(
    page.locator('.v3-poster-frame > .ani-score').getByTitle('Add Favorite'),
  ).toHaveText('1234');
});

test('side panel imports a setup, to be turned on', async ({
  page,
  extensionId,
  getStorage,
}) => {
  const config = { ...editedAnizm, id: 'kitsune', name: 'Kitsune' };

  config.matches = ['*://kitsune.me/*'];

  await page.goto(
    `chrome-extension://${extensionId}/dist/sidepanel/index.html`,
  );

  const anizm = page.locator('[data-site="anizm"]');

  await expect(anizm).toContainText('Always on');

  await page.getByRole('button', { name: 'Import a setup' }).click();
  await page.getByLabel('Site setup').fill(JSON.stringify(config));
  await page.getByRole('button', { name: 'Import', exact: true }).click();

  await expect(page.getByRole('status')).toHaveText(
    'Imported Kitsune. Turn it on to allow it on kitsune.me.',
  );

  const kitsune = page.locator('[data-site="kitsune"]');

  await expect(kitsune).toContainText('Yours');
  // Off until the user adds it, which the dropdown offers
  await expect(
    page
      .getByRole('region', { name: 'Your setups that are off' })
      .locator(kitsune),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Add a site/ }).click();
  await expect(page.getByRole('option', { name: /^Kitsune/ })).toBeVisible();
  await expect
    .poll(() => getStorage('userSites'))
    .toEqual([{ config, savedAt: expect.any(Number) }]);
});

test('side panel opens the editor on the site, switching to its tab', async ({
  context,
  page,
  extensionId,
}) => {
  await mockNetwork(context, {
    media: [frieren],
    pages: {
      [newEpisodesURL]: anizmNewEpisodesPage([
        { title: 'Sousou no Frieren', episode: 5 },
      ]),
    },
  });
  await page.goto(newEpisodesURL);

  const panel = await context.newPage();

  await panel.goto(
    `chrome-extension://${extensionId}/dist/sidepanel/index.html`,
  );
  await panel.getByRole('button', { name: 'Edit Anizm' }).click();

  await expect(
    page.getByRole('dialog', { name: 'anizm.net is already set up' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.visibilityState)).toBe('visible');
});
