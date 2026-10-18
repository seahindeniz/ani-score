import { beforeEach, expect, test } from 'bun:test';

import { createRoot } from 'solid-js';

import { useTokenStore } from '~/logic';

import { fakeBrowser } from '../../../../test/fake-browser';
import { checkAnilistAuthorization } from '../checkAnilistAuthorization';

const tokenStore = useTokenStore();

beforeEach(async () => {
  await tokenStore.dataReady;
});

test('leaves the badge alone when the viewer is signed in', async () => {
  tokenStore.setData({ anilist: 'token' });

  await checkAnilistAuthorization();

  expect(fakeBrowser.action.setBadgeText).not.toHaveBeenCalledWith({
    text: 'Login',
  });
});

test('asks the viewer to sign in, and clears the badge once they do', async () => {
  tokenStore.setData({ anilist: '' });

  await createRoot(() => checkAnilistAuthorization());

  expect(fakeBrowser.action.setBadgeText).toHaveBeenLastCalledWith({
    text: 'Login',
  });
  expect(fakeBrowser.action.setBadgeBackgroundColor).toHaveBeenLastCalledWith({
    color: '#DD0303',
  });

  tokenStore.setData({ anilist: 'token' });

  expect(fakeBrowser.action.setBadgeText).toHaveBeenLastCalledWith({
    text: '',
  });
  expect(fakeBrowser.action.setBadgeBackgroundColor).toHaveBeenLastCalledWith({
    color: '',
  });
});
