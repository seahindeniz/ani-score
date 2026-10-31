import { logger } from '~/utils/logger';

let signInTab: Promise<number | undefined> = Promise.resolve(undefined);

function isOpen(tabId: number) {
  return browser.tabs.get(tabId).then(
    () => true,
    () => false,
  );
}

/**
 * Opens AniList's sign-in on a new tab, with a notification asking the user to sign in there, unless the tab it opened
 * last is still open. Calls made at the same time open one tab.
 */
export async function openSignIn() {
  signInTab = signInTab
    .then(async (tabId) => {
      if (tabId !== undefined && (await isOpen(tabId))) return tabId;

      const tab = await browser.tabs.create({ url: ANILIST_TOKEN_URL });

      browser.notifications
        .create('anilist-sign-in', {
          type: 'basic',
          iconUrl: browser.runtime.getURL('assets/icon-512.png'),
          title: 'AniScore',
          message:
            'Sign in to AniList on the tab AniScore opened to see anime ratings.',
        })
        .catch((error: unknown) => logger.error(error));

      return tab.id;
    })
    .catch((error: unknown) => {
      logger.error(error);

      return undefined;
    });

  await signInTab;
}
