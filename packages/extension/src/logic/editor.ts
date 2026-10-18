import type { SiteConfig } from '~/sites/schema';

export const editorScript = 'dist/contentScripts/editor/main.js';
export const gatewayScript = 'dist/contentScripts/root/messageGateway/main.js';

/**
 * Puts the site editor on a tab, with the message gateway its preview talks to the background through.
 */
export async function injectEditor(tabId: number) {
  const [{ result: hasGateway } = { result: false }] =
    await browser.scripting.executeScript({
      target: { tabId },
      func: () => 'messageGateway' in window,
    });

  await browser.scripting.executeScript({
    target: { tabId },
    files: hasGateway ? [editorScript] : [gatewayScript, editorScript],
  });
}

function loaded(tabId: number) {
  return new Promise<void>((resolve) => {
    const listener = (id: number, change: { status?: string }) => {
      if (id !== tabId || change.status !== 'complete') return;

      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    browser.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Opens the site editor for a site from an extension page: on a tab of the site that's open already (the active one
 * first), brought to the front, or on a new tab of `address` once it loaded. It asks for access to the site first, so
 * it has to be called right from the user's click, as browsers only ask then. Resolves with whether the user allowed
 * the access.
 */
export async function editSite(site: SiteConfig, address: string) {
  if (!(await browser.permissions.request({ origins: site.matches }))) {
    return false;
  }

  const [open] = (await browser.tabs.query({ url: site.matches })).sort(
    (a, b) => Number(b.active) - Number(a.active),
  );
  let tab = open;

  if (tab) {
    await browser.tabs.update(tab.id!, { active: true });
    await browser.windows.update(tab.windowId!, { focused: true });
  } else {
    tab = await browser.tabs.create({ url: address });

    if (tab.status !== 'complete') await loaded(tab.id!);
  }

  await injectEditor(tab.id!);

  return true;
}
