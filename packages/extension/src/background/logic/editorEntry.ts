import { injectEditor } from '~/logic/editor';
import { logger } from '~/utils/logger';

export const editorMenuId = 'ani-score-integrate-site';

/**
 * Opens the site editor on a tab. Called from a click, so it first asks for lasting access to the site, which the
 * browser only allows in response to the user. The editor itself runs on the access the click grants (`activeTab`),
 * also when the user declines.
 */
export function openEditor(tabId: number, pageUrl: string) {
  const { hostname } = new URL(pageUrl);

  void browser.permissions
    .request({ origins: [`*://${hostname}/*`] })
    .catch((error: unknown) => logger.error(error));

  return injectEditor(tabId).catch((error: unknown) => logger.error(error));
}

/**
 * Adds "Integrate this site with AniScore" to the page's and the toolbar button's context menus.
 */
export function addEditorEntry() {
  void browser.contextMenus
    .removeAll()
    .then(() => {
      browser.contextMenus.create({
        id: editorMenuId,
        title: 'Integrate this site with AniScore',
        contexts: ['page', 'action'],
      });
    })
    .catch((error: unknown) => logger.error(error));

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const url = info.pageUrl ?? tab?.url;

    // Not on the browser's own pages, where extensions can't run
    if (
      info.menuItemId !== editorMenuId
      || tab?.id == null
      || !/^https?:/.test(url ?? '')
    ) {
      return;
    }

    void openEditor(tab.id, url!);
  });
}
