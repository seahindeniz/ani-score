import { liveInterval } from '~/constants/main'
import { logger } from '~/utils/logger'

let intervalId: NodeJS.Timeout | null = null
const op = (text: MessageEvent) => String(text.data)

function createWebSocketConnection() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }

  const ws = new WebSocket('wss://ws.ifelse.io/')

  ws.onopen = () => {
    logger.log('WebSocket connection established')
    intervalId = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`get-stamp-${Date.now()}`)
      }
    }, liveInterval)
  }

  ws.onmessage = (event) => {
    op(event)
  }

  ws.onclose = () => {
    logger.log('WebSocket connection closed')

    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    setTimeout(() => {
      logger.log('Attempting to reconnect WebSocket...')
      createWebSocketConnection()
    }, 3000)
  }

  ws.onerror = (error) => {
    logger.error('WebSocket error:', error)
  }

  return ws
}

export function connectToWS() {
  return createWebSocketConnection()
}
