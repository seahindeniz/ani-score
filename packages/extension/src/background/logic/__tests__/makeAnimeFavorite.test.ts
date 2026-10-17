import { afterEach, expect, test } from 'bun:test'
import { anilistURL, mockFetch } from '../../__tests__/network'
import { makeAnimeFavorite } from '../makeAnimeFavorite'

let fetchMock: ReturnType<typeof mockFetch> | undefined

afterEach(() => {
  fetchMock?.mockRestore()
})

test('toggles the anime as a favorite on AniList', async () => {
  const bodies: { query: string, variables: Record<string, unknown> }[] = []

  fetchMock = mockFetch({
    [anilistURL]: async (request) => {
      bodies.push(await request.json() as typeof bodies[number])

      return Response.json({ data: { ToggleFavourite: { anime: { pageInfo: { total: 1 } } } } })
    },
  })

  const result = await makeAnimeFavorite(154587)

  expect(result.error).toBeUndefined()
  expect(result.data?.ToggleFavourite?.anime?.pageInfo?.total).toBe(1)
  expect(bodies).toHaveLength(1)
  expect(bodies[0].query).toContain('ToggleFavourite')
  expect(bodies[0].variables).toEqual({ animeId: 154587 })
})
