import { logger } from '~/utils/logger'
import { initSiteLogic } from './logic/loadSite'

window.engageWithSite = (site, scope) => {
  if (!site) {
    logger.log('No matching site configuration found for this URL.')
    return null
  }

  void initSiteLogic({ ...site, scope })
  setInterval(() => {
    window.messageGateway.sendMessage('get-time', null)
  }, 10000)
}
