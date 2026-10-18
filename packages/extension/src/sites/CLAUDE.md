# Site configs

Each supported site is data, not code: a folder in `packages/extension/src/sites/<id>/` with

- `site.json`: a `SiteConfig` (`schema.ts`). Its `$schema` gives editors autocomplete; `site.schema.json` is generated
  from `schema.ts` by `bun scripts/site-schema.ts`, and a unit test fails when it's out of date.
- `style.css` (optional): plain CSS with native nesting, no SCSS, so bundled configs and configs made in the browser
  are the same thing. It is appended to the config's `css` at build.

`scripts/sites.ts` validates every config at build and serves them as `virtual:ani-score/sites`. The engagement
content script (`contentScripts/engagement/main.tsx`) picks the config whose `matches` fit the page, and
`contentScripts/sites/extract.ts` reads its cards.

## Access and user configs

- `access: "required"` sites are in the manifest's `host_permissions` and `content_scripts`, so they work from install.
  Adding one makes Chrome disable the extension on update until users accept, so new sites should stay optional.
- Optional bundled sites, and the configs users import (stored under `userSites`, see `resolveSites.ts`), get access
  per site: the side panel's "Sites" section calls `permissions.request`, which the browser only allows for origins in
  `optional_host_permissions` (their patterns plus `*://*/*`, which grants nothing by itself).
- `background/logic/registerSites.ts` registers the content scripts on the allowed optional sites with
  `scripting.registerContentScripts`, and syncs whenever permissions or `userSites` change.
- A user's config replaces the bundled one with the same id. It is validated where it's used, so a config from an
  older schema version is migrated instead of dropped.
- Content scripts carry their CSS inline (`scripts/vite-plugin-inline-css.ts`), so pages never load extension files
  and `web_accessible_resources` only serves the side panel to AniList's sign-in redirect.

Configs can't contain code (MV3 forbids remote code, and shared configs run on everyone's pages). When a site needs
something the schema can't express, add it to the extension: a named transform in `presets.ts`, or a new key in
`schema.ts`. Bump `currentSchemaVersion` only for changes old configs can't satisfy, and migrate them in
`parseSiteConfig`.

## Editor

Users build configs on the site itself: the context menu's "Integrate this site with AniScore"
(`background/logic/editorEntry.ts`) asks for access to the site, then injects `contentScripts/editor/main.js` (built,
but not in the manifest; see `injectedScriptPaths`). The editor is a panel in a shadow root. Picking outlines the
element under the pointer and keeps clicks from the site (`logic/picker.ts`). `logic/selectors.ts` turns picks into
selectors that skip generated class names. While it's open, the engagement script pauses (`window.aniScoreEngagement`)
and the editor previews the draft with the same runtime. Drafts are kept per host under `siteDrafts`, and saving
writes to `userSites`.

## Sharing

"Share" (the editor's Save tab, and the side panel for the user's own configs) opens the repository's "Site
integration" issue form (`.github/ISSUE_TEMPLATE/site-integration.yml`) filled in by `share.ts`; a config too long for
the link goes to the clipboard. A maintainer reviews it and adds the `site-integration: approved` label, and
`.github/workflows/site-integration.yml` runs `scripts/site-config-from-issue.ts`: it validates the config, writes
`src/sites/<id>/` (always optional, CSS in `style.css`), runs the unit tests and opens a pull request with the reporter
as co-author, or comments on the issue with what's wrong.

## Styling contract

Site CSS may rely on these, so keep them stable:

- `.ani-score`: the element holding a card's details (a shadow root host)
- `.ani-score::part(container)`: the details' box inside the shadow root
- `.ani-score-watching`: added to the shimmer element while the anime is on the user's list
- `.ani-score-portal-root`: the popover layer at the end of `body`
