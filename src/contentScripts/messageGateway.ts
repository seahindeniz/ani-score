import * as bridge from 'webext-bridge/content-script'

window.messageGateway = bridge

setInterval(() => {
  void bridge.sendMessage('get-stamp', null)
}, 10000)
