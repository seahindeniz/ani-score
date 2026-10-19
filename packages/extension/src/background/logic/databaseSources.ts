import * as v from 'valibot';

import type { AnimeData } from '~/logic/animeData';
import { wait } from '~/utils/wait';

import type { BuiltAnimeIndex } from './animeIndex';
import {
  animeIndexFormat,
  buildAnimeIndex,
  readAnimeIndex,
  unpackAnimeIndex,
} from './animeIndex';

// Imported by `scripts/anime-index.ts` too, so nothing here may need the extension's build (e.g. the logger)

/**
 * A request that failed, and whether asking again may work: after a network or server error, or a body that broke
 * off, but not for a missing file or a rate limit.
 */
export class FetchError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

async function request<T>(
  url: string,
  init: RequestInit | undefined,
  read: (response: Response) => Promise<T>,
) {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new FetchError(`Failed to fetch ${url}`, true, { cause: error });
  }

  if (!response.ok) {
    throw new FetchError(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
      response.status >= 500,
    );
  }

  try {
    return await read(response);
  } catch (error) {
    throw new FetchError(`Failed to read ${url}`, true, { cause: error });
  }
}

/**
 * A body that broke off may arrive whole when asked again; one that arrived whole but isn't JSON (e.g. a captive
 * portal's page) won't, so only reading it is retried, not parsing it.
 */
export async function fetchJSON<T>(url: string, init?: RequestInit) {
  return JSON.parse(
    await request(url, init, (response) => response.text()),
  ) as T;
}

export const fetchBytes = (url: string) =>
  request(url, undefined, (response) => response.arrayBuffer());

export interface DatabaseRelease {
  /**
   * Name of the upstream source the data comes from. A mirror names the one it copies, so its data compares with
   * data from that source.
   */
  source: string;
  /**
   * The release's last update date as `YYYY-MM-DD`.
   */
  lastUpdate: string;
  download: () => Promise<BuiltAnimeIndex>;
}

export interface DatabaseSource {
  name: string;
  /**
   * Asks for the latest release, without downloading it.
   */
  fetchRelease: () => Promise<DatabaseRelease>;
  /**
   * How many times a failed request is asked again.
   * @default 3
   */
  retries?: number;
}

/**
 * Asks the source for its latest release, and asks again up to three times, with growing pauses, while its requests
 * fail in a way that may pass.
 */
export async function fetchRelease(
  source: DatabaseSource,
  onRetry: (attempt: number, retries: number) => void,
) {
  const { retries = 3 } = source;

  for (let attempt = 1; ; attempt++) {
    try {
      const release = await source.fetchRelease();

      // An unparsable date would make every comparison false and silently keep the stored database forever
      if (Number.isNaN(Date.parse(release.lastUpdate))) {
        throw new TypeError(
          `Invalid last update date from ${source.name}: ${release.lastUpdate}`,
        );
      }

      return release;
    } catch (error) {
      if (
        attempt > retries
        || !(error instanceof FetchError && error.retryable)
      ) {
        throw error;
      }

      onRetry(attempt, retries);
      await wait(1000 * 2 ** (attempt - 1));
    }
  }
}

function upstreamSource(
  name: string,
  databaseURL: string,
  fetchLastUpdate: () => Promise<string>,
): DatabaseSource {
  return {
    name,
    fetchRelease: async () => ({
      source: name,
      lastUpdate: await fetchLastUpdate(),
      download: async () =>
        buildAnimeIndex(
          (await fetchJSON<{ data: AnimeData[] }>(databaseURL)).data,
        ),
    }),
  };
}

/**
 * Continuations of the archived manami-project/anime-offline-database, in order of preference.
 */
export const upstreamSources = [
  upstreamSource(
    'cedya77/anime-offline-database',
    'https://github.com/cedya77/anime-offline-database/releases/download/latest/anime-offline-database-minified.json',
    // A small file from the same release, so the update check doesn't download the whole database
    async () =>
      (
        await fetchJSON<{ lastUpdate: string }>(
          'https://github.com/cedya77/anime-offline-database/releases/download/latest/animenewsnetwork-minified.json',
        )
      ).lastUpdate,
  ),
  upstreamSource(
    'athanasso/anime-offline-database',
    'https://github.com/athanasso/anime-offline-database/releases/latest/download/anime-offline-database-minified.json',
    // No small metadata file is published and its `lastUpdate` is a Unix timestamp, so the release date is used instead
    async () =>
      (
        await fetchJSON<{ published_at: string }>(
          'https://api.github.com/repos/athanasso/anime-offline-database/releases/latest',
        )
      ).published_at.slice(0, 10),
  ),
];

const prebuiltIndexSite = 'https://aniscore.link/';

/**
 * The files the site publishes the prebuilt index in. The format in their names lets an extension of another format
 * fall back to the upstream sources rather than misread them.
 */
export const prebuiltIndexFiles = {
  metadata: `anime-index-v${animeIndexFormat}.json`,
  index: `anime-index-v${animeIndexFormat}.bin.gz`,
};

export const prebuiltIndexURLs = {
  metadata: new URL(prebuiltIndexFiles.metadata, prebuiltIndexSite).href,
  index: new URL(prebuiltIndexFiles.index, prebuiltIndexSite).href,
};

/**
 * Where to download the index the metadata describes. A cache in between could still hold the file it replaced.
 */
export const prebuiltIndexDownloadURL = (metadata: { sha256: string }) =>
  `${prebuiltIndexURLs.index}?sha256=${metadata.sha256}`;

/**
 * The prebuilt index's metadata, as `scripts/anime-index.ts` writes it next to the index.
 */
export const PrebuiltIndexMetadataSchema = v.object({
  format: v.literal(animeIndexFormat),
  source: v.picklist(upstreamSources.map(({ name }) => name)),
  lastUpdate: v.string(),
  /**
   * When the site's daily job last built the index from its source.
   */
  checkedAt: v.pipe(v.string(), v.isoTimestamp()),
  /**
   * SHA-256 of the packed index before gzip, as a host may also serve it decompressed.
   */
  sha256: v.pipe(v.string(), v.hexadecimal(), v.length(64)),
});

export type PrebuiltIndexMetadata = v.InferOutput<
  typeof PrebuiltIndexMetadataSchema
>;

/**
 * How long a prebuilt index may go without being built again before the upstream sources are asked instead, e.g. once
 * the site's daily job stopped.
 */
const prebuiltMaxAge = 3 * 24 * 60 * 60 * 1000;

export async function sha256(file: ArrayBuffer | Uint8Array<ArrayBuffer>) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', file));

  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

/**
 * The packed index in a downloaded file, which is gzipped, unless a host served it gzip-encoded and the browser
 * already decompressed it. Throws unless it's the one the metadata describes.
 */
export function isGzip(file: ArrayBuffer) {
  const [first, second] = new Uint8Array(file.slice(0, 2));

  return first === 0x1f && second === 0x8b;
}

export async function readPrebuiltFile(
  file: ArrayBuffer,
  metadata: PrebuiltIndexMetadata,
) {
  const packed = isGzip(file)
    ? await new Response(
        new Blob([file]).stream().pipeThrough(new DecompressionStream('gzip')),
      ).arrayBuffer()
    : file;

  if ((await sha256(packed)) !== metadata.sha256) {
    throw new Error("The prebuilt anime index doesn't match its SHA-256");
  }

  return packed;
}

/**
 * The index the site builds from the preferred upstream source each day, about a twelfth of that source's download,
 * and searchable once unpacked.
 */
export const prebuiltSource: DatabaseSource = {
  name: 'aniscore.link',
  // Only once: the upstream sources still answer while the site is down, and a first install waits for them
  retries: 1,
  fetchRelease: async () => {
    const metadata = v.parse(
      PrebuiltIndexMetadataSchema,
      // Asks the site even when the browser holds a recent copy, which could describe a file a deploy since replaced
      await fetchJSON(prebuiltIndexURLs.metadata, { cache: 'no-cache' }),
    );
    const age = Date.now() - Date.parse(metadata.checkedAt);

    if (age > prebuiltMaxAge) {
      throw new Error(
        `The prebuilt anime index was last built at ${metadata.checkedAt}`,
      );
    }

    return {
      source: metadata.source,
      lastUpdate: metadata.lastUpdate,
      download: async () => {
        const stored = unpackAnimeIndex(
          await readPrebuiltFile(
            await fetchBytes(prebuiltIndexDownloadURL(metadata)),
            metadata,
          ),
        );

        return { stored, index: readAnimeIndex(stored) };
      },
    };
  },
};
