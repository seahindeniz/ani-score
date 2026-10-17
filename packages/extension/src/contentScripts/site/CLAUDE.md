# Site Support System

Each supported site has a folder in `packages/extension/src/contentScripts/site/` containing:
- `meta.ts`: URL patterns for manifest injection
- `main.ts`: Implements `SiteBaseConfig` interface with page detection logic and card selectors
- `global.scss`: Site-specific styles

To add a new site, copy an existing site folder (e.g., `anizm`) and modify the selectors and URL patterns.
