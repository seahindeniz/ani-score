import { afterAll, beforeEach, expect, mock, spyOn, test } from 'bun:test';

import { fakeBrowser } from '../../../../test/fake-browser';
import * as bootEngagement from '../bootEngagement';
import * as fetchDetails from '../fetchDetails';
import * as makeAnimeFavorite from '../makeAnimeFavorite';

type Handler = (message: { data: unknown }) => unknown;

const handlers = new Map<string, Handler>();

mock.module('webext-bridge/background', () => ({
  onMessage: (name: string, handler: Handler) => handlers.set(name, handler),
}));

const engage = spyOn(bootEngagement, 'engage').mockResolvedValue(undefined);

// Listeners are cleared after each test, so register them again
beforeEach(async () => {
  const { listenMessages } = await import('../message');

  listenMessages();
  engage.mockClear();
});

afterAll(() => {
  engage.mockRestore();
});

function handle(name: string, data: unknown = null) {
  return handlers.get(name)!({ data });
}

test('starts the engagement when a page initializes', async () => {
  await handle('initialize');

  expect(engage).toHaveBeenCalledTimes(1);
});

test('fetches details and toggles favorites for pages', async () => {
  const details = { 'Sousou no Frieren': null };
  const fetchDetailsSpy = spyOn(fetchDetails, 'fetchDetails').mockResolvedValue(
    details,
  );
  const favoriteSpy = spyOn(
    makeAnimeFavorite,
    'makeAnimeFavorite',
  ).mockResolvedValue({ error: undefined } as any);
  const cards = [{ title: 'Sousou no Frieren', episodeNumber: 1 }];

  expect(await handle('fetch-details', { cards })).toBe(details);
  expect(fetchDetailsSpy).toHaveBeenCalledWith({ cards });

  expect(await handle('make-anime-favorite', 154587)).toEqual({
    error: undefined,
  });
  expect(favoriteSpy).toHaveBeenCalledWith(154587);

  fetchDetailsSpy.mockRestore();
  favoriteSpy.mockRestore();
});

test('keeps the engagement alive while pages report in', () => {
  const reply = handle('engage-with-time', Date.now());

  expect(engage).toHaveBeenCalledTimes(1);
  expect(Number.isNaN(Date.parse(reply as string))).toBe(false);
});

test('answers keep-alive pings', () => {
  expect(handle('get-stamp')).toBeNumber();
});

test('answers plain runtime pings and ignores other messages', async () => {
  const [ping] = fakeBrowser.runtime.onMessage.dispatch({ 'get-stamp-2': 1 });

  expect(await ping).toBeNumber();
  expect(fakeBrowser.runtime.onMessage.dispatch({ other: 1 })).toEqual([
    undefined,
  ]);
  expect(fakeBrowser.runtime.onMessage.dispatch(null)).toEqual([undefined]);
});
