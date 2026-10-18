import { describe, expect, it } from 'bun:test';

import type { AnimeDetails } from '~/background/logic/fetchDetails';

import { isTrending } from '../isTrending';

const DAY = 24 * 60 * 60 * 1000;

function anime(favourites: number | null, startedDaysAgo: number | null) {
  const date = new Date(Date.now() - (startedDaysAgo ?? 0) * DAY);

  return {
    favourites,
    startDate:
      startedDaysAgo == null
        ? null
        : {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
          },
  } as AnimeDetails;
}

describe('isTrending', () => {
  it('is false without a start date', () => {
    expect(isTrending(anime(10_000, null))).toBe(false);
  });

  it('needs at least 100 favourites for recent releases', () => {
    expect(isTrending(anime(100, 5))).toBe(true);
    expect(isTrending(anime(99, 5))).toBe(false);
  });

  it('raises the bar by 100 favourites per month since release', () => {
    expect(isTrending(anime(650, 180))).toBe(true);
    expect(isTrending(anime(550, 180))).toBe(false);
  });

  it('treats missing favourites as zero', () => {
    expect(isTrending(anime(null, 1))).toBe(false);
  });
});
