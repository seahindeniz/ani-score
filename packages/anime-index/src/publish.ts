// Builds the index the site publishes, and writes it into the site's output. It runs on Bun, in the site's build, so it
// has an entry point of its own (`@ani-score/anime-index/publish`) that the extension never imports.
import { join } from 'node:path';

import type { DatabaseSource, PrebuiltIndexMetadata } from './databaseSources';
import {
  createPrebuiltIndex,
  fetchBytes,
  fetchJSON,
  fetchRelease,
  isGzip,
  parsePrebuiltIndexMetadata,
  prebuiltIndexDownloadURL,
  prebuiltIndexFiles,
  prebuiltIndexURLs,
  prebuiltMaxAge,
  readPrebuiltFile,
  upstreamSources,
} from './databaseSources';

// The index is a database derived from the upstream one, so it's shared under the same terms
const license = {
  license: 'ODbL-1.0, with contents under DbCL-1.0',
  attribution:
    'Built from anime-offline-database (https://github.com/cedya77/anime-offline-database, or https://github.com/athanasso/anime-offline-database when it is unavailable), continuations of https://github.com/manami-project/anime-offline-database',
};

/**
 * How long the published index is kept while the preferred source is down, before it's built from the fallback: a day
 * less than extensions accept it for, so it never goes stale while the fallback answers.
 */
const republishMaxAge = prebuiltMaxAge - 24 * 60 * 60 * 1000;

interface PublishedIndex {
  metadata: object;
  /**
   * The gzipped index.
   */
  file: Uint8Array<ArrayBuffer>;
}

async function buildFrom(
  source: DatabaseSource,
): Promise<PublishedIndex | undefined> {
  try {
    // Retried like the extension does, so one failed request doesn't make the index switch sources
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
 * The published index again, as is, if `accept` takes it. Its metadata stays as it was, so extensions see how long ago
 * it was built, and ask the upstream sources themselves once it's too old.
 */
async function copyPublished(
  accept: (metadata: PrebuiltIndexMetadata) => boolean = () => true,
): Promise<PublishedIndex | undefined> {
  try {
    const published = await fetchJSON<object>(prebuiltIndexURLs.metadata);
    const metadata = parsePrebuiltIndexMetadata(published);

    if (!accept(metadata)) return undefined;

    const file = await fetchBytes(prebuiltIndexDownloadURL(metadata));
    const packed = await readPrebuiltFile(file, metadata);

    console.warn('Publishing the current index again');

    return {
      metadata: published,
      file: isGzip(file)
        ? new Uint8Array(file)
        : Bun.gzipSync(new Uint8Array(packed), { level: 9 }),
    };
  } catch (error) {
    console.warn('Could not copy the published index:', error);

    return undefined;
  }
}

/**
 * Builds the index from the preferred upstream source and writes it, with its metadata, into the directory. Resolves
 * with what it wrote, or with nothing when it could neither build the index nor copy the published one (e.g. the
 * first deploy, or the first of a new format, while the upstream sources are down); extensions then download from the
 * upstream sources until a later deploy carries an index.
 */
export async function publishAnimeIndex(directory: string) {
  const [preferred, ...fallbacks] = upstreamSources;

  // While the preferred source is down briefly, the index it built stays. One built from a fallback would have users
  // download twice: the fallback's data, then the preferred source's once it's back.
  let index =
    (await buildFrom(preferred))
    ?? (await copyPublished(
      (metadata) =>
        metadata.source === preferred.name
        && Date.now() - Date.parse(metadata.checkedAt) < republishMaxAge,
    ));

  for (const source of fallbacks) {
    index ??= await buildFrom(source);
  }

  index ??= await copyPublished();

  if (!index) return undefined;

  // `Bun.write` creates the directory when needed
  await Bun.write(
    join(directory, prebuiltIndexFiles.metadata),
    `${JSON.stringify(index.metadata, null, 2)}\n`,
  );
  await Bun.write(join(directory, prebuiltIndexFiles.index), index.file);

  return index;
}
