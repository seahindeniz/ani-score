import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import browser from 'webextension-polyfill';
import SimpleIconsAnilist from '~icons/simple-icons/anilist';

import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { useTokenStore } from '~/logic';

/**
 * The AniList account AniScore uses for the user's progress and favorites, with signing in and out in one place.
 */
export const Account: Component = () => {
  const tokenStore = useTokenStore();
  const signedIn = () => Boolean(tokenStore.data().anilist);

  function signIn() {
    void browser.tabs.create({ url: ANILIST_TOKEN_URL });
  }

  function signOut() {
    tokenStore.setData({ ...tokenStore.data(), anilist: '' });
  }

  return (
    <Card class="w-full">
      <CardHeader>
        <CardTitle>AniList</CardTitle>
        <CardDescription>
          {signedIn()
            ? 'Signed in. AniScore shows your progress and favorites, and you can favorite anime from its details.'
            : 'Sign in to see your progress and favorites next to each episode, and to favorite anime from AniScore.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Show
          when={signedIn()}
          fallback={
            <Button onClick={signIn}>
              <SimpleIconsAnilist aria-hidden="true" />
              Sign in with AniList
            </Button>
          }
        >
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </Show>
      </CardContent>
    </Card>
  );
};
