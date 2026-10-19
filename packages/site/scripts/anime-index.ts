// Builds the anime index the site publishes, which the extension downloads in place of an upstream database:
// `bun scripts/anime-index.ts <directory>` writes the index and its metadata into the directory.
import { join } from 'node:path';

import type {
  DatabaseSource,
  PrebuiltIndexMetadata,
} from '@ani-score/anime-index';
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
  readPrebuiltFile,
  upstreamSources,
} from '@ani-score/anime-index';

const directory = process.argv[2];

if (!directory) {
  console.error('Usage: bun scripts/anime-index.ts <directory>');
  process.exit(1);
}

// The index is a database derived from the upstream one, so it's shared under the same terms
const license = {
  license: 'ODbL-1.0, with contents under DbCL-1.0',
  attribution:
    'Built from anime-offline-database (https://github.com/cedya77/anime-offline-database, or https://github.com/athanasso/anime-offline-database when it is unavailable), continuations of https://github.com/manami-project/anime-offline-database',
};

/**
 * How long the published index is kept while the preferred source is down, before it's built from the fallback. Below
 * the extension's 3 days, so it never goes stale while the fallback answers.
 */
const republishMaxAge = 2 * 24 * 60 * 60 * 1000;

async function buildFrom(source: DatabaseSource) {
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
) {
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
        : Bun.gzipSync(packed, { level: 9 }),
    };
  } catch (error) {
    console.warn('Could not copy the published index:', error);

    return undefined;
  }
}

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

// E.g. the first deploy, or the first of a new format, while the upstream sources are down. The site's other changes
// still go out, and extensions download from the upstream sources until a later deploy carries an index.
if (!index) {
  console.warn(
    '::warning::Deploying the site without the prebuilt anime index',
  );
  process.exit(0);
}

// `Bun.write` creates the directory when needed
await Bun.write(
  join(directory, prebuiltIndexFiles.metadata),
  `${JSON.stringify(index.metadata, null, 2)}\n`,
);
await Bun.write(join(directory, prebuiltIndexFiles.index), index.file);

console.log(
  `Wrote ${prebuiltIndexFiles.index} (${(index.file.byteLength / 1e6).toFixed(2)} MB):`,
  index.metadata,
);
