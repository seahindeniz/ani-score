import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildAnimeIndex,
  packAnimeIndex,
  readAnimeIndex,
  unpackAnimeIndex,
} from '../animeIndex';
import {
  isGzip,
  parsePrebuiltIndexMetadata,
  prebuiltIndexFiles,
  readPrebuiltFile,
} from '../databaseSources';
import { publishAnimeIndex } from '../publish';
import { entries, mockFetch, prebuiltRoutes, upstreamURLs } from './network';

const day = 24 * 60 * 60 * 1000;
const realSetTimeout = globalThis.setTimeout;

let fetchMock: ReturnType<typeof mockFetch> | undefined;
let spies: ReturnType<typeof spyOn>[] = [];
let directory: string;

const cedya77Routes = {
  [upstreamURLs.cedya77LastUpdate]: { lastUpdate: '2026-10-08' },
  [upstreamURLs.cedya77]: { data: entries },
};
const athanassoRoutes = {
  [upstreamURLs.athanassoRelease]: { published_at: '2026-10-09T00:00:00Z' },
  [upstreamURLs.athanasso]: { data: entries },
};

const requested = (url: string) =>
  fetchMock!.mock.calls.filter(([input]) => String(input).startsWith(url))
    .length;

async function written() {
  const metadata = await Bun.file(
    join(directory, prebuiltIndexFiles.metadata),
  ).json();
  const file = await Bun.file(
    join(directory, prebuiltIndexFiles.index),
  ).arrayBuffer();

  return { metadata, file };
}

beforeEach(() => {
  directory = join(tmpdir(), `anime-index-${crypto.randomUUID()}`);
  spies = [
    // The pauses between retries take seconds; run them right away
    spyOn(globalThis, 'setTimeout').mockImplementation(((
      callback: () => void,
    ) => realSetTimeout(callback, 0)) as typeof setTimeout),
    // Its warnings are expected here
    spyOn(console, 'warn').mockImplementation(() => {}),
  ];
});

afterEach(() => {
  fetchMock?.mockRestore();
  fetchMock = undefined;
  spies.forEach((spy) => spy.mockRestore());
});

describe('publishAnimeIndex', () => {
  test('builds the index from the preferred source, and writes it with its metadata', async () => {
    fetchMock = mockFetch({ ...cedya77Routes, ...athanassoRoutes });

    expect(await publishAnimeIndex(directory)).toBeDefined();

    const { metadata, file } = await written();

    expect(metadata).toMatchObject({
      format: 1,
      source: 'cedya77/anime-offline-database',
      lastUpdate: '2026-10-08',
      license: expect.stringContaining('ODbL'),
    });
    expect(isGzip(file)).toBe(true);
    // Reads back as an extension does
    expect(
      readAnimeIndex(
        unpackAnimeIndex(
          await readPrebuiltFile(file, parsePrebuiltIndexMetadata(metadata)),
        ),
      ).search('Frieren', 10),
    ).toHaveLength(1);
    expect(requested(upstreamURLs.athanassoRelease)).toBe(0);
  });

  test('asks a failing source again rather than switching sources', async () => {
    let attempts = 0;

    fetchMock = mockFetch({
      ...cedya77Routes,
      ...athanassoRoutes,
      [upstreamURLs.cedya77LastUpdate]: () =>
        ++attempts === 1
          ? new Response('Bad Gateway', { status: 502 })
          : Response.json({ lastUpdate: '2026-10-08' }),
    });

    await publishAnimeIndex(directory);

    expect((await written()).metadata.source).toBe(
      'cedya77/anime-offline-database',
    );
  });

  test('keeps the published index while the preferred source is down', async () => {
    const published = await prebuiltRoutes({ checkedAt: Date.now() - day });

    fetchMock = mockFetch({ ...published, ...athanassoRoutes });

    await publishAnimeIndex(directory);

    const { metadata, file } = await written();
    const served = Object.entries(published).find(([url]) =>
      url.includes('.bin.gz'),
    )![1] as () => Response;

    // As it was published, built from the preferred source a day ago
    expect(metadata).toEqual(Object.values(published)[0]);
    expect(new Uint8Array(file)).toEqual(
      new Uint8Array(await served().arrayBuffer()),
    );
    expect(requested(upstreamURLs.athanasso)).toBe(0);
  });

  test('builds the index afresh from the fallback rather than keep one the fallback built', async () => {
    fetchMock = mockFetch({
      ...(await prebuiltRoutes({
        source: 'athanasso/anime-offline-database',
        checkedAt: Date.now() - day,
      })),
      ...athanassoRoutes,
    });

    await publishAnimeIndex(directory);

    expect((await written()).metadata.lastUpdate).toBe('2026-10-09');
  });

  test('builds it from the fallback once the published index is a day from going stale', async () => {
    fetchMock = mockFetch({
      ...(await prebuiltRoutes({ checkedAt: Date.now() - 2.5 * day })),
      ...athanassoRoutes,
    });

    await publishAnimeIndex(directory);

    expect((await written()).metadata).toMatchObject({
      source: 'athanasso/anime-offline-database',
      lastUpdate: '2026-10-09',
    });
  });

  test('publishes the current index again, whatever its age, when no upstream source answers', async () => {
    fetchMock = mockFetch(
      await prebuiltRoutes({ checkedAt: Date.now() - 2.5 * day }),
    );

    await publishAnimeIndex(directory);

    expect((await written()).metadata.source).toBe(
      'cedya77/anime-offline-database',
    );
  });

  test('gzips a published index that was served decompressed', async () => {
    fetchMock = mockFetch(await prebuiltRoutes({ serve: (file) => file }));

    await publishAnimeIndex(directory);

    expect(isGzip((await written()).file)).toBe(true);
  });

  test("doesn't publish an index again that doesn't match its metadata", async () => {
    fetchMock = mockFetch(
      await prebuiltRoutes({
        serve: () => Bun.gzipSync(packAnimeIndex(buildAnimeIndex([]).stored)),
      }),
    );

    expect(await publishAnimeIndex(directory)).toBeUndefined();
    expect(existsSync(directory)).toBe(false);
  });

  test('writes nothing when it can neither build an index nor copy the published one', async () => {
    fetchMock = mockFetch({});

    expect(await publishAnimeIndex(directory)).toBeUndefined();
    expect(existsSync(directory)).toBe(false);
  });
});
