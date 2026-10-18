import { debounce } from '@solid-primitives/scheduled';

import { initSiteLogic } from '~/contentScripts/engagement/logic/loadSite';
import type { SiteConfig } from '~/sites/schema';
import { parseSiteConfig } from '~/sites/schema';

/**
 * Runs AniScore on the page with the config being edited, starting over shortly after each change. A config that
 * doesn't validate shows nothing until it does.
 */
export function createPreview() {
  let stop: (() => void) | undefined;

  const run = (draft: SiteConfig) => {
    stop?.();
    stop = undefined;

    const result = parseSiteConfig(draft);

    if (result.success) stop = initSiteLogic(result.config);
  };
  const scheduled = debounce(run, 400);

  return {
    update: (draft: SiteConfig) => scheduled(draft),
    now: run,
    dispose() {
      scheduled.clear();
      stop?.();
      stop = undefined;
    },
  };
}
