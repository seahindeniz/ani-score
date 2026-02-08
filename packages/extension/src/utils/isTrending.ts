import type { AnimeDetails } from '~/background/logic/fetchDetails'

const MS_IN_A_DAY = 1000 * 60 * 60 * 24

export function isTrending(details: AnimeDetails): boolean {
  if (!details.startDate) {
    return false
  }

  const date = new Date(`${details.startDate.year}-${details.startDate.month}-${details.startDate.day}`)
  const favoriteCount = details.favourites ?? 0
  const daysSinceRelease = (Date.now() - date.getTime()) / MS_IN_A_DAY

  return favoriteCount >= Math.max(100, (100 * (daysSinceRelease / 30)))
}
