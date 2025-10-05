import { render } from 'solid-js/web'
import browser from 'webextension-polyfill'
import App from './view/App'

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
(() => {
  // mount component to context window
  const container = document.createElement('div')
  const styleEl = document.createElement('link')
  const shadowDOM = container.attachShadow?.({ mode: __DEV__ ? 'open' : 'closed' }) || container

  container.className = __NAME__

  styleEl.setAttribute('rel', 'stylesheet')
  styleEl.setAttribute('href', browser.runtime.getURL('dist/contentScripts/widget/style.css'))
  shadowDOM.appendChild(styleEl)
  document.body.appendChild(container)
  render(() => <App />, shadowDOM)
})()
