import { expect, spyOn, test } from 'bun:test'
import { fakeBrowser } from '../../../test/fake-browser'

let testCase = 0

// The module registers its listener on import, and listeners are cleared after each test
async function importHMR() {
  await import(`../contentScriptHMR.ts?case=${++testCase}`)
}

function commit(details: { tabId: number, frameId: number, url: string }) {
  return fakeBrowser.webNavigation.onCommitted.dispatch(details)
}

test('injects the latest content scripts into each loaded page', async () => {
  await importHMR()

  commit({ tabId: 7, frameId: 0, url: 'https://anizm.net/' })

  expect(fakeBrowser.tabs.executeScript).toHaveBeenCalledWith(7, {
    file: './dist/contentScripts/index.global.js',
    runAt: 'document_end',
  })
})

test('skips frames and browser pages', async () => {
  await importHMR()

  commit({ tabId: 7, frameId: 3, url: 'https://anizm.net/' })
  commit({ tabId: 7, frameId: 0, url: 'chrome://extensions/' })
  commit({ tabId: 7, frameId: 0, url: 'https://chrome.google.com/webstore/detail/x' })

  expect(fakeBrowser.tabs.executeScript).not.toHaveBeenCalled()
})

test('logs pages it can\'t inject into', async () => {
  const consoleError = spyOn(console, 'error').mockImplementation(() => {})
  const error = new Error('Cannot access contents of the page')

  fakeBrowser.tabs.executeScript.mockImplementationOnce(() => Promise.reject(error))
  await importHMR()

  commit({ tabId: 7, frameId: 0, url: 'https://anizm.net/' })
  await Promise.resolve()

  expect(consoleError).toHaveBeenCalledWith(error)

  consoleError.mockRestore()
})
