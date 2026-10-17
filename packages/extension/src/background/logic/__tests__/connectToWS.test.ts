import { afterEach, beforeEach, expect, jest, spyOn, test } from 'bun:test'
import { liveInterval } from '~/constants/main'
import { FakeWebSocket, installFakeWebSocket } from '../../__tests__/fakeWebSocket'

let restoreWebSocket: () => void
let testCase = 0

// connectToWS keeps the ping interval in module state, so each test gets its own copy
async function importConnectToWS() {
  return (await import(`../connectToWS.ts?case=${++testCase}`)).connectToWS as () => FakeWebSocket
}

beforeEach(() => {
  restoreWebSocket = installFakeWebSocket()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
  restoreWebSocket()
})

test('connects to the keep-alive server and pings it while open', async () => {
  const connectToWS = await importConnectToWS()
  const ws = connectToWS()

  expect(ws.url).toBe('wss://ws.ifelse.io/')

  ws.open()
  jest.advanceTimersByTime(liveInterval)

  expect(ws.sent).toEqual([expect.stringMatching(/^get-stamp-\d+$/)])

  // A socket that is no longer open isn't pinged
  ws.readyState = FakeWebSocket.CLOSED
  jest.advanceTimersByTime(liveInterval)

  expect(ws.sent).toHaveLength(1)
})

test('stops pinging and reconnects 3 seconds after the connection closes', async () => {
  const connectToWS = await importConnectToWS()
  const ws = connectToWS()

  ws.open()
  ws.close()
  jest.advanceTimersByTime(2999)

  expect(ws.sent).toEqual([])
  expect(FakeWebSocket.instances).toHaveLength(1)

  jest.advanceTimersByTime(1)

  expect(FakeWebSocket.instances).toHaveLength(2)
})

test('reconnects after a connection that never opened', async () => {
  const connectToWS = await importConnectToWS()

  connectToWS().close()
  jest.advanceTimersByTime(3000)

  expect(FakeWebSocket.instances).toHaveLength(2)
})

test('replaces the pings of an earlier connection', async () => {
  const connectToWS = await importConnectToWS()
  const first = connectToWS()

  first.open()
  connectToWS()
  jest.advanceTimersByTime(liveInterval)

  expect(first.sent).toEqual([])
})

test('ignores messages and reports errors', async () => {
  const consoleError = spyOn(console, 'error').mockImplementation(() => {})
  const connectToWS = await importConnectToWS()
  const ws = connectToWS()

  expect(() => ws.onmessage?.({ data: 'get-stamp-1' })).not.toThrow()
  expect(() => ws.onerror?.(new Event('error'))).not.toThrow()

  consoleError.mockRestore()
})
