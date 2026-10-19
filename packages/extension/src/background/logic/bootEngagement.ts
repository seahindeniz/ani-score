import { logger } from '~/utils/logger';

import { checkAnilistAuthorization } from './checkAnilistAuthorization';
import { loadDatabase } from './loadDatabase';

let initialized = false;

export async function engage() {
  if (initialized) {
    return;
  }

  initialized = true;

  const signInCheck = checkAnilistAuthorization();

  // The database update runs after the sign-in check, so the sign-in badge is set before the loading one, yet a search
  // made during the check already waits for it. A failed check doesn't keep the database from loading.
  await Promise.all([
    signInCheck.catch((error: unknown) => logger.error(error)),
    loadDatabase(signInCheck),
  ]);
}
