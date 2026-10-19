// Writes the anime index the extension downloads into the site's output: `bun scripts/anime-index.ts <directory>`
import { publishAnimeIndex } from '@ani-score/anime-index/publish';

const directory = process.argv[2];

if (!directory) {
  console.error('Usage: bun scripts/anime-index.ts <directory>');
  process.exit(1);
}

const index = await publishAnimeIndex(directory);

if (index) {
  console.log(
    `Wrote the anime index (${(index.file.byteLength / 1e6).toFixed(2)} MB):`,
    index.metadata,
  );
} else {
  // The site's other changes still go out
  console.warn(
    '::warning::Deploying the site without the prebuilt anime index',
  );
}
