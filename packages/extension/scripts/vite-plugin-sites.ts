import type { Plugin } from 'vite';

import { r } from './utils.ts';

// Same as `sitesModuleId` in sites.ts, which is only imported when the module is built (see `load`)
const sitesModuleId = 'virtual:ani-score/sites';
const resolvedSitesModuleId = `\0${sitesModuleId}`;

/**
 * Serves the bundled site configs as `virtual:ani-score/sites`, validated at build time.
 */
export function bundledSitesPlugin(): Plugin {
  return {
    name: 'ani-score-sites',
    resolveId: (id) => (id === sitesModuleId ? resolvedSitesModuleId : null),
    async load(id) {
      if (id !== resolvedSitesModuleId) return null;

      // Rebuilds in watch mode when a config changes or one is added
      this.addWatchFile(r('src/sites'));

      for (const file of new Bun.Glob('*/{site.json,style.css}').scanSync({
        cwd: r('src/sites'),
        absolute: true,
      }))
        this.addWatchFile(file);

      // A computed path, which Vite's config loader doesn't follow: the imports in src/ have no file extensions, which
      // its native loader warns about
      const { bundledSitesModule } = (await import(
        r('scripts/sites.ts')
      )) as typeof import('./sites.ts');

      return bundledSitesModule();
    },
  };
}
