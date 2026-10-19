import { createEffect, createRoot, on } from 'solid-js';

import { useTokenStore } from '~/logic';

export async function checkAnilistAuthorization() {
  const tokenStore = useTokenStore();

  await tokenStore.dataReady;

  // The badge asks the viewer to sign in for as long as there's no token, including after signing out
  createRoot(() => {
    createEffect(
      on(
        () => Boolean(tokenStore.data().anilist),
        (signedIn) => {
          browser.action.setBadgeText({ text: signedIn ? '' : 'Login' });
          // Chrome rejects an empty color, and with no text there's no badge to color
          if (!signedIn)
            browser.action.setBadgeBackgroundColor({ color: '#DD0303' });
        },
      ),
    );
  });
}
