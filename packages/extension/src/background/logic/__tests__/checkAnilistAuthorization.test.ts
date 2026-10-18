import { beforeEach, expect, test } from 'bun:test';

import { useTokenStore } from '~/logic';

import { fakeBrowser } from '../../../../test/fake-browser';
import { checkAnilistAuthorization } from '../checkAnilistAuthorization';

const tokenStore = useTokenStore();

beforeEach(async () => {
  await tokenStore.dataReady;
});

function expectBadge(text: string, color: string) {
  expect(fakeBrowser.action.setBadgeText).toHaveBeenLastCalledWith({ text });
  expect(fakeBrowser.action.setBadgeBackgroundColor).toHaveBeenLastCalledWith({
    color,
  });
}

test('shows no badge when the viewer is signed in', async () => {
  tokenStore.setData({ anilist: 'token' });

  await checkAnilistAuthorization();

  expectBadge('', '');
  expect(fakeBrowser.action.setBadgeText).not.toHaveBeenCalledWith({
    text: 'Login',
  });
});

test('asks the viewer to sign in, and clears the badge once they do', async () => {
  tokenStore.setData({ anilist: '' });

  await checkAnilistAuthorization();

  expectBadge('Login', '#DD0303');

  tokenStore.setData({ anilist: 'token' });

  expectBadge('', '');
});

test('asks the viewer to sign in again after they sign out', async () => {
  tokenStore.setData({ anilist: 'token' });

  await checkAnilistAuthorization();
  tokenStore.setData({ anilist: '' });

  expectBadge('Login', '#DD0303');
});
