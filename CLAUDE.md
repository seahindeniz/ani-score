# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AniScore is a browser extension that displays anime ratings from AniList on streaming sites. Built with SolidJS, TypeScript, and the Vitesse WebExt boilerplate. Currently supports Anizm.net with an extensible architecture for adding more sites.

## Commands

```bash
pnpm install          # Install dependencies (requires Node.js 22+)
pnpm dev              # Development mode for Chrome/Chromium
pnpm dev-firefox      # Development mode for Firefox
pnpm build            # Production build for Chrome
pnpm build-firefox    # Production build for Firefox
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript type checking
pnpm test             # Run Vitest tests
pnpm test:e2e         # Run Playwright E2E tests
pnpm codegen          # Generate GraphQL types from AniList schema
```

## Architecture

### Extension Structure
- **Background script** (`src/background/`): Service worker handling database loading, AniList GraphQL queries, and message passing
- **Content scripts** (`src/contentScripts/`): Injected into supported sites to display ratings
- **Popup/Sidepanel** (`src/popup/`, `src/sidepanel/`): Extension UI components

### Data Flow
1. Background script loads anime database from [manami-project/anime-offline-database](https://github.com/manami-project/anime-offline-database) into MiniSearch for fuzzy title matching
2. Content scripts detect anime cards on supported sites using site-specific selectors
3. Title is matched against the database to get AniList ID
4. Background script queries AniList GraphQL API for ratings/details
5. Results are displayed via Shadow DOM-encapsulated UI on the page

### Site Support System
Each supported site has a folder in `src/contentScripts/site/` containing:
- `meta.ts`: URL patterns for manifest injection
- `main.ts`: Implements `SiteBaseConfig` interface with page detection logic and card selectors
- `global.scss`: Site-specific styles

To add a new site, copy an existing site folder (e.g., `anizm`) and modify the selectors and URL patterns.

### Key Patterns
- **Path alias**: `~/` maps to `src/`
- **GraphQL**: Types generated to `src/gql/` via codegen from AniList schema
- **State**: Uses custom persisted stores with `webextension-polyfill` storage API (`src/logic/createPersistedStore.ts`)
- **Styling**: UnoCSS for utility classes, SCSS for component styles, Shadow DOM for isolation
- **Environment**: `EXTENSION=firefox` env var switches between Chrome and Firefox builds
