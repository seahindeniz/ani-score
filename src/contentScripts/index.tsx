/* eslint-disable no-console */
import { render } from 'solid-js/web'
import { onMessage } from 'webext-bridge/content-script'
import browser from 'webextension-polyfill'
import App from './views/App'

declare const __DEV__: boolean
declare const __NAME__: string

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
(() => {
  console.info('[vitesse-webext] Hello world from content script')

  // communication example: send previous tab title from background page
  onMessage('tab-prev', ({ data }) => {
    if (data && typeof data === 'object' && 'title' in data) {
      console.log(`[vitesse-webext] Navigate from page "${(data as any).title}"`)
    }
  })

  // mount component to context window
  const container = document.createElement('div')
  container.id = __NAME__
  const root = document.createElement('div')
  const styleEl = document.createElement('link')
  const shadowDOM = container.attachShadow?.({ mode: __DEV__ ? 'open' : 'closed' }) || container
  styleEl.setAttribute('rel', 'stylesheet')
  styleEl.setAttribute('href', browser.runtime.getURL('dist/contentScripts/style.css'))
  shadowDOM.appendChild(styleEl)
  shadowDOM.appendChild(root)
  document.body.appendChild(container)
  render(() => <App />, root)
})()
