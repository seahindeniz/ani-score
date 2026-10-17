# Site Support System

Each supported site has a folder in `packages/extension/src/contentScripts/site/` containing:
- `meta.ts`: URL patterns for manifest injection
- `main.ts`: Implements `SiteBaseConfig` interface with page detection logic and card selectors
- `global.scss`: Site-specific styles
  - AniScore's card details render in a shadow root with hashed CSS module classes; style them through the exposed parts, e.g. `.ani-score::part(container)`

To add a new site, copy an existing site folder (e.g., `anizm`) and modify the selectors and URL patterns.
