import { logger } from '~/utils/logger'
import { checkAnilistAuthorization } from './checkAnilistAuthorization'
import { loadDatabase } from './loadDatabase'

let initialized = false

export async function engage() {
  if (initialized) {
    return
  }

  initialized = true

  try {
    await checkAnilistAuthorization()
    await loadDatabase()
  }
  catch (error) {
    logger.error(error)
  }
}
