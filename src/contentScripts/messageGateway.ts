import { onMessage, sendMessage } from 'webext-bridge/content-script'

window.messageGateway = {
  sendMessage,
  onMessage,
}
