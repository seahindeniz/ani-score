# CLAUDE.md

## Overview

AniScore is a browser extension that displays anime ratings from AniList on streaming sites. Built with SolidJS, TypeScript, and the Vitesse WebExt boilerplate. Currently supports Anizm.net and TRanimeizle with an extensible architecture for adding more sites.

This is a **Bun workspace monorepo**: Bun is both the package manager and the runtime. The extension lives in `packages/extension/`, the site in `packages/site/`, and the anime index both use in `packages/anime-index/` (its format and sources, and how it's published: the site has it build and publish the index, the extension reads it and builds it itself when the site's copy can't be used). Root scripts delegate to workspace packages.

## Commands

Most scripts run from the repo root (see root `package.json`). These two exist only in the extension package:

```bash
bun run --filter ani-score test:e2e   # Run Playwright E2E tests
bun run --filter ani-score codegen    # Generate GraphQL types from AniList schema
```

Always use `bun run test` / `bun run build`. Bare `bun build` invokes Bun's bundler instead of the package script. Bare `bun test` lacks the `--conditions development --conditions browser` flags (bunfig can't set them), so Solid resolves to its server build and rendering fails.

### Lint, format and type check

- The project uses a **Bun canary** (1.4.4 pre-release), because `bun lint` and `bun fmt` aren't in a stable release yet; CI installs `canary` too. Once 1.4.4 ships, pin it in `packageManager` and switch CI back to `bun-version-file: package.json`.
- `bun run lint` (root) runs `bun lint`, `bun fmt --check`, then each package's type check. `bun run format` formats the repo. Both use `--no-script`, since `bun lint` otherwise runs the `lint` script.
- Config is in the root `bunfig.toml`: Bun's built-in recommended rules plus `eslint-plugin-solid` for `.tsx` (it runs in JavaScript, and Bun installs `eslint` as its peer), and the `[fmt]` style.
- Editors: there's no Bun formatter/linter integration yet. In VS Code, the Run on Save extension runs `bun fmt` on save (`.vscode/settings.json`), and the pre-commit hook formats and lints staged files.
- Type checking is `bun check` (`lint` in each package), which bundles TypeScript 7. VS Code runs TypeScript 7 too, through the TypeScript Native Preview extension (`js/ts.experimental.useTsgo`); TypeScript 7 has no `tsserver.js`, so `typescript.tsdk` can't point at it, and tsserver plugins don't work.
- CSS modules are typed by generated `*.module.scss.d.ts` files (gitignored) listing their class names, so unknown class names fail the type check. `scripts/css-module-types.ts` writes them; `prepare` runs it in dev (with a watcher) and build, and the extension's `lint` runs it before `bun check`.

### Bun runtime

- `[run] bun = true` makes `node` and node-based CLIs (such as Vite) run on Bun. Bun reads `bunfig.toml` only from the current directory, so it is set in the root and in each package.
- E2E runs Playwright on Bun, which needs `@playwright/test` ≥1.64 (older versions crash loading TS on Bun). The tests launch the full `chromium` channel because headless shell can't load extensions, so install it with `bunx playwright install chromium`.

### Unit tests

- `bun test` with happy-dom; tests live in `__tests__/` folders next to the code. `packages/extension/test/` holds the setup: `preload.ts` registers the DOM, the Vite `define` globals and a fake `browser`/`chrome` (`fake-browser.ts`). `vite-compat-plugin.ts` compiles Solid JSX with `babel-preset-solid` and stubs Vite-only imports (`~icons/*`, styles, `?url`/`?raw`, `.svg`).
- `bun run test` enforces 100% line and function coverage of `src/` (minus generated `src/gql/`). Bun can't measure branches, and only reports files a test imports, so `scripts/check-coverage.ts` fails for any source file with runtime code that is missing from `coverage/lcov.info`.
- For a fresh copy of a module with state, import it with a query string (`await import('../store.ts?case=1')`); its own imports stay shared.

## Architecture

### Data Flow

1. Background script loads anime database from [cedya77/anime-offline-database](https://github.com/cedya77/anime-offline-database), falling back to [athanasso/anime-offline-database](https://github.com/athanasso/anime-offline-database) (both continue the archived manami-project dataset), through the index the site builds from them daily (`publishAnimeIndex` in `@ani-score/anime-index/publish`, which `packages/site/scripts/anime-index.ts` calls with the site's output directory in `.github/workflows/site.yml`; `@ani-score/anime-index` falls back to the upstream sources when it's missing, stale, of another format or corrupt). It checks for updates at most once a day, and keeps the database in IndexedDB as a term index (`@ani-score/anime-index`), which is read on the first title that isn't in the search cache
2. Content scripts detect anime cards on supported sites using site-specific selectors
3. Title is matched against the database to get AniList ID
4. Background script queries AniList GraphQL API for ratings/details, and keeps them 15 minutes per title (`background/logic/detailsCache.ts`), until the AniList account changes; a card asks past that after the user favorites the anime, or opens its details more than a minute after they were fetched
5. Results are displayed via Shadow DOM-encapsulated UI on the page

### Key Patterns

- **State**: Uses custom persisted stores with `webextension-polyfill` storage API (`packages/extension/src/logic/createPersistedStore.ts`)
- **Environment**: `EXTENSION=firefox` env var switches between Chrome and Firefox builds
