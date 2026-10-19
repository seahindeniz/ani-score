// Builds the prebuilt anime index the site publishes, which the extension downloads in place of an upstream database:
// `bun scripts/anime-index.ts <directory>` writes the index and its metadata into the directory.
import { join } from 'node:path';

import {
  animeIndexFormat,
  packAnimeIndex,
} from '../src/background/logic/animeIndex';
import type { PrebuiltIndexMetadata } from '../src/background/logic/databaseSources';
import {
  fetchBytes,
  fetchJSON,
  prebuiltIndexFiles,
  prebuiltIndexSite,
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
      const release = await source.fetchRelease();
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
  console.warn('Publishing the current index again');

  const url = (file: string) => new URL(file, prebuiltIndexSite).href;

  return {
    metadata: await fetchJSON(url(prebuiltIndexFiles.metadata)),
    file: new Uint8Array(await fetchBytes(url(prebuiltIndexFiles.index))),
  };
}

const { metadata, file } =
  (await buildFromUpstream()) ?? (await copyPublished());

// `Bun.write` creates the directory when needed
await Bun.write(
  join(directory, prebuiltIndexFiles.metadata),
  `${JSON.stringify(metadata, null, 2)}\n`,
);
await Bun.write(join(directory, prebuiltIndexFiles.index), file);

console.log(
  `Wrote ${prebuiltIndexFiles.index} (${(file.byteLength / 1e6).toFixed(2)} MB):`,
  metadata,
);
