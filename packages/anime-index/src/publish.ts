// Builds the index the site publishes, and writes it into the site's output. It runs on Bun, in the site's build, so it
// has an entry point of its own (`@ani-score/anime-index/publish`) that the extension never bundles. The tests that
// stand in for the site use it too.
import { join } from 'node:path';

import type { AnimeIndexData } from './animeIndex';
import { animeIndexFormat, packAnimeIndex } from './animeIndex';
import type { DatabaseRelease } from './databaseSources';
import {
  fetchBytes,
  FetchError,
  fetchJSON,
  fetchRelease,
  isGzip,
  parsePrebuiltIndexMetadata,
  prebuiltIndexDownloadURL,
  prebuiltIndexFiles,
  prebuiltIndexURLs,
  readPrebuiltFile,
  sha256,
  upstreamSources,
} from './databaseSources';

export { packAnimeIndex } from './animeIndex';
export { prebuiltIndexDownloadURL } from './databaseSources';

// The index is a database derived from the upstream one, so it's shared under the same terms
const license = {
  license: 'ODbL-1.0, with contents under DbCL-1.0',
  attribution:
    'Built from https://github.com/cedya77/anime-offline-database, a continuation of https://github.com/manami-project/anime-offline-database',
};

/**
 * The index of a release as the site publishes it: the packed file (which it gzips) and its metadata.
 */
export async function createPrebuiltIndex(
  release: Pick<DatabaseRelease, 'source' | 'lastUpdate'>,
  stored: AnimeIndexData,
  checkedAt = new Date(),
) {
  const file = packAnimeIndex(stored);
  // Checked like extensions check it, so the site can't publish an index they would refuse
  const metadata = parsePrebuiltIndexMetadata({
    format: animeIndexFormat,
    source: release.source,
    lastUpdate: release.lastUpdate,
    checkedAt: checkedAt.toISOString(),
    sha256: await sha256(file),
  });

  return { metadata, file };
}

interface PublishedIndex {
  metadata: object;
  /**
   * The gzipped index.
   */
  file: Uint8Array<ArrayBuffer>;
}

async function buildFromPreferredSource(): Promise<PublishedIndex | undefined> {
  const [source] = upstreamSources;

  try {
    // Retried like the extension does
    const release = await fetchRelease(source, (attempt, retries) =>
      console.warn(`Asking ${source.name} again (${attempt}/${retries})`),
    );
    const { metadata, file } = await createPrebuiltIndex(
      release,
      (await release.download()).stored,
    );

    return {
      metadata: { ...metadata, ...license },
      file: Bun.gzipSync(file, { level: 9 }),
    };
  } catch (error) {
    console.warn(`Could not build the index from ${source.name}:`, error);

    return undefined;
  }
}

/**
 * The published index again, as is, or nothing when none is published yet. Its metadata stays as it was, so
 * extensions see how long ago it was built, and turn to the upstream sources themselves once it's too old. Throws for
 * a published index it can't reach or read.
 */
async function copyPublished(): Promise<PublishedIndex | undefined> {
  let published: object;

  try {
    published = await fetchJSON<object>(prebuiltIndexURLs.metadata);
  } catch (error) {
    if (error instanceof FetchError && error.status === 404) return undefined;

    throw error;
  }

  const metadata = parsePrebuiltIndexMetadata(published);
  const file = await fetchBytes(prebuiltIndexDownloadURL(metadata));
  const packed = await readPrebuiltFile(file, metadata);

  console.warn('Publishing the current index again');

  return {
    metadata: published,
    file: isGzip(file)
      ? new Uint8Array(file)
      : Bun.gzipSync(new Uint8Array(packed), { level: 9 }),
  };
}

/**
 * Builds the index from the preferred upstream source and writes it, with its metadata, into the directory. While that
 * source is down, the published index is written again instead: one built from a fallback would have extensions take
 * that source's data, then download again once the preferred one is back.
 *
 * Resolves with what it wrote, or with nothing when there's no index to write and none is published, e.g. on the first
 * deploy (or the first of a new format) while the source is down; extensions then download from the upstream sources.
 * Throws when the published index can't be copied, so a deploy doesn't drop it.
 */
export async function publishAnimeIndex(directory: string) {
  const index = (await buildFromPreferredSource()) ?? (await copyPublished());

  if (!index) return undefined;

  // `Bun.write` creates the directory when needed
  await Bun.write(
    join(directory, prebuiltIndexFiles.metadata),
    `${JSON.stringify(index.metadata, null, 2)}\n`,
  );
  await Bun.write(join(directory, prebuiltIndexFiles.index), index.file);

  return index;
}
