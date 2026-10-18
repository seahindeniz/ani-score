import { logger } from '~/utils/logger';

export const editorMenuId = 'ani-score-integrate-site';

export const editorScript = 'dist/contentScripts/editor/main.js';
export const gatewayScript = 'dist/contentScripts/root/messageGateway/main.js';

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

  return (async () => {
    // The editor previews with AniScore's details, which talk to the background through the message gateway
    const [{ result: hasGateway } = { result: false }] =
      await browser.scripting.executeScript({
        target: { tabId },
        func: () => 'messageGateway' in window,
      });

    await browser.scripting.executeScript({
      target: { tabId },
      files: hasGateway ? [editorScript] : [gatewayScript, editorScript],
    });
  })().catch((error: unknown) => logger.error(error));
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
