import { describe, expect, it } from 'bun:test';

import { wait } from '~/utils/wait';

import { fakeBrowser } from '../../../../test/fake-browser';
import {
  addEditorEntry,
  editorMenuId,
  editorScript,
  gatewayScript,
  openEditor,
} from '../editorEntry';

const injectedFiles = () =>
  fakeBrowser.scripting.executeScript.mock.calls.flatMap(
    ([injection]) => (injection.files as string[] | undefined) ?? [],
  );

describe('openEditor', () => {
  it('asks for lasting access to the site, then injects the editor with the message gateway', async () => {
    await openEditor(7, 'https://openani.me/episodes/latest/1');

    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({
      origins: ['*://openani.me/*'],
    });
    expect(fakeBrowser.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      func: expect.any(Function),
    });
    expect(injectedFiles()).toEqual([gatewayScript, editorScript]);
  });

  it('only injects the editor where the gateway runs already', async () => {
    fakeBrowser.scripting.executeScript.mockResolvedValueOnce([
      { result: true },
    ]);
    await openEditor(7, 'https://anizm.net/');

    expect(injectedFiles()).toEqual([editorScript]);

    // The check itself, run in the page
    const [[{ func }]] = fakeBrowser.scripting.executeScript.mock.calls as [
      [{ func: () => boolean }],
    ];

    expect(func()).toBe('messageGateway' in window);
  });

  it('still opens the editor when the browser declines access, and logs failures', async () => {
    fakeBrowser.permissions.request.mockRejectedValueOnce(
      new Error('Not allowed'),
    );
    fakeBrowser.scripting.executeScript.mockResolvedValueOnce([]);
    await openEditor(7, 'https://openani.me/');
    await wait();

    expect(injectedFiles()).toEqual([gatewayScript, editorScript]);

    fakeBrowser.scripting.executeScript.mockRejectedValueOnce(
      new Error('Cannot access contents of the page'),
    );

    await openEditor(7, 'https://openani.me/');
  });
});

describe('addEditorEntry', () => {
  it('adds the menu item once the old ones are gone', async () => {
    addEditorEntry();
    await wait();

    expect(fakeBrowser.contextMenus.removeAll).toHaveBeenCalled();
    expect(fakeBrowser.contextMenus.create).toHaveBeenCalledWith({
      id: editorMenuId,
      title: 'Integrate this site with AniScore',
      contexts: ['page', 'action'],
    });

    fakeBrowser.contextMenus.removeAll.mockRejectedValueOnce(new Error('busy'));
    addEditorEntry();
    await wait();
  });

  it('opens the editor from the menu, on web pages only', async () => {
    addEditorEntry();

    const click = (
      info: Record<string, unknown>,
      tab?: Record<string, unknown>,
    ) => fakeBrowser.contextMenus.onClicked.dispatch(info, tab);

    click({ menuItemId: 'other', pageUrl: 'https://openani.me/' }, { id: 1 });
    click({ menuItemId: editorMenuId, pageUrl: 'https://openani.me/' });
    click(
      { menuItemId: editorMenuId, pageUrl: 'chrome://extensions/' },
      { id: 1 },
    );
    click({ menuItemId: editorMenuId }, { id: 1 });
    await wait();

    expect(fakeBrowser.scripting.executeScript).not.toHaveBeenCalled();

    // From the toolbar button's menu, which has no page URL
    click({ menuItemId: editorMenuId }, { id: 2, url: 'https://openani.me/' });
    click(
      { menuItemId: editorMenuId, pageUrl: 'https://animex.club/' },
      { id: 3 },
    );
    await wait();

    expect(fakeBrowser.permissions.request.mock.calls).toEqual([
      [{ origins: ['*://openani.me/*'] }],
      [{ origins: ['*://animex.club/*'] }],
    ]);
  });
});
