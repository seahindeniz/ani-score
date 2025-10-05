import { logger } from '~/utils/logger'
import { checkAnilistAuthorization } from './logic/checkAnilistAuthorization'
import { loadDatabase } from './logic/loadDatabase'
import { listenMessages } from './logic/message'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  // load latest content script
  import('./contentScriptHMR')
}

listenMessages()

if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => logger.error(error))
}

checkAnilistAuthorization().then(() => {
  setTimeout(() => {
    void loadDatabase()
  }, 400)
})

browser.runtime.onInstalled.addListener((): void => {
  logger.log('Extension installed')
})
