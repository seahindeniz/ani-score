# CLAUDE.md

## Overview

AniScore is a browser extension that displays anime ratings from AniList on streaming sites. Built with SolidJS, TypeScript, and the Vitesse WebExt boilerplate. Currently supports Anizm.net and TRanimeizle with an extensible architecture for adding more sites.

This is a **pnpm workspace monorepo**. The extension lives in `packages/extension/`. Root scripts delegate to workspace packages.

## Commands

Most scripts run from the repo root (see root `package.json`). These two exist only in the extension package:

```bash
pnpm --filter ani-score test:e2e   # Run Playwright E2E tests
pnpm --filter ani-score codegen    # Generate GraphQL types from AniList schema
```

## Architecture

### Data Flow
1. Background script loads anime database from [cedya77/anime-offline-database](https://github.com/cedya77/anime-offline-database), falling back to [athanasso/anime-offline-database](https://github.com/athanasso/anime-offline-database) (both continue the archived manami-project dataset), into MiniSearch for fuzzy title matching
2. Content scripts detect anime cards on supported sites using site-specific selectors
3. Title is matched against the database to get AniList ID
4. Background script queries AniList GraphQL API for ratings/details
5. Results are displayed via Shadow DOM-encapsulated UI on the page

### Key Patterns
- **State**: Uses custom persisted stores with `webextension-polyfill` storage API (`packages/extension/src/logic/createPersistedStore.ts`)
- **Environment**: `EXTENSION=firefox` env var switches between Chrome and Firefox builds
