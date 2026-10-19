import * as v from 'valibot';

import type { AnimeData } from '~/logic/animeData';

import type { BuiltAnimeIndex } from './animeIndex';
import {
  animeIndexFormat,
  buildAnimeIndex,
  readAnimeIndex,
  unpackAnimeIndex,
} from './animeIndex';

// Imported by `scripts/anime-index.ts` too, so nothing here may need the extension's build (e.g. the logger)

export class FetchError extends Error {
  constructor(
    url: string,
    readonly response: Response,
  ) {
    super(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
}

async function fetchOk(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new FetchError(url, response);
  }

  return response;
}

export async function fetchJSON<T>(url: string) {
  return (await (await fetchOk(url)).json()) as T;
}

export async function fetchBytes(url: string) {
  return (await fetchOk(url)).arrayBuffer();
}

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

export const prebuiltIndexSite = 'https://aniscore.link/';

/**
 * The files the site publishes the prebuilt index in. The format in their names lets an extension of another format
 * fall back to the upstream sources rather than misread them.
 */
export const prebuiltIndexFiles = {
  metadata: `anime-index-v${animeIndexFormat}.json`,
  index: `anime-index-v${animeIndexFormat}.bin.gz`,
};

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

// A host may serve the gzip file gzip-encoded, which the browser then decompresses itself
async function gunzip(file: ArrayBuffer) {
  const [first, second] = new Uint8Array(file.slice(0, 2));

  if (first !== 0x1f || second !== 0x8b) return file;

  return new Response(
    new Blob([file]).stream().pipeThrough(new DecompressionStream('gzip')),
  ).arrayBuffer();
}

/**
 * The index the site builds from the preferred upstream source each day, about a twelfth of that source's download,
 * and searchable once unpacked.
 */
export const prebuiltSource: DatabaseSource = {
  name: 'aniscore.link',
  fetchRelease: async () => {
    const metadata = v.parse(
      PrebuiltIndexMetadataSchema,
      await fetchJSON(
        new URL(prebuiltIndexFiles.metadata, prebuiltIndexSite).href,
      ),
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
        const url = new URL(prebuiltIndexFiles.index, prebuiltIndexSite);

        // A cache in between could still hold the file the metadata replaced
        url.searchParams.set('sha256', metadata.sha256);

        const file = await gunzip(await fetchBytes(url.href));

        if ((await sha256(file)) !== metadata.sha256) {
          throw new Error("The prebuilt anime index doesn't match its SHA-256");
        }

        const stored = unpackAnimeIndex(file);

        return { stored, index: readAnimeIndex(stored) };
      },
    };
  },
};
