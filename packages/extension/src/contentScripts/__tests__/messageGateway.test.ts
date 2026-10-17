import { afterAll, beforeAll, describe, expect, it, jest, mock } from 'bun:test'
import { fakeBrowser } from '../../../test/fake-browser'

const sendMessage = mock(async (_id: string, _data: unknown): Promise<unknown> => undefined)
const bridge = { sendMessage, onMessage: mock() }

// The real bridge connects a runtime port on import, which only exists inside an extension
mock.module('webext-bridge/content-script', () => bridge)

describe('messageGateway', () => {
  beforeAll(async () => {
    jest.useFakeTimers()
    await import('../messageGateway')
  })

  afterAll(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('exposes the bridge to the other content scripts', () => {
    expect(window.messageGateway.sendMessage).toBe(sendMessage as unknown as typeof window.messageGateway.sendMessage)
  })

  it('pings the background every 5 seconds over both channels', () => {
    jest.advanceTimersByTime(5000)

    expect(sendMessage).toHaveBeenCalledWith('get-stamp', expect.any(Number))
    expect(fakeBrowser.runtime.sendMessage).toHaveBeenCalledWith({ 'get-stamp-2': expect.any(Number) })
  })

  it('ignores failed pings, e.g. while the background restarts', async () => {
    sendMessage.mockImplementation(async () => {
      throw new Error('Could not establish connection')
    })
    fakeBrowser.runtime.sendMessage.mockImplementationOnce(async () => {
      throw new Error('Could not establish connection')
    })

    jest.advanceTimersByTime(5000)
    await Promise.resolve()

    expect(sendMessage).toHaveBeenCalledTimes(2)
  })
})
