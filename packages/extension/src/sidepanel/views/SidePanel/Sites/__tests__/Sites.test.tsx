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
} from '@solidjs/testing-library';

import type { UserSite } from '~/logic';
import { useUserSitesStore } from '~/logic';
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

async function renderSites(userSites: UserSite[] = []) {
  await store.dataReady;
  store.setData(userSites);
  render(() => <Sites />);
}

const row = (id: string) =>
  document.querySelector<HTMLElement>(`[data-site="${id}"]`)!;

const button = (id: string, name: string) =>
  Array.from(row(id).querySelectorAll('button')).find(
    (item) => item.textContent === name,
  )!;

const toggle = (id: string) =>
  row(id).querySelector<HTMLInputElement>('[role="switch"]')!;

const isOn = (id: string) => toggle(id).closest('[data-checked]') != null;

const group = (name: string) => screen.getByRole('region', { name });

function paste(json: string) {
  const open = screen.queryByRole('button', { name: 'Import a config' });

  if (open) fireEvent.click(open);

  fireEvent.input(screen.getByLabelText('Site config'), {
    target: { value: json },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
}

beforeEach(async () => {
  await store.dataReady;
  store.setData([]);
});

afterEach(cleanup);

describe('sites', () => {
  it('lists the sites that are on, then the ones to turn on, by name', async () => {
    await renderSites();

    const names = (name: string) =>
      Array.from(group(name).querySelectorAll('[data-site]'), (item) =>
        item.getAttribute('data-site'),
      );

    expect(names('On')).toEqual(['anizm', 'tranimeizle']);
    expect(names('Available')).toEqual([
      'acheriya',
      'animecix',
      'animex',
      'animexe',
      'animpow',
      'asyaanimeleri',
      'openani',
      'sonanime',
    ]);
    // Built-in sites need no badge, and the always-on ones no switch
    expect(row('anizm').textContent).toBe('Anizmanizm.netAlways on');
    expect(row('tranimeizle').textContent).toContain('tranimeizle.live');
    expect(toggle('anizm')).toBeNull();
    expect(isOn('openani')).toBe(false);
    expect(row('openani').querySelector('button')).toBeNull();
    expect(screen.queryByRole('region', { name: "Can't be used" })).toBeNull();
  });

  it('imports a config, to be turned on', async () => {
    await renderSites();
    paste(JSON.stringify(config('kitsune')));

    expect(screen.getByRole('status').textContent).toBe(
      'Imported Kitsune. Turn it on to allow it on kitsune.me.',
    );
    expect(row('kitsune').textContent).toContain('Yours');
    expect(store.data()).toEqual([
      { config: config('kitsune'), savedAt: expect.any(Number) },
    ]);
    // The import form closes once it's done
    expect(screen.queryByLabelText('Site config')).toBeNull();
  });

  it('closes the import form without importing', async () => {
    await renderSites();
    fireEvent.click(screen.getByRole('button', { name: 'Import a config' }));
    fireEvent.input(screen.getByLabelText('Site config'), {
      target: { value: '{}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Site config')).toBeNull();

    // And starts empty next time
    fireEvent.click(screen.getByRole('button', { name: 'Import a config' }));
    expect(
      (screen.getByLabelText('Site config') as HTMLTextAreaElement).value,
    ).toBe('');
    expect(store.data()).toEqual([]);
  });

  it('replaces a config imported again', async () => {
    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);
    paste(JSON.stringify(config('kitsune', { name: 'OpenAni' })));

    expect(store.data()).toHaveLength(1);
    expect(row('kitsune').textContent).toContain('OpenAni');
  });

  it('says why a config cannot be imported', async () => {
    await renderSites();
    paste('{ nope');

    expect(screen.getByRole('status').textContent).toBe(
      "That isn't valid JSON.",
    );

    paste(JSON.stringify(config('kitsune', { schemaVersion: 9 as 1 })));

    expect(screen.getByRole('status').textContent).toBe(
      'This config needs a newer AniScore (schema version 9)',
    );
    expect(store.data()).toEqual([]);
  });

  it("asks the browser for access to turn a site on, and drops access it doesn't need to turn it off", async () => {
    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);
    fireEvent.click(toggle('kitsune'));

    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({
      origins: ['*://kitsune.me/*'],
    });
    await waitFor(() => expect(isOn('kitsune')).toBe(true));
    expect(group('On').contains(row('kitsune'))).toBe(true);
    expect(screen.getByRole('status').textContent).toBe(
      'Kitsune is on. Reload its open tabs to see ratings.',
    );

    fireEvent.click(toggle('kitsune'));

    expect(fakeBrowser.permissions.remove).toHaveBeenCalledWith({
      origins: ['*://kitsune.me/*'],
    });
    await waitFor(() => expect(isOn('kitsune')).toBe(false));
    expect(group('Available').contains(row('kitsune'))).toBe(true);
  });

  it('stays off when the user declines access', async () => {
    fakeBrowser.permissions.request.mockResolvedValueOnce(false);
    await renderSites([{ config: config('kitsune'), savedAt: 1 }]);
    fireEvent.click(toggle('kitsune'));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'Kitsune stays off, since access was declined.',
      ),
    );
  });

  it('deletes a config with the access only it needed', async () => {
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
    fireEvent.click(button('otakuden', 'Delete'));

    expect(
      store.data().map((entry) => (entry.config as SiteConfig).id),
    ).toEqual(['kitsune']);
    expect(fakeBrowser.permissions.remove).toHaveBeenCalledWith({
      origins: ['*://otakuden.me/*'],
    });

    fireEvent.click(button('kitsune', 'Delete'));

    expect(fakeBrowser.permissions.remove).toHaveBeenCalledWith({
      origins: ['*://kitsune.me/*'],
    });
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
    // A user's config is never on from install
    expect(isOn('anizm')).toBe(false);

    fireEvent.click(button('anizm', 'Reset to built-in'));

    expect(store.data()).toEqual([]);
    expect(fakeBrowser.permissions.remove).not.toHaveBeenCalled();
    expect(row('anizm').textContent).toContain('Always on');
  });

  it('lists configs that no longer validate, to delete them', async () => {
    await renderSites([
      { config: { ...config('broken'), pages: [] }, savedAt: 1 },
      { config: null, savedAt: 2 },
    ]);

    const broken = group("Can't be used");

    expect(screen.getByText('broken')).toBeTruthy();
    expect(screen.getByText('Unnamed config')).toBeTruthy();
    expect(broken.textContent).toContain(
      'It no longer matches the config format. Delete it, or import a fixed copy.',
    );
    // The details stay folded away
    expect(broken.querySelector('details pre')!.textContent).toContain('pages');

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    expect(store.data()).toEqual([{ config: null, savedAt: 2 }]);
  });

  it("shares the user's own configs through a prefilled GitHub issue", async () => {
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
    expect(button('anizm', 'Share')).toBeUndefined();

    fireEvent.click(button('kitsune', 'Share'));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        "Opened a GitHub issue with Kitsune's config.",
      ),
    );

    const [[{ url }]] = fakeBrowser.tabs.create.mock.calls as unknown as [
      [{ url: string }],
    ];

    // Without the `access` that only bundled configs have
    expect(JSON.parse(new URL(url).searchParams.get('config')!)).toEqual(
      config('kitsune'),
    );

    fireEvent.click(button('otakuden', 'Share'));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        "Otakuden's config is too long for a link, so it's on your clipboard: paste it into the form's Config field.",
      ),
    );
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(
      config('otakuden', { css: 'a'.repeat(9000) }),
    );
  });

  it('exports a config as a JSON file', async () => {
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
    fireEvent.click(button('kitsune', 'Export'));

    const [[blob]] = createObjectURL.mock.calls as unknown as [[Blob]];

    expect(JSON.parse(await blob.text())).toEqual(config('kitsune'));
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      'kitsune.json',
    );
    // Built-in sites ship with AniScore, so they have nothing to export
    expect(button('anizm', 'Export')).toBeUndefined();
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

    const host = row('kitsune').querySelector('[title]')!;

    expect(host.textContent).toBe('kitsune.me');
    expect(host.getAttribute('title')).toBe('kitsune.me, kitsune.tv');
  });
});
