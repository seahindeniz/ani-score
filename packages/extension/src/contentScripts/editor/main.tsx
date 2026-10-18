import { render } from 'solid-js/web';
import bundledSites from 'virtual:ani-score/sites';

import { createEncapsulatedContainer } from '~/contentScripts/engagement/logic/createEncapsulatedContainer';
import { setTheme } from '~/logic/setTheme';
import type { UserSite } from '~/logic/storage';
import { userSitesKey } from '~/logic/storage';
import {
  findSiteConfig,
  resolveSites,
  siteFingerprint,
} from '~/sites/resolveSites';
import type { SiteConfig } from '~/sites/schema';

import { newDraft } from './logic/draft';
import { Editor } from './views/Editor';

/**
 * Unsaved configs by host name, so closing the editor or leaving the page doesn't lose the work.
 */
export const draftsKey = 'siteDrafts';

type Drafts = Record<string, SiteConfig>;

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

/**
 * The saved config for this page, or a new one. `access` is left out: it only means something for bundled configs.
 */
function savedOrNew(userSites: UserSite[]) {
  const saved = findSiteConfig(
    new URL(location.href),
    resolveSites(userSites, bundledSites).sites,
  );

  if (!saved) return newDraft(location);

  const config = structuredClone(saved);

  delete config.access;

  return config;
}

async function saveDraft(draft: SiteConfig | undefined) {
  const { drafts } = await read();

  if (draft) drafts[location.hostname] = draft;
  else delete drafts[location.hostname];

  await browser.storage.local.set({ [draftsKey]: drafts });
}

async function startOver() {
  await saveDraft(undefined);

  return savedOrNew((await read()).userSites);
}

async function save(config: SiteConfig) {
  const { userSites } = await read();
  const bundled = bundledSites.find((site) => site.id === config.id);

  await browser.storage.local.set({
    [userSitesKey]: [
      ...userSites.filter(
        (entry) => (entry.config as { id?: string } | null)?.id !== config.id,
      ),
      {
        config,
        savedAt: Date.now(),
        ...(bundled && { basedOn: siteFingerprint(bundled) }),
      },
    ],
  });
  await saveDraft(undefined);
}

/**
 * Opens the editor on the page, unless it's open already. AniScore pauses meanwhile, since the editor previews the
 * config being edited, and starts again with the saved configs when the editor closes.
 */
export async function openEditor() {
  if (document.querySelector('[data-ani-score-editor]')) return;

  const { userSites, drafts } = await read();
  const { container, root } = createEncapsulatedContainer();

  container.setAttribute('data-ani-score-editor', '');
  document.body.append(container);
  window.aniScoreEditing = true;
  window.aniScoreEngagement?.pause();
  void setTheme(root);

  const dispose = render(
    () => (
      <Editor
        initial={drafts[location.hostname] ?? savedOrNew(userSites)}
        host={container}
        onDraft={(draft) => void saveDraft(draft)}
        onSave={save}
        onStartOver={startOver}
        onClose={() => {
          dispose();
          container.remove();
          window.aniScoreEditing = false;
          void window.aniScoreEngagement?.restart();
        }}
      />
    ),
    root,
  );
}

void openEditor();
