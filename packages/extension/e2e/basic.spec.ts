import { expect, test } from './fixtures';
import { mockNetwork } from './mocks';

test('side panel asks to authorize AniList', async ({ page, extensionId }) => {
  await page.goto(
    `chrome-extension://${extensionId}/dist/sidepanel/index.html`,
  );
  await expect(
    page.getByRole('button', { name: 'Sign in with AniList' }),
  ).toBeVisible();
});

test('side panel lets a signed-in viewer add genre colors', async ({
  context,
  page,
  extensionId,
  setStorage,
  getStorage,
}) => {
  await mockNetwork(context);
  await setStorage({ token: { anilist: 'test-token' } });
  await page.goto(
    `chrome-extension://${extensionId}/dist/sidepanel/index.html`,
  );

  await expect(
    page.getByRole('button', { name: 'Sign in with AniList' }),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tag colors' })).toBeVisible();

  await page.getByRole('button', { name: 'Add genre' }).click();

  // A new entry starts with the first genre from AniList's genre collection
  await expect
    .poll(() => getStorage('settings'))
    .toMatchObject({
      genreColor: [{ name: 'Action', color: '#ffffff' }],
    });
});

test('side panel signs the viewer out', async ({
  context,
  page,
  extensionId,
  setStorage,
  getStorage,
}) => {
  await mockNetwork(context);
  await setStorage({ token: { anilist: 'test-token' } });
  await page.goto(
    `chrome-extension://${extensionId}/dist/sidepanel/index.html`,
  );

  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(
    page.getByRole('button', { name: 'Sign in with AniList' }),
  ).toBeVisible();
  await expect.poll(() => getStorage('token')).toEqual({ anilist: '' });
});

test('popup page', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/dist/popup/index.html`);
  await expect(page.locator('button')).toHaveText('Open Options');
});

test('options page', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/dist/options/index.html`);
  await expect(page.locator('img')).toHaveAttribute('alt', 'extension icon');
});
