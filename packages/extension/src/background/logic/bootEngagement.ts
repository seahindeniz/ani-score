import { logger } from '~/utils/logger';

import { checkAnilistAuthorization } from './checkAnilistAuthorization';
import { loadDatabase } from './loadDatabase';

let initialized = false;

export async function engage() {
  if (initialized) {
    return;
  }

  initialized = true;

  try {
    // Runs after the sign-in check, so its badge is set before the loading one, yet a search made during the check
    // already waits for the database
    await loadDatabase(checkAnilistAuthorization());
  } catch (error) {
    logger.error(error);
  }
}
