import { beforeEach, expect, test } from 'bun:test';

import { useTokenStore } from '~/logic';

import { fakeBrowser } from '../../../../test/fake-browser';
import { checkAnilistAuthorization } from '../checkAnilistAuthorization';

const tokenStore = useTokenStore();

beforeEach(async () => {
  await tokenStore.dataReady;
});

function expectLoginBadge() {
  expect(fakeBrowser.action.setBadgeText).toHaveBeenLastCalledWith({
    text: 'Login',
  });
  expect(fakeBrowser.action.setBadgeBackgroundColor).toHaveBeenLastCalledWith({
    color: '#DD0303',
  });
}

test('shows no badge when the viewer is signed in', async () => {
  tokenStore.setData({ anilist: 'token' });

  await checkAnilistAuthorization();

  expect(fakeBrowser.action.setBadgeText).toHaveBeenLastCalledWith({
    text: '',
  });
  expect(fakeBrowser.action.setBadgeText).not.toHaveBeenCalledWith({
    text: 'Login',
  });
  expect(fakeBrowser.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
});

test('asks the viewer to sign in, and clears the badge once they do', async () => {
  tokenStore.setData({ anilist: '' });

  await checkAnilistAuthorization();

  expectLoginBadge();

  const colorCalls =
    fakeBrowser.action.setBadgeBackgroundColor.mock.calls.length;

  tokenStore.setData({ anilist: 'token' });

  expect(fakeBrowser.action.setBadgeText).toHaveBeenLastCalledWith({
    text: '',
  });
  expect(fakeBrowser.action.setBadgeBackgroundColor).toHaveBeenCalledTimes(
    colorCalls,
  );
});

test('asks the viewer to sign in again after they sign out', async () => {
  tokenStore.setData({ anilist: 'token' });

  await checkAnilistAuthorization();
  tokenStore.setData({ anilist: '' });

  expectLoginBadge();
});
