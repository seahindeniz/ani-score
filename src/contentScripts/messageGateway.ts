import * as bridge from 'webext-bridge/content-script'
import { liveInterval } from '~/constants/main'

window.messageGateway = bridge

setInterval(() => {
  void bridge.sendMessage('get-stamp', Date.now()).catch(() => {})
  void browser.runtime.sendMessage('get-stamp-2', Date.now()).catch(() => {})
}, liveInterval)
