import { onMessage } from 'webext-bridge/background'
import { logger } from '~/utils/logger'
import { fetchDetails } from './fetchDetails'
import { makeAnimeFavorite } from './makeAnimeFavorite'

export function listenMessages() {
  logger.log('Listening for messages in background script')

  onMessage('fetch-details', message => fetchDetails(message.data))
  onMessage('make-anime-favorite', message => makeAnimeFavorite(message.data))
  onMessage('get-time', () => new Date().toString())
}
