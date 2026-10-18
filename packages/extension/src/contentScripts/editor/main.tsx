import { render } from 'solid-js/web';
import bundledSites from 'virtual:ani-score/sites';

import { createEncapsulatedContainer } from '~/contentScripts/engagement/logic/createEncapsulatedContainer';
import { initSiteLogic } from '~/contentScripts/engagement/logic/loadSite';
import { setTheme } from '~/logic/setTheme';
import type { UserSite } from '~/logic/storage';
import { userSitesKey } from '~/logic/storage';
import {
  findSiteConfig,
  resolveSites,
  siteFingerprint,
} from '~/sites/resolveSites';
import type { SiteConfig } from '~/sites/schema';

import type { Draft, ExistingSetup } from './views/App';
import { App } from './views/App';

/**
 * Unsaved work by host name, so closing the editor or leaving the page doesn't lose it.
 */
export const draftsKey = 'siteDrafts';

type Drafts = Record<string, Draft | SiteConfig>;

async function read() {
  const items = (await browser.storage.local.get([
    userSitesKey,
    draftsKey,
  ])) as {
    [userSitesKey]?: UserSite[];
    [draftsKey]?: Drafts;
  };

  return {
    userSites: items[userSitesKey] ?? [],
    drafts: items[draftsKey] ?? {},
  };
}

// Drafts used to be the config alone, made in the editor
const asDraft = (draft: Draft | SiteConfig | undefined): Draft | undefined =>
  draft && ('schemaVersion' in draft ? { config: draft } : draft);

const idOf = (entry: UserSite) => (entry.config as { id?: string } | null)?.id;

/**
 * The config this page already has, the user's or a bundled one. `access` is left out: it only means something for
 * bundled configs.
 */
function existingSetup(userSites: UserSite[]): ExistingSetup | undefined {
  const found = findSiteConfig(
    new URL(location.href),
    resolveSites(userSites, bundledSites).sites,
  );

  if (!found) return undefined;

  const config = structuredClone(found);
  const own = userSites.find((entry) => idOf(entry) === config.id);

  delete config.access;

  return own
    ? { config, source: 'yours', savedAt: own.savedAt }
    : { config, source: 'built-in' };
}

async function saveDraft(draft: Draft | undefined) {
  const { drafts } = await read();

  if (draft) drafts[location.hostname] = draft;
  else delete drafts[location.hostname];

  await browser.storage.local.set({ [draftsKey]: drafts });
}

async function save(config: SiteConfig) {
  const { userSites } = await read();
  const bundled = bundledSites.find((site) => site.id === config.id);

  await browser.storage.local.set({
    [userSitesKey]: [
      ...userSites.filter((entry) => idOf(entry) !== config.id),
      {
        config,
        savedAt: Date.now(),
        ...(bundled && { basedOn: siteFingerprint(bundled) }),
      },
    ],
  });
  await saveDraft(undefined);
}

async function deleteSetup(id: string) {
  const { userSites } = await read();

  await browser.storage.local.set({
    [userSitesKey]: userSites.filter((entry) => idOf(entry) !== id),
  });
  await saveDraft(undefined);
}

/**
 * Runs the saved config on a page where AniScore's content script isn't (a site set up just now), in its place: the
 * editor pauses it when it opens again.
 */
async function keepRunning() {
  let stop = () => {};
  let paused = false;
  const start = async () => {
    const saved = existingSetup((await read()).userSites);

    // A pause while the config loaded wins
    if (saved && !paused) stop = initSiteLogic(saved.config);
  };

  window.aniScoreEngagement = {
    pause() {
      paused = true;
      stop();
    },
    async restart() {
      stop();
      paused = false;
      await start();
    },
  };
  await start();
}

/**
 * Opens the editor on the page, unless it's open already. AniScore pauses meanwhile, since the editor previews the
 * config being edited, and starts again with the saved configs when the editor closes. On a site AniScore wasn't on
 * yet, the saved config keeps running in its place.
 */
export async function openEditor() {
  if (document.querySelector('[data-ani-score-editor]')) return;

  const { userSites, drafts } = await read();
  const existing = existingSetup(userSites);
  const { container, root } = createEncapsulatedContainer();

  container.setAttribute('data-ani-score-editor', '');
  document.body.append(container);
  window.aniScoreEditing = true;
  window.aniScoreEngagement?.pause();
  void setTheme(root);

  async function close() {
    dispose();
    container.remove();
    window.aniScoreEditing = false;

    if (window.aniScoreEngagement) await window.aniScoreEngagement.restart();
    else await keepRunning();
  }

  const dispose = render(
    () => (
      <App
        existing={existing}
        draft={asDraft(drafts[location.hostname])}
        host={container}
        onDraft={(draft) => void saveDraft(draft)}
        onSave={save}
        onDelete={deleteSetup}
        onClose={() => void close()}
      />
    ),
    root,
  );
}

void openEditor();
