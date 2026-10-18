import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import {
  apothecaryDiaries,
  apothecaryDiariesSeason3,
  mockNetwork,
  tranimeizleHomePage,
} from './mocks';

const homeURL = 'https://www.tranimeizle.live/';

function cardDetails(page: Page, text: string) {
  return page
    .locator('.flx-block', { has: page.locator('h4', { hasText: text }) })
    .locator('.ani-score');
}

test('matches Turkish season titles to the right database entry', async ({
  context,
  page,
}) => {
  const recorded = await mockNetwork(context, {
    media: [apothecaryDiaries, apothecaryDiariesSeason3],
    pages: {
      [homeURL]: tranimeizleHomePage(
        [
          'The Apothecary Diaries 3. Sezon 3. Bölüm İzle',
          'The Apothecary Diaries 24. Bölüm Final İzle',
        ],
        'dark',
      ),
    },
  });

  await page.goto(homeURL);

  const season3 = cardDetails(page, 'The Apothecary Diaries 3. Sezon');
  const season1 = cardDetails(page, 'The Apothecary Diaries 24. Bölüm');

  await expect(season3.getByTitle('Popularity [Visit AniList]')).toContainText(
    '40K',
  );
  await expect(season3.getByTitle('Trending')).toBeVisible();
  await expect(season1.getByTitle('Popularity [Visit AniList]')).toContainText(
    '180K',
  );
  await expect(season1.getByTitle('Trending')).toHaveCount(0);

  // "3. Sezon" becomes "Season 3"; that entry only has a MyAnimeList source
  expect(recorded.lookups).toEqual(
    expect.arrayContaining([
      {
        alias: 'a_1_the_apothecary_diaries_season_3',
        by: 'idMal',
        value: '60000',
      },
      { alias: 'a_2_the_apothecary_diaries', by: 'id', value: '161645' },
    ]),
  );
});

test("follows the site's light and dark theme", async ({ context, page }) => {
  await mockNetwork(context, {
    media: [apothecaryDiaries],
    pages: {
      [homeURL]: tranimeizleHomePage(
        ['The Apothecary Diaries 24. Bölüm İzle'],
        'dark',
      ),
    },
  });

  await page.goto(homeURL);

  const themeRoot = cardDetails(page, 'The Apothecary Diaries').locator(
    '[data-kb-theme]',
  );

  await expect(themeRoot).toHaveAttribute('data-kb-theme', 'dark');

  // What the site's theme toggle does
  await page.evaluate(() => {
    document.body.className = 'light-mode';
    localStorage.setItem('temabuton', 'light');
  });

  await expect(themeRoot).toHaveAttribute('data-kb-theme', 'light');
});
