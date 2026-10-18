# Site configs

Each supported site is data, not code: a folder in `packages/extension/src/sites/<id>/` with

- `site.json`: a `SiteConfig` (`schema.ts`). Its `$schema` gives editors autocomplete; `site.schema.json` is generated
  from `schema.ts` by `bun scripts/site-schema.ts`, and a unit test fails when it's out of date.
- `style.css` (optional): plain CSS with native nesting, no SCSS, so bundled configs and configs made in the browser
  are the same thing. It is appended to the config's `css` at build.

`scripts/sites.ts` validates every config at build and serves them as `virtual:ani-score/sites`. The engagement
content script (`contentScripts/engagement/main.tsx`) picks the config whose `matches` fit the page, and
`contentScripts/sites/extract.ts` reads its cards. `access: "required"` sites are in the manifest's
`host_permissions`.

Configs can't contain code (MV3 forbids remote code, and shared configs run on everyone's pages). When a site needs
something the schema can't express, add it to the extension: a named transform in `presets.ts`, or a new key in
`schema.ts`. Bump `currentSchemaVersion` only for changes old configs can't satisfy, and migrate them in
`parseSiteConfig`.

## Styling contract

Site CSS may rely on these, so keep them stable:

- `.ani-score`: the element holding a card's details (a shadow root host)
- `.ani-score::part(container)`: the details' box inside the shadow root
- `.ani-score-watching`: added to the shimmer element while the anime is on the user's list
- `.ani-score-portal-root`: the popover layer at the end of `body`
