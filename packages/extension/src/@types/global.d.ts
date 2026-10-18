declare const __DEV__: boolean;
/** Extension name, defined in packageJson.name */
declare const __NAME__: string;
declare const ANILIST_TOKEN_URL: string;
declare const __TARGET_BROWSER__: 'chrome' | 'firefox';

/** The bundled site configs from `src/sites/`, served by `bundledSitesPlugin` in `scripts/sites.ts` */
declare module 'virtual:ani-score/sites' {
  const sites: import('~/sites/schema').SiteConfig[];
  export default sites;
}
