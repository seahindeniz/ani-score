import { logger } from '~/utils/logger'
import { fetchCSS } from './logic/fetchCSS'
import { listenMessages } from './logic/message'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  // load latest content script
  import('./contentScriptHMR')
}

listenMessages()
fetchCSS()

if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => logger.error(error))
}

browser.runtime.onInstalled.addListener(async (): Promise<void> => {
  logger.log('Extension installed')
})
