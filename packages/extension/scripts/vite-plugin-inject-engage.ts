import { existsSync } from 'node:fs';

import type { Plugin } from 'vite';

import { getContentScriptScope } from '../src/utils/contentScripts';

export function injectEngageWithSite(include: string[]): Plugin {
  const globs = include.map((pattern) => new Bun.Glob(pattern));

  return {
    name: 'inject-engage-with-site',
    enforce: 'pre',
    transform(code, id) {
      // Only real files; virtual and query-suffixed module ids don't exist on disk
      if (!globs.some((glob) => glob.match(id)) || !existsSync(id)) {
        return null;
      }

      const detail = getContentScriptScope(id);

      return {
        code: `${code}\n\nwindow.engageWithSite(config, '${detail.directory}')`,
        map: null,
      };
      // // Check if this file should be processed
      // const shouldInclude = include.some(pattern =>
      //   id.includes(pattern.replace(/\*/g, ''))
      //   || new RegExp(pattern.replace(/\*/g, '.*')).test(id),
      // )

      // const shouldExclude = exclude.some(pattern =>
      //   id.includes(pattern.replace(/\*/g, ''))
      //   || new RegExp(pattern.replace(/\*/g, '.*')).test(id),
      // )

      // if (!shouldInclude || shouldExclude) {
      //   return null
      // }

      // // Check if file exports a config (if required)
      // if (onlyIfConfigExists && !code.includes('export const config')) {
      //   return null
      // }

      // // Check if engageWithSite is already called
      // if (code.includes('window.engageWithSite(')) {
      //   return null
      // }

      // // Inject the call at the end
      // const injectedCode = `${code}\n\nwindow.engageWithSite(config)`

      // return {
      //   code: injectedCode,
      //   map: null, // You could generate a source map here if needed
      // }
    },
  };
}
