import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { SiteConfig } from '../src/sites/schema';
import { parseSiteConfig } from '../src/sites/schema';
import { r } from './utils';

export const sitesModuleId = 'virtual:ani-score/sites';

/**
 * The site configs in `src/sites/<id>/`: `site.json`, with the CSS of an optional `style.css` beside it appended to its
 * `css`. Sorted by id; a config that doesn't validate fails the build.
 */
export function loadBundledSites(sitesDir = r('src/sites')): SiteConfig[] {
  return Array.from(
    new Bun.Glob('*/site.json').scanSync({ cwd: sitesDir, absolute: true }),
  )
    .sort()
    .map((file) => {
      const json = JSON.parse(readFileSync(file, 'utf-8'));
      const stylePath = join(dirname(file), 'style.css');
      const css = [
        json.css,
        existsSync(stylePath) && readFileSync(stylePath, 'utf-8'),
      ]
        .filter(Boolean)
        .join('\n');

      // Only there for editors' autocomplete
      delete json.$schema;

      const result = parseSiteConfig({ ...json, ...(css && { css }) });

      if (!result.success) {
        throw new Error(`Invalid site config ${file}:\n${result.error}`);
      }

      return result.config;
    });
}

export const bundledSitesModule = (sitesDir?: string) =>
  `export default ${JSON.stringify(loadBundledSites(sitesDir))}`;
