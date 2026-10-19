import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildAnimeIndex,
  readAnimeIndex,
  unpackAnimeIndex,
} from '../animeIndex';
import {
  isGzip,
  parsePrebuiltIndexMetadata,
  prebuiltIndexFiles,
  prebuiltIndexURLs,
  readPrebuiltFile,
} from '../databaseSources';
import {
  createPrebuiltIndex,
  packAnimeIndex,
  publishAnimeIndex,
} from '../publish';
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
  });

  test('asks the preferred source again after a failed request', async () => {
    let attempts = 0;

    fetchMock = mockFetch({
      ...cedya77Routes,
      [upstreamURLs.cedya77LastUpdate]: () =>
        ++attempts === 1
          ? new Response('Bad Gateway', { status: 502 })
          : Response.json({ lastUpdate: '2026-10-08' }),
    });

    await publishAnimeIndex(directory);

    expect((await written()).metadata.lastUpdate).toBe('2026-10-08');
  });

  test('publishes the current index again, whatever its age, while the preferred source is down', async () => {
    const published = await prebuiltRoutes({ checkedAt: Date.now() - 5 * day });

    fetchMock = mockFetch({ ...published, ...athanassoRoutes });

    await publishAnimeIndex(directory);

    const { metadata, file } = await written();
    const served = Object.entries(published).find(([url]) =>
      url.includes('.bin.gz'),
    )![1] as () => Response;

    // As it was published; extensions see its age, and turn to the upstream sources themselves
    expect(metadata).toEqual(Object.values(published)[0]);
    expect(new Uint8Array(file)).toEqual(
      new Uint8Array(await served().arrayBuffer()),
    );
    // Not built from the fallback source
    expect(requested(upstreamURLs.athanassoRelease)).toBe(0);
  });

  test('gzips a published index that was served decompressed', async () => {
    fetchMock = mockFetch(await prebuiltRoutes({ serve: (file) => file }));

    await publishAnimeIndex(directory);

    expect(isGzip((await written()).file)).toBe(true);
  });

  test('writes nothing when there is no index to build and none is published', async () => {
    fetchMock = mockFetch({});

    expect(await publishAnimeIndex(directory)).toBeUndefined();
    expect(existsSync(directory)).toBe(false);
  });

  test("fails rather than drop a published index it can't copy", async () => {
    // Unreachable, or not the file its metadata describes
    for (const routes of [
      {
        [prebuiltIndexURLs.metadata]: () =>
          new Response('Service Unavailable', { status: 503 }),
      },
      await prebuiltRoutes({
        serve: () => Bun.gzipSync(packAnimeIndex(buildAnimeIndex([]).stored)),
      }),
    ]) {
      fetchMock?.mockRestore();
      fetchMock = mockFetch(routes);

      await expect(publishAnimeIndex(directory)).rejects.toThrow();
      expect(existsSync(directory)).toBe(false);
    }
  });
});

describe('createPrebuiltIndex', () => {
  test('refuses to describe an index that extensions would refuse', async () => {
    await expect(
      createPrebuiltIndex(
        {
          source: 'athanasso/anime-offline-database',
          lastUpdate: '2026-10-09',
        },
        buildAnimeIndex(entries).stored,
      ),
    ).rejects.toThrow();
  });
});
