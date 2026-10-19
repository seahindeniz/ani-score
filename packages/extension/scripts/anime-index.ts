// Builds the prebuilt anime index the site publishes, which the extension downloads in place of an upstream database:
// `bun scripts/anime-index.ts <directory>` writes the index and its metadata into the directory.
import { join } from 'node:path';

import * as v from 'valibot';

import {
  animeIndexFormat,
  packAnimeIndex,
} from '../src/background/logic/animeIndex';
import type { PrebuiltIndexMetadata } from '../src/background/logic/databaseSources';
import {
  fetchBytes,
  fetchJSON,
  fetchRelease,
  prebuiltIndexDownloadURL,
  prebuiltIndexFiles,
  PrebuiltIndexMetadataSchema,
  prebuiltIndexURLs,
  readPrebuiltFile,
  sha256,
  upstreamSources,
} from '../src/background/logic/databaseSources';

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

async function buildFromUpstream() {
  for (const source of upstreamSources) {
    try {
      // Retried like the extension does, so one failed request doesn't make the index switch sources for a day
      const release = await fetchRelease(source, (attempt) =>
        console.warn(`Asking ${source.name} again (${attempt}/3)`),
      );
      const { stored } = await release.download();
      const file = packAnimeIndex(stored);
      const metadata: PrebuiltIndexMetadata & typeof license = {
        format: animeIndexFormat,
        source: release.source,
        lastUpdate: release.lastUpdate,
        checkedAt: new Date().toISOString(),
        sha256: await sha256(file),
        ...license,
      };

      return { metadata, file: Bun.gzipSync(file, { level: 9 }) };
    } catch (error) {
      console.warn(`Could not build the index from ${source.name}:`, error);
    }
  }

  return undefined;
}

// With no upstream source answering, the site keeps the index it has. Its metadata stays as it was, so extensions see
// how long ago it was built, and ask the upstream sources themselves once it's too old.
async function copyPublished() {
  try {
    const published = await fetchJSON<object>(prebuiltIndexURLs.metadata);
    const metadata = v.parse(PrebuiltIndexMetadataSchema, published);
    const packed = await readPrebuiltFile(
      await fetchBytes(prebuiltIndexDownloadURL(metadata)),
      metadata,
    );

    console.warn('Publishing the current index again');

    return { metadata: published, file: Bun.gzipSync(packed, { level: 9 }) };
  } catch (error) {
    console.warn('Could not copy the published index:', error);

    return undefined;
  }
}

const index = (await buildFromUpstream()) ?? (await copyPublished());

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
