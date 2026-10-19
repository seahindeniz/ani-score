// The anime index and where it comes from, shared by the extension, which reads it (and builds it itself when the
// site's copy can't be used), and the site, which publishes it with `@ani-score/anime-index/publish`. Its format is
// the contract between them.
export type { AnimeData, AnimeMatch } from './animeData';
export type { AnimeIndex, AnimeIndexData, BuiltAnimeIndex } from './animeIndex';
export {
  animeIndexFormat,
  buildAnimeIndex,
  listSiteHosts,
  readAnimeIndex,
} from './animeIndex';
export type { DatabaseRelease, DatabaseSource } from './databaseSources';
export {
  fetchRelease,
  prebuiltIndexFiles,
  prebuiltIndexURLs,
  prebuiltSource,
  upstreamSources,
} from './databaseSources';
