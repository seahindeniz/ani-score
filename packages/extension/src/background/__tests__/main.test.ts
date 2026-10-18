import { afterAll, beforeAll, expect, mock, spyOn, test } from 'bun:test';

import { fakeBrowser } from '../../../test/fake-browser';
import { FakeWebSocket, installFakeWebSocket } from './fakeWebSocket';

const onMessage = mock();

mock.module('webext-bridge/background', () => ({ onMessage }));

let restoreWebSocket: () => void;

beforeAll(async () => {
  restoreWebSocket = installFakeWebSocket();
  fakeBrowser.sidePanel.setPanelBehavior.mockImplementationOnce(() =>
    Promise.reject(new Error('no side panel')),
  );

  // The stylesheet interval would otherwise keep fetching during later tests
  const setInterval = spyOn(globalThis, 'setInterval').mockImplementation(
    (() => 0) as unknown as typeof globalThis.setInterval,
  );

  // As on Vite's dev server, so the HMR client gets loaded too
  Object.assign(globalThis, { __VITE_HOT__: {} });

  const startup = '../main.ts?case=startup';

  await import(startup);
  Reflect.deleteProperty(globalThis, '__VITE_HOT__');

  const viteClientLoaded = () => '__VITE_CLIENT_LOADED__' in globalThis;

  for (let attempt = 0; attempt < 50 && !viteClientLoaded(); attempt++)
    await Bun.sleep(10);

  expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
  setInterval.mockRestore();
});

afterAll(() => {
  restoreWebSocket();
});

test('starts the background services', async () => {
  expect(onMessage.mock.calls.map(([name]) => name)).toEqual([
    'initialize',
    'fetch-details',
    'make-anime-favorite',
    'engage-with-time',
    'get-stamp',
  ]);
  expect(FakeWebSocket.instances.map((ws) => ws.url)).toEqual([
    'wss://ws.ifelse.io/',
  ]);
  expect(fakeBrowser.sidePanel.setPanelBehavior).toHaveBeenCalledWith({
    openPanelOnActionClick: true,
  });
  expect('__VITE_CLIENT_LOADED__' in globalThis).toBe(true);

  // Listeners are cleared after each test, so the install handler is checked here too
  const results = fakeBrowser.runtime.onInstalled.dispatch({
    reason: 'install',
  });

  expect(results).toHaveLength(1);
  expect(await results[0]).toBeUndefined();
});
