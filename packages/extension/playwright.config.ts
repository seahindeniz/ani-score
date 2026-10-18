/**
 * @see {@link https://playwright.dev/docs/chrome-extensions Chrome extensions | Playwright}
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: 2,
  webServer: {
    command: 'bun run dev',
    // Uses the committed GraphQL types, so a run doesn't depend on fetching AniList's schema
    env: { SKIP_GRAPHQL_CODEGEN: '1' },
    // start e2e test after the Vite server is fully prepared
    url: 'http://localhost:3303/popup/main.tsx',
    reuseExistingServer: true,
  },
});
