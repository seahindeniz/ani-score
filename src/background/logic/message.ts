import { onMessage } from 'webext-bridge/background'
import { logger } from '~/utils/logger'
import { engage } from './bootEngagement'
import { fetchDetails } from './fetchDetails'
import { makeAnimeFavorite } from './makeAnimeFavorite'

/**
 * Define protocols in the declaration file
 * [shim.d.ts]({@link ../../@types/shim.d.ts})
 */
export function listenMessages() {
  logger.log('Listening for messages in background script')

  onMessage('initialize', () => engage())
  onMessage('fetch-details', message => fetchDetails(message.data))
  onMessage('make-anime-favorite', message => makeAnimeFavorite(message.data))
  onMessage('engage-with-time', () => {
    void engage()

    return new Date().toString()
  })
  onMessage('get-stamp', () => {
    return Date.now()
  })
}
