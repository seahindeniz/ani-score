import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
import bundledSites from 'virtual:ani-score/sites';

import type { UserSite } from '~/logic';
import { useTurnedOffSitesStore, useUserSitesStore } from '~/logic';
import { editorScript } from '~/logic/editor';
import type { SiteConfig } from '~/sites/schema';

import { fakeBrowser } from '../../../../../../test/fake-browser';
import { Sites } from '../Sites';

function config(id: string, overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    schemaVersion: 1,
    id,
    name: `${id[0].toUpperCase()}${id.slice(1)}`,
    matches: [`*://${id}.me/*`],
    pages: [
      {
        match: {},
        cards: [
          { selector: '.card', title: {}, inject: { position: 'append' } },
        ],
      },
    ],
    ...overrides,
  };
}

const store = useUserSitesStore();
const turnedOff = useTurnedOffSitesStore();

async function renderSites(userSites: UserSite[] = []) {
  await store.dataReady;
  store.setData(userSites);
  render(() => <Sites />);
}

const row = (id: string) =>
  document.querySelector<HTMLElement>(`[data-site="${id}"]`)!;

// A button in the row, like the confirmation's
const button = (id: string, name: string) =>
  Array.from(row(id).querySelectorAll('button')).find(
    (item) => item.textContent === name,
  )!;

// Read directly, as a closed menu left in the page hides the rest from role queries
const status = () => document.querySelector('[role=status]')?.textContent;

const group = (name: string) => screen.getByRole('region', { name });

const idsIn = (name: string) =>
  Array.from(group(name).querySelectorAll('[data-site]'), (item) =>
    item.getAttribute('data-site'),
  );

function press(element: HTMLElement) {
  fireEvent.pointerDown(element, { button: 0, pointerType: 'mouse' });
  fireEvent.pointerUp(element, { button: 0, pointerType: 'mouse' });
  fireEvent.click(element);
}

const menus = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role=menu]'));

// The open menu; in happy-dom, menus stay in the page once closed, and sometimes open after an action
const openMenu = () =>
  menus().find((menu) => !menu.hasAttribute('data-closed'))!;

// The actions in a site's menu, which it leaves open
async function menuOf(name: string) {
  for (const menu of menus()) fireEvent.keyDown(menu, { key: 'Escape' });

  press(screen.getByRole('button', { name: `More for ${name}` }));
  await waitFor(() => expect(openMenu()).toBeTruthy());

  return within(openMenu())
    .getAllByRole('menuitem')
    .map((item) => item.textContent);
}

async function choose(name: string, action: string) {
  await menuOf(name);
  press(within(openMenu()).getByRole('menuitem', { name: action }));
}

// The sites the "Add a site" dropdown offers, by name; it's left open
async function offeredSites() {
  press(screen.getByRole('button', { name: /^Add a site/ }));
  await screen.findAllByRole('option');

  return screen
    .getAllByRole('option')
    .map((option) => option.querySelector('span > span')!.textContent);
}

async function addSite(name: string) {
  await offeredSites();
  press(
    screen
      .getAllByRole('option')
      .find(
        (option) => option.querySelector('span > span')!.textContent === name,
      )!,
  );
}

function paste(json: string) {
  const open = screen.queryByRole('button', { name: 'Import a setup' });

  if (open) fireEvent.click(open);

  fireEvent.input(screen.getByLabelText('Site setup'), {
    target: { value: json },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
}

beforeEach(async () => {
  await store.dataReady;
  await turnedOff.dataReady;
  store.setData([]);
  turnedOff.setData([]);
});

afterEach(cleanup);

describe('sites', () => {
  it('lists the sites that are on, and offers the others to add, by name', async () => {
    await renderSites();

    expect(idsIn('On')).toEqual(['anizm', 'tranimeizle']);
    // Built-in sites need no badge
    expect(row('anizm').textContent).toBe('AAnizmanizm.net');
    expect(row('tranimeizle').textContent).toContain('tranimeizle.live');
    expect(screen.getByRole('button', { name: 'Edit Anizm' })).toBeTruthy();
    expect(await menuOf('Anizm')).toEqual(['Turn off']);
    cleanup();
    await renderSites();
    expect(row('openani')).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Your setups that are off' }),
    ).toBeNull();
    expect(screen.queryByRole('region', { name: "Can't be used" })).toBeNull();

    expect(await offeredSites()).toEqual([
      'Acheriya',
      'AnimeciX',
      'AnimeX',
      'AnimeXe',
      'AnimPow',
      'Asya Animeleri',
      'OpenAnime',
      'SonAnime',
    ]);
  });

  it('has no dropdown once every site is on', async () => {
    await fakeBrowser.permissions.request({
      origins: bundledSites.flatMap((site) => site.matches),
    });
    await renderSites();

    await waitFor(() => expect(idsIn('On')).toHaveLength(bundledSites.length));
    expect(screen.queryByRole('button', { name: /^Add a site/ })).toBeNull();
  });

  it('imports a setup, to be turned on', async () => {
    await renderSites();
    paste(JSON.stringify(config('kitsune')));

    expect(status()).toBe(
      'Imported Kitsune. Turn it on to allow it on kitsune.me.',
    );
    expect(row('kitsune').textContent).toContain('Yours');
    expect(store.data()).toEqual([
      { config: config('kitsune'), savedAt: expect.any(Number) },
    ]);
    // The import form closes once it's done
    expect(screen.queryByLabelText('Site setup')).toBeNull();
  });

  it('closes the import form without importing', async () => {
    await renderSites();
    fireEvent.click(screen.getByRole('button', { name: 'Import a setup' }));
    fireEvent.input(screen.getByLabelText('Site setup'), {
      target: { value: '{}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Site setup')).toBeNull();

    // And starts empty next time
    fireEvent.click(screen.getByRole('button', { name: 'Import a setup' }));
    expect(
      (screen.getByLabelText('Site setup') as HTMLTextAreaElement).value,
    ).toBe('');
    expect(store.data()).toEqual([]);
  });

  it('replaces a setup imported again', async () => {
    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);
    paste(JSON.stringify(config('kitsune', { name: 'OpenAni' })));

    expect(store.data()).toHaveLength(1);
    expect(row('kitsune').textContent).toContain('OpenAni');
  });

  it('says why a setup cannot be imported', async () => {
    await renderSites();
    paste('{ nope');

    expect(status()).toBe("That isn't valid JSON.");

    paste(JSON.stringify(config('kitsune', { schemaVersion: 9 as 1 })));

    expect(status()).toBe(
      'This config needs a newer AniScore (schema version 9)',
    );
    expect(store.data()).toEqual([]);
  });

  it("asks the browser for access to turn a site on, and drops access it doesn't need to turn it off", async () => {
    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);

    // A setup of the user's own that's off is still listed, to manage it
    expect(idsIn('Your setups that are off')).toEqual(['kitsune']);

    await addSite('Kitsune');

    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({
      origins: ['*://kitsune.me/*'],
    });
    await waitFor(() => expect(idsIn('On')).toContain('kitsune'));
    expect(status()).toBe(
      'Kitsune is on. Reload its open tabs to see ratings.',
    );
    expect(await offeredSites()).not.toContain('Kitsune');

    cleanup();
    render(() => <Sites />);
    await waitFor(() => expect(idsIn('On')).toContain('kitsune'));
    await choose('Kitsune', 'Turn off');

    expect(fakeBrowser.permissions.remove).toHaveBeenCalledWith({
      origins: ['*://kitsune.me/*'],
    });
    await waitFor(() =>
      expect(idsIn('Your setups that are off')).toEqual(['kitsune']),
    );
    expect(idsIn('On')).not.toContain('kitsune');

    // And on again from its menu
    await choose('Kitsune', 'Turn on');
    await waitFor(() => expect(idsIn('On')).toContain('kitsune'));
  });

  it('turns off a site that is on from install, keeping the access it was given', async () => {
    await renderSites();
    await choose('Anizm', 'Turn off');

    expect(turnedOff.data()).toEqual(['anizm']);
    expect(fakeBrowser.permissions.remove).not.toHaveBeenCalled();
    await waitFor(() => expect(idsIn('On')).toEqual(['tranimeizle']));
    expect(await offeredSites()).toContain('Anizm');

    cleanup();
    await renderSites();
    await addSite('Anizm');

    // Back on, with no need to ask
    expect(fakeBrowser.permissions.request).not.toHaveBeenCalled();
    expect(turnedOff.data()).toEqual([]);
    await waitFor(() => expect(idsIn('On')).toContain('anizm'));
    expect(status()).toBe('Anizm is on.');
  });

  it('forgets that a setup of the user’s own was off once it’s deleted', async () => {
    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);
    turnedOff.setData(['kitsune', 'anizm']);
    await choose('Kitsune', 'Delete');
    fireEvent.click(button('kitsune', 'Delete'));

    expect(turnedOff.data()).toEqual(['anizm']);
  });

  it('stays off when the user declines access', async () => {
    fakeBrowser.permissions.request.mockResolvedValueOnce(false);
    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);
    await addSite('Kitsune');

    await waitFor(() =>
      expect(status()).toBe('Kitsune stays off, since access was declined.'),
    );
  });

  it('deletes a setup with the access only it needed, once confirmed', async () => {
    await fakeBrowser.permissions.request({
      origins: ['*://kitsune.me/*', '*://otakuden.me/*'],
    });
    await renderSites([
      { config: config('kitsune'), savedAt: 1 },
      {
        config: config('otakuden', {
          matches: ['*://otakuden.me/*', '*://kitsune.me/*'],
        }),
        savedAt: 2,
      },
    ]);
    await waitFor(() => expect(idsIn('On')).toContain('otakuden'));
    await choose('Otakuden', 'Delete');

    expect(row('otakuden').textContent).toContain(
      'Delete your setup for this site?',
    );
    expect(store.data()).toHaveLength(2);

    fireEvent.click(button('otakuden', 'Delete'));

    expect(
      store.data().map((entry) => (entry.config as SiteConfig).id),
    ).toEqual(['kitsune']);
    expect(fakeBrowser.permissions.remove).toHaveBeenCalledWith({
      origins: ['*://otakuden.me/*'],
    });

    await choose('Kitsune', 'Delete');
    fireEvent.click(button('kitsune', 'Delete'));

    expect(fakeBrowser.permissions.remove).toHaveBeenCalledWith({
      origins: ['*://kitsune.me/*'],
    });
  });

  it('keeps a setup when the user cancels deleting it', async () => {
    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);
    await choose('Kitsune', 'Delete');
    fireEvent.click(button('kitsune', 'Cancel'));

    expect(store.data()).toHaveLength(1);
    expect(row('kitsune').textContent).not.toContain('Delete your setup');
  });

  it('resets an edited built-in site, keeping its access, and says when the built-in one changed', async () => {
    await renderSites([
      {
        config: config('anizm', {
          name: 'My Anizm',
          matches: ['*://anizm.net/*'],
        }),
        savedAt: 1,
        basedOn: 'outdated',
      },
    ]);

    expect(row('anizm').textContent).toContain('Edited');
    expect(row('anizm').textContent).toContain(
      'The built-in version changed since you edited it.',
    );
    // AniScore reads the site from install, so the user's setup is on
    await waitFor(() => expect(idsIn('On')).toContain('anizm'));

    await choose('My Anizm', 'Reset to built-in');

    expect(row('anizm').textContent).toContain(
      'Drop your changes to this site?',
    );

    fireEvent.click(button('anizm', 'Reset'));

    expect(store.data()).toEqual([]);
    expect(fakeBrowser.permissions.remove).not.toHaveBeenCalled();
    expect(row('anizm').textContent).toBe('AAnizmanizm.net');
  });

  it('lists setups that no longer validate, to delete them', async () => {
    await renderSites([
      { config: { ...config('broken'), pages: [] }, savedAt: 1 },
      { config: null, savedAt: 2 },
    ]);

    const broken = group("Can't be used");

    expect(screen.getByText('broken')).toBeTruthy();
    expect(screen.getByText('Unnamed setup')).toBeTruthy();
    expect(broken.textContent).toContain(
      'It no longer matches the setup format. Delete it, or import a fixed copy.',
    );
    // The details stay folded away
    expect(broken.querySelector('details pre')!.textContent).toContain('pages');

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    expect(store.data()).toEqual([{ config: null, savedAt: 2 }]);
  });

  it("shares the user's own setups through a prefilled GitHub issue", async () => {
    const writeText = mock(async (_text: string) => {});

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    await renderSites([
      { config: config('kitsune'), savedAt: 1 },
      { config: config('otakuden', { css: 'a'.repeat(9000) }), savedAt: 2 },
    ]);

    // Built-in sites are shared already
    expect(await menuOf('Kitsune')).toEqual([
      'Turn on',
      'Share with everyone',
      'Export',
      'Delete',
    ]);
    press(
      within(openMenu()).getByRole('menuitem', { name: 'Share with everyone' }),
    );
    await waitFor(() =>
      expect(status()).toBe("Opened a GitHub issue with Kitsune's setup."),
    );

    const [[{ url }]] = fakeBrowser.tabs.create.mock.calls as unknown as [
      [{ url: string }],
    ];

    // Without the `access` that only bundled configs have
    expect(JSON.parse(new URL(url).searchParams.get('config')!)).toEqual(
      config('kitsune'),
    );

    await choose('Otakuden', 'Share with everyone');
    await waitFor(() =>
      expect(status()).toBe(
        "Otakuden's setup is too long for a link, so it's on your clipboard: paste it into the form's Config field.",
      ),
    );
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(
      config('otakuden', { css: 'a'.repeat(9000) }),
    );
  });

  it('exports a setup as a JSON file', async () => {
    const createObjectURL = spyOn(URL, 'createObjectURL').mockReturnValue(
      'blob:config',
    );
    const revokeObjectURL = spyOn(URL, 'revokeObjectURL').mockImplementation(
      () => {},
    );
    const click = spyOn(
      HTMLAnchorElement.prototype,
      'click',
    ).mockImplementation(() => {});

    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);
    await choose('Kitsune', 'Export');

    const [[blob]] = createObjectURL.mock.calls as unknown as [[Blob]];

    expect(JSON.parse(await blob.text())).toEqual(config('kitsune'));
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      'kitsune.json',
    );
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:config');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });

  it("shows a site's first address, with all of them on hover", async () => {
    await renderSites([
      {
        config: config('kitsune', {
          matches: [
            '*://www.kitsune.me/*',
            '*://kitsune.me/*',
            '*://*.kitsune.tv/*',
          ],
        }),
        savedAt: 1,
      },
    ]);

    const host = row('kitsune').querySelector('span[title]')!;

    expect(host.textContent).toBe('kitsune.me');
    expect(host.getAttribute('title')).toBe('kitsune.me, kitsune.tv');
  });
});

describe('editing a site', () => {
  const injected = () =>
    fakeBrowser.scripting.executeScript.mock.calls.flatMap(
      ([injection]) => (injection.files as string[] | undefined) ?? [],
    );

  it("opens the editor on the site's open tab, the active one first, brought to the front", async () => {
    fakeBrowser.tabs.query.mockResolvedValueOnce([
      { id: 4, windowId: 2, active: false },
      { id: 5, windowId: 3, active: true },
    ]);
    await renderSites();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Anizm' }));

    await waitFor(() => expect(injected()).toContain(editorScript));
    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({
      origins: bundledSites.find((site) => site.id === 'anizm')!.matches,
    });
    expect(fakeBrowser.tabs.update).toHaveBeenCalledWith(5, { active: true });
    expect(fakeBrowser.windows.update).toHaveBeenCalledWith(3, {
      focused: true,
    });
    expect(fakeBrowser.scripting.executeScript).toHaveBeenLastCalledWith({
      target: { tabId: 5 },
      files: expect.arrayContaining([editorScript]),
    });
  });

  it('opens the site in a new tab when none is open, once it loaded', async () => {
    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Kitsune' }));

    await waitFor(() =>
      expect(fakeBrowser.tabs.create).toHaveBeenCalledWith({
        url: 'https://kitsune.me/',
      }),
    );
    expect(injected()).toEqual([]);

    // Other tabs, and other changes, don't count
    fakeBrowser.tabs.onUpdated.dispatch(9, { status: 'complete' });
    fakeBrowser.tabs.onUpdated.dispatch(1, { title: 'Kitsune' });

    expect(injected()).toEqual([]);

    fakeBrowser.tabs.onUpdated.dispatch(1, { status: 'complete' });

    await waitFor(() => expect(injected()).toContain(editorScript));
  });

  it('opens it right away on a new tab that loaded already', async () => {
    fakeBrowser.tabs.create.mockResolvedValueOnce({
      id: 1,
      windowId: 1,
      status: 'complete',
    });
    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Kitsune' }));

    await waitFor(() => expect(injected()).toContain(editorScript));
  });

  it('says when the user declines access, or the editor fails to open', async () => {
    fakeBrowser.permissions.request.mockResolvedValueOnce(false);
    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Kitsune' }));

    await waitFor(() =>
      expect(status()).toBe(
        'AniScore needs access to kitsune.me to open its editor there.',
      ),
    );
    expect(fakeBrowser.tabs.create).not.toHaveBeenCalled();

    fakeBrowser.tabs.query.mockRejectedValueOnce(new Error('No access'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Kitsune' }));

    await waitFor(() =>
      expect(status()).toBe(
        "The editor didn't open on kitsune.me. Open one of its pages, then try again.",
      ),
    );
  });
});
