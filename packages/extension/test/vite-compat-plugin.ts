import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { transformAsync } from '@babel/core';
import presetTypeScript from '@babel/preset-typescript';
import presetSolid from 'babel-preset-solid';
import type { BunPlugin } from 'bun';

const srcDir = join(import.meta.dir, '../src');

const sourceFiles = Array.from(new Bun.Glob('**/*.{ts,tsx}').scanSync(srcDir))
  .filter((file) => !file.startsWith('node_modules'))
  .map((file) => ({
    path: join(srcDir, file),
    source: readFileSync(join(srcDir, file), 'utf-8'),
  }));

// Every `~icons/...` specifier the app imports, e.g. `~icons/mdi/heart`
const iconImports = new Set(
  sourceFiles.flatMap(({ source }) =>
    Array.from(source.matchAll(/from '(~icons\/[^']+)'/g), ([, icon]) => icon),
  ),
);

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The `.ts` files that use `import.meta.hot`, also when imported as a fresh instance such as `main.ts?case=1`
const hotFiles = sourceFiles
  .filter(
    ({ path, source }) =>
      path.endsWith('.ts') && source.includes('import.meta.hot'),
  )
  .map(({ path }) => escapeRegExp(path).replace(/\\\\|\//g, '[/\\\\]'));
const hotFilesFilter = new RegExp(
  `^(?:${hotFiles.join('|') || '(?!)'})(?:\\?.*)?$`,
);

/**
 * Teaches Bun what Vite does for the app: compiles Solid's JSX and stands in for Vite-only imports (icons, styles,
 * assets). Bun only calls `onResolve` for relative and absolute specifiers, so bare ones are registered as virtual
 * modules instead, and the `~/` alias comes from `paths` in tsconfig.json.
 */
export const viteCompatPlugin: BunPlugin = {
  name: 'vite-compat',
  setup(build) {
    for (const icon of iconImports) {
      build.module(icon, () => ({
        loader: 'js',
        contents: `
          export default function Icon(props = {}) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
            svg.setAttribute('data-icon', ${JSON.stringify(icon.slice('~icons/'.length))})
            if (props.class)
              svg.setAttribute('class', props.class)
            return svg
          }
        `,
      }));
    }

    build.module('uno.css', () => ({ loader: 'js', contents: '' }));
    // Vite's HMR client, which only the dev server can serve; records the load so tests can check it
    build.module('/@vite/client', () => ({
      loader: 'js',
      contents: 'globalThis.__VITE_CLIENT_LOADED__ = true',
    }));

    // Vite sets `import.meta.hot` on its dev server; tests switch it on by setting `globalThis.__VITE_HOT__`
    build.onLoad({ filter: hotFilesFilter }, async ({ path }) => {
      const source = await Bun.file(path.replace(/\?.*$/, '')).text();

      return {
        loader: 'ts',
        contents: source.replaceAll(
          'import.meta.hot',
          'globalThis.__VITE_HOT__',
        ),
      };
    });

    // `?url` and `?raw` asset imports
    build.onResolve({ filter: /\?(url|raw)$/ }, ({ path, importer }) => {
      const [file, query] = path.split('?');

      return {
        path: `${Bun.resolveSync(file, join(importer, '..'))}?${query}`,
        namespace: 'asset-query',
      };
    });
    build.onLoad(
      { filter: /.*/, namespace: 'asset-query' },
      async ({ path }) => {
        const [file, query] = path.split('?');

        return {
          loader: 'js',
          contents: `export default ${JSON.stringify(query === 'raw' ? await Bun.file(file).text() : `/${basename(file)}`)}`,
        };
      },
    );

    build.onLoad({ filter: /\.module\.s?css$/ }, () => ({
      loader: 'js',
      // Class names map to themselves, e.g. `styles.container === 'container'`
      contents: 'export default new Proxy({}, { get: (_, name) => name })',
    }));
    build.onLoad({ filter: /\.s?css$/ }, () => ({
      loader: 'js',
      contents: '',
    }));
    build.onLoad({ filter: /\.svg$/ }, ({ path }) => ({
      loader: 'js',
      contents: `export default ${JSON.stringify(`/${basename(path)}`)}`,
    }));

    // Also matches fresh-instance imports such as `main.tsx?case=1`
    build.onLoad({ filter: /\.tsx(\?.*)?$/ }, async ({ path }) => {
      const file = path.replace(/\?.*$/, '');
      const result = await transformAsync(await Bun.file(file).text(), {
        filename: file,
        babelrc: false,
        configFile: false,
        // Keeps line numbers in coverage reports pointing at the source
        retainLines: true,
        presets: [
          // Same options as vite-plugin-solid in vite.config.ts
          [presetSolid, { delegateEvents: false }],
          [presetTypeScript, { isTSX: true, allExtensions: true }],
        ],
      });

      return { loader: 'js', contents: result?.code ?? '' };
    });
  },
};
