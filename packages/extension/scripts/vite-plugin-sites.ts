import { normalize } from 'node:path';

import type { Plugin } from 'vite';

import { r } from './utils.ts';

// Same as `sitesModuleId` in sites.ts, which is only imported when the module is built (see `load`)
const sitesModuleId = 'virtual:ani-score/sites';
const resolvedSitesModuleId = `\0${sitesModuleId}`;
const sitesDir = r('src/sites');

/**
 * Serves the bundled site configs as `virtual:ani-score/sites`, validated at build time.
 */
export function bundledSitesPlugin(): Plugin {
  let serving = false;

  return {
    name: 'ani-score-sites',
    configResolved(config) {
      serving = config.command === 'serve';
    },
    resolveId: (id) => (id === sitesModuleId ? resolvedSitesModuleId : null),
    // The dev server reloads the page when a config changes or one is added. It can't use `addWatchFile` for that:
    // it treats each watched file as an import of the module, and fails on the folder
    configureServer(server) {
      const onChange = (file: string) => {
        if (!normalize(file).startsWith(sitesDir)) return;

        for (const environment of Object.values(server.environments)) {
          const module = environment.moduleGraph.getModuleById(
            resolvedSitesModuleId,
          );

          if (module) environment.moduleGraph.invalidateModule(module);
        }

        server.ws.send({ type: 'full-reload' });
      };

      server.watcher.add(sitesDir);
      server.watcher.on('add', onChange);
      server.watcher.on('change', onChange);
      server.watcher.on('unlink', onChange);
    },
    async load(id) {
      if (id !== resolvedSitesModuleId) return null;

      // Builds in watch mode run again when a config changes or one is added
      if (!serving) {
        this.addWatchFile(sitesDir);

        for (const file of new Bun.Glob('*/{site.json,style.css}').scanSync({
          cwd: sitesDir,
          absolute: true,
        }))
          this.addWatchFile(file);
      }

      // A computed path, which Vite's config loader doesn't follow: the imports in src/ have no file extensions, which
      // its native loader warns about
      const { bundledSitesModule } = (await import(
        r('scripts/sites.ts')
      )) as typeof import('./sites.ts');

      return bundledSitesModule();
    },
  };
}
