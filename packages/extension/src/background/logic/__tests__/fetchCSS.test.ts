import { afterEach, beforeEach, expect, jest, test } from 'bun:test'
import { liveInterval } from '~/constants/main'
import { mockFetch } from '../../__tests__/network'
import { fetchCSS } from '../fetchCSS'

const styleURL = 'chrome-extension://test-extension-id/background.css'
let fetchMock: ReturnType<typeof mockFetch>

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
  fetchMock.mockRestore()
})

test('keeps fetching the background stylesheet', async () => {
  fetchMock = mockFetch({ [styleURL]: () => new Response('body {}') })

  fetchCSS()

  expect(fetchMock).not.toHaveBeenCalled()

  jest.advanceTimersByTime(liveInterval * 2)

  expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([styleURL, styleURL])
})

test('survives a failed fetch', async () => {
  fetchMock = mockFetch({
    [styleURL]: () => {
      throw new TypeError('Failed to fetch')
    },
  })

  fetchCSS()
  jest.advanceTimersByTime(liveInterval)
  // Fake timers would hold back the wait for the rejected fetch to be handled
  jest.useRealTimers()
  await new Promise(resolve => setTimeout(resolve, 0))

  expect(fetchMock).toHaveBeenCalledTimes(1)
})
