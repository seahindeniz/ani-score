import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { SiteConfig, SitePage } from '~/sites/schema';

import { renderInEditor, settle } from '../../__tests__/harness';
import { PagesPart, pagesSummary, safelyMatches } from '../PagesPart';

const site: SiteConfig = {
  schemaVersion: 1,
  id: 'example',
  name: 'Example',
  matches: ['*://example.com/*'],
  pages: [
    {
      match: {},
      cards: [{ selector: '.card', title: {}, inject: { position: 'append' } }],
    },
  ],
};

function setUp(match: SitePage['match'], advanced = true) {
  const [config, setConfig] = createSignal(site);
  const [page, setPage] = createSignal<SitePage>({ ...site.pages[0], match });
  const result = renderInEditor(() => (
    <PagesPart
      config={config()}
      onChange={(changes) =>
        setConfig((current) => ({ ...current, ...changes }))
      }
      page={page()}
      onPageChange={(changes) =>
        setPage((current) => ({ ...current, ...changes }))
      }
      advanced={advanced}
    />
  ));

  return { ...result, config, page };
}

const radio = (name: RegExp) =>
  screen.getByRole('radio', { name }) as HTMLInputElement;
const textbox = (name: RegExp) => screen.getByRole('textbox', { name });
const addresses = () =>
  Array.from(
    screen.getByRole('list', { name: 'Addresses' }).children,
    (item) => item.textContent,
  );

beforeEach(() => history.replaceState(null, '', '/yeniler/2'));

afterEach(() => {
  cleanup();
  history.replaceState(null, '', '/');
});

describe('PagesPart', () => {
  it('shows the scores on some pages, or on every page', () => {
    const { page } = setUp({}, false);

    expect(screen.getByText('Show scores on')).toBeTruthy();
    expect(radio(/Every page on example.com/).checked).toBe(true);
    expect(screen.queryByRole('list', { name: 'Addresses' })).toBeNull();

    fireEvent.click(radio(/Some pages/));

    expect(page().match).toEqual({ path: '^/yeniler/\\d+$' });
    expect(addresses()).toEqual(['example.com/yeniler/#Includes this page']);
    expect(screen.getByText('# stands for any number.')).toBeTruthy();
    // The only address can't go: that would be every page
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();

    fireEvent.click(radio(/Every page/));

    expect(page().match).toEqual({});
  });

  it('lists several addresses, adds this page to them, and removes them', () => {
    const { page } = setUp({ path: ['^/$', '^/series/[a-z-]+$'] }, false);

    expect(addresses()).toEqual(['example.com/', '^/series/[a-z-]+$']);
    expect(screen.queryByText('# stands for any number.')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain(
      "don't include the one you're on",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add this page' }));

    expect(page().match.path).toEqual([
      '^/$',
      '^/series/[a-z-]+$',
      '^/yeniler/\\d+$',
    ]);
    expect(screen.queryByRole('button', { name: 'Add this page' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove ^/series/[a-z-]+$' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove example.com/' }),
    );

    // One address stays a string
    expect(page().match.path).toBe('^/yeniler/\\d+$');
  });

  it('keeps pages set up by other means than their address', () => {
    setUp({ selector: '.nothing' });

    expect(radio(/Some pages/).checked).toBe(true);
    expect(screen.queryByRole('list', { name: 'Addresses' })).toBeNull();
  });

  it('edits the page and the site under Advanced', async () => {
    document.body.innerHTML = '<main class="episodes"></main>';

    const { config, page, willPick } = setUp({});

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a path' }));
    fireEvent.input(textbox(/^Path 1/), { target: { value: '^/yeniler' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a path' }));
    fireEvent.input(textbox(/^Path 2/), { target: { value: '^/[' } });

    // An expression being typed includes nothing
    expect(page().match.path).toEqual(['^/yeniler', '^/[']);
    expect(screen.getAllByText('Includes this page')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Remove path 2' }));
    fireEvent.input(textbox(/^Query/), { target: { value: 'page=' } });
    fireEvent.input(textbox(/^Only while this exists/), {
      target: { value: 'main' },
    });
    fireEvent.input(textbox(/^Site name/), { target: { value: 'Kitsune' } });
    fireEvent.input(textbox(/^Addresses/), {
      target: { value: '*://kitsune.me/*\n\n *://kitsune.tv/* ' },
    });
    fireEvent.input(textbox(/^Id/), { target: { value: 'kitsune' } });

    expect(page()).toMatchObject({
      match: { path: '^/yeniler', search: 'page=', selector: 'main' },
    });
    expect(config()).toMatchObject({
      name: 'Kitsune',
      id: 'kitsune',
      matches: ['*://kitsune.me/*', '*://kitsune.tv/*'],
    });

    for (const name of [/^Path 1/, /^Query/, /^Only while/]) {
      fireEvent.input(textbox(name), { target: { value: '' } });
    }

    expect(page().match).toEqual({
      path: undefined,
      search: undefined,
      selector: undefined,
    });

    willPick(document.querySelector('main')!, undefined);
    fireEvent.click(
      screen.getByRole('button', { name: 'Pick an element the page has' }),
    );
    await settle();

    expect(page().match.selector).toBe('main.episodes');

    fireEvent.click(
      screen.getByRole('button', { name: 'Pick an element the page has' }),
    );
    await settle();

    expect(page().match.selector).toBe('main.episodes');
  });
});

describe('pagesSummary', () => {
  it('names the pages, and whether this one is among them', () => {
    const page = (match: SitePage['match']) => ({ ...site.pages[0], match });

    expect(pagesSummary(page({ path: '^/yeniler/\\d+$' }))).toEqual({
      text: 'example.com/yeniler/#',
      status: 'ok',
    });
    expect(pagesSummary(page({ path: ['^/$', '^/yeniler/\\d+$'] }))).toEqual({
      text: 'example.com/ and 1 more',
      status: 'ok',
    });
    expect(pagesSummary(page({}))).toEqual({
      text: 'Every page on example.com',
      status: 'ok',
    });
    expect(pagesSummary(page({ search: 'x' })).text).toBe('Pages matching x');
    expect(pagesSummary(page({ selector: '.nothing' }))).toEqual({
      text: 'Pages matching .nothing',
      status: 'issue',
    });
    expect(safelyMatches(page({ path: '(' }))).toBe(false);
  });
});
