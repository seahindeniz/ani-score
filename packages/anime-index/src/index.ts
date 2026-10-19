// The anime index and where it comes from, shared by the extension, which reads it (and builds it itself when the
// site's copy is unavailable), and the site, which builds and publishes it. Its format is the contract between them.
export type { AnimeData, AnimeMatch } from './animeData';
export * from './animeIndex';
export * from './databaseSources';
