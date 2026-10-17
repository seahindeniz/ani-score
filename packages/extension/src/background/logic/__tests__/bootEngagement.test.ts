import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { useTokenStore } from '~/logic'
import { fakeBrowser } from '../../../../test/fake-browser'
import { databaseURLs, mockFetch } from '../../__tests__/network'

const realSetTimeout = globalThis.setTimeout
let fetchMock: ReturnType<typeof mockFetch>

// `engage` runs only once per module, so each test gets its own copy
async function importEngage(testCase: string): Promise<typeof import('../bootEngagement')['engage']> {
  return (await import(`../bootEngagement.ts?case=${testCase}`)).engage
}

function updateChecks() {
  return fetchMock.mock.calls.filter(([input]) => String(input) === databaseURLs.primaryLastUpdate)
}

beforeEach(async () => {
  // The database load clears its badge after 2s; run that right away so it can't land in a later test
  spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) => realSetTimeout(callback, 0)) as typeof setTimeout)
  fetchMock = mockFetch({})
  await useTokenStore().dataReady
  useTokenStore().setData({ anilist: '' })
})

afterEach(async () => {
  await new Promise(resolve => realSetTimeout(resolve, 10))
  fetchMock.mockRestore()
  ;(globalThis.setTimeout as unknown as ReturnType<typeof spyOn>).mockRestore()
})

test('checks the sign-in and loads the database only once', async () => {
  const engage = await importEngage('once')

  await engage()

  expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: 'Login' })
  expect(updateChecks()).toHaveLength(1)

  await engage()

  expect(updateChecks()).toHaveLength(1)
})

test('keeps going when the sign-in check fails', async () => {
  const engage = await importEngage('failure')

  fakeBrowser.action.setBadgeText.mockImplementationOnce(() => {
    throw new Error('badge unavailable')
  })

  expect(await engage()).toBeUndefined()
  // The database isn't loaded after a failed check
  expect(updateChecks()).toHaveLength(0)
})
