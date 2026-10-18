import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

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

function paste(json: string) {
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
  it('lists the built-in sites that are always on', async () => {
    await renderSites();

    expect(row('anizm').textContent).toContain('Anizm');
    expect(row('anizm').textContent).toContain('Built in');
    expect(row('anizm').textContent).toContain('anizm.net');
    expect(row('anizm').textContent).toContain('Always on');
    expect(row('tranimeizle').textContent).toContain('www.tranimeizle.live');
  });

  it('imports a config, to be turned on', async () => {
    await renderSites();
    paste(JSON.stringify(config('openani')));

    expect(screen.getByRole('status').textContent).toBe(
      'Imported Openani. Turn it on to allow it on openani.me.',
    );
    expect(row('openani').textContent).toContain('Yours');
    expect(store.data()).toEqual([
      { config: config('openani'), savedAt: expect.any(Number) },
    ]);
    expect(
      (screen.getByLabelText('Site config') as HTMLTextAreaElement).value,
    ).toBe('');
  });

  it('replaces a config imported again', async () => {
    await renderSites([{ config: config('openani'), savedAt: 1 }]);
    paste(JSON.stringify(config('openani', { name: 'OpenAni' })));

    expect(store.data()).toHaveLength(1);
    expect(row('openani').textContent).toContain('OpenAni');
  });

  it('says why a config cannot be imported', async () => {
    await renderSites();
    paste('{ nope');

    expect(screen.getByRole('status').textContent).toBe(
      "That isn't valid JSON.",
    );

    paste(JSON.stringify(config('openani', { schemaVersion: 9 as 1 })));

    expect(screen.getByRole('status').textContent).toBe(
      'This config needs a newer AniScore (schema version 9)',
    );
    expect(store.data()).toEqual([]);
  });

  it("asks the browser for access to turn a site on, and drops access it doesn't need to turn it off", async () => {
    await renderSites([{ config: config('openani'), savedAt: 1 }]);
    fireEvent.click(button('openani', 'Turn on'));

    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({
      origins: ['*://openani.me/*'],
    });
    await waitFor(() => expect(button('openani', 'Turn off')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toBe(
      'Openani is on. Reload its open tabs to see ratings.',
    );

    fireEvent.click(button('openani', 'Turn off'));

    expect(fakeBrowser.permissions.remove).toHaveBeenCalledWith({
      origins: ['*://openani.me/*'],
    });
    await waitFor(() => expect(button('openani', 'Turn on')).toBeTruthy());
  });

  it('stays off when the user declines access', async () => {
    fakeBrowser.permissions.request.mockResolvedValueOnce(false);
    await renderSites([{ config: config('openani'), savedAt: 1 }]);
    fireEvent.click(button('openani', 'Turn on'));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'Openani stays off, since access was declined.',
      ),
    );
  });

  it('deletes a config with the access only it needed', async () => {
    await fakeBrowser.permissions.request({
      origins: ['*://openani.me/*', '*://animex.me/*'],
    });
    await renderSites([
      { config: config('openani'), savedAt: 1 },
      {
        config: config('animex', {
          matches: ['*://animex.me/*', '*://openani.me/*'],
        }),
        savedAt: 2,
      },
    ]);
    fireEvent.click(button('animex', 'Delete'));

    expect(
      store.data().map((entry) => (entry.config as SiteConfig).id),
    ).toEqual(['openani']);
    expect(fakeBrowser.permissions.remove).toHaveBeenCalledWith({
      origins: ['*://animex.me/*'],
    });

    fireEvent.click(button('openani', 'Delete'));

    expect(fakeBrowser.permissions.remove).toHaveBeenCalledWith({
      origins: ['*://openani.me/*'],
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
      'The built-in config changed since you edited it.',
    );
    // A user's config is never on from install
    expect(button('anizm', 'Turn on')).toBeTruthy();

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

    expect(screen.getByText('broken')).toBeTruthy();
    expect(screen.getByText('Unnamed config')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    expect(store.data()).toEqual([{ config: null, savedAt: 2 }]);
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

    await renderSites([{ config: config('openani'), savedAt: 1 }]);
    fireEvent.click(button('openani', 'Export'));
    fireEvent.click(button('anizm', 'Export'));

    const [[blob]] = createObjectURL.mock.calls as unknown as [[Blob]];

    expect(JSON.parse(await blob.text())).toEqual(config('openani'));
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      'openani.json',
    );
    expect((click.mock.contexts[1] as HTMLAnchorElement).download).toBe(
      'anizm.json',
    );
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:config');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });

  it('shows more than one host as a count', async () => {
    await renderSites([
      {
        config: config('openani', {
          matches: ['*://openani.me/*', '*://*.openani.tv/*'],
        }),
        savedAt: 1,
      },
    ]);

    expect(row('openani').textContent).toContain('openani.me +1');
  });
});
