import { expect, test } from 'bun:test';

import { fakeBrowser } from '../../../../test/fake-browser';
import { openSignIn } from '../openSignIn';

const signInURL = 'https://anilist.co/api/v2/oauth/authorize?client_id=test';

test('opens one sign-in tab, however often it is asked while the tab is open, and tells the user to sign in', async () => {
  await Promise.all([openSignIn(), openSignIn()]);
  await openSignIn();

  expect(fakeBrowser.tabs.create).toHaveBeenCalledTimes(1);
  expect(fakeBrowser.tabs.create).toHaveBeenCalledWith({ url: signInURL });
  expect(fakeBrowser.notifications.create).toHaveBeenCalledTimes(1);
  expect(fakeBrowser.notifications.create).toHaveBeenCalledWith(
    'anilist-sign-in',
    expect.objectContaining({
      iconUrl: 'chrome-extension://test-extension-id/assets/icon-512.png',
      title: 'AniScore',
      message: expect.stringContaining('Sign in to AniList'),
    }),
  );
});

test('opens the sign-in again once its tab is closed', async () => {
  await openSignIn();
  await fakeBrowser.tabs.remove(1);
  await openSignIn();

  expect(fakeBrowser.tabs.create).toHaveBeenCalledTimes(2);
  expect(fakeBrowser.notifications.create).toHaveBeenCalledTimes(2);
});

test('keeps the tab it opened when the notification fails', async () => {
  fakeBrowser.notifications.create.mockRejectedValueOnce(
    new Error('Notifications are off'),
  );

  await openSignIn();
  await openSignIn();

  expect(fakeBrowser.tabs.create).toHaveBeenCalledTimes(1);
});

test('tries again after the tab failed to open', async () => {
  fakeBrowser.tabs.create.mockRejectedValueOnce(new Error('No window'));

  await openSignIn();
  await openSignIn();

  expect(fakeBrowser.tabs.create).toHaveBeenCalledTimes(2);
  expect(fakeBrowser.notifications.create).toHaveBeenCalledTimes(1);
  expect(await fakeBrowser.tabs.get(1)).toMatchObject({ id: 1 });
});
