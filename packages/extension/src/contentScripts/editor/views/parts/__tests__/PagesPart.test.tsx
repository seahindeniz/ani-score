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

beforeEach(() => history.replaceState(null, '', '/yeniler/2'));

afterEach(() => {
  cleanup();
  history.replaceState(null, '', '/');
});

describe('PagesPart', () => {
  it('shows the scores on pages like this one, or on every page', () => {
    const { page } = setUp({}, false);

    expect(screen.getByText('Show scores on')).toBeTruthy();
    expect(radio(/Every page on example.com/).checked).toBe(true);
    expect(radio(/Pages like this one/).parentElement!.textContent).toContain(
      'example.com/yeniler/2 and similar addresses',
    );

    fireEvent.click(radio(/Pages like this one/));

    expect(page().match).toEqual({ path: '^/yeniler/\\d+$' });

    fireEvent.click(radio(/Every page/));

    expect(page().match).toEqual({});
  });

  it('keeps pages set up by hand, and warns when they leave out this one', () => {
    setUp({ path: '^/other$' });

    expect(radio(/Pages you set up/).checked).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain(
      "don't include the one you're on",
    );
  });

  it('edits the page and the site under Advanced', async () => {
    document.body.innerHTML = '<main class="episodes"></main>';

    const { config, page, willPick } = setUp({});

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.input(textbox(/^Page name/), { target: { value: 'Latest' } });
    fireEvent.input(textbox(/^Path/), { target: { value: '^/yeniler' } });
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
      name: 'Latest',
      match: { path: '^/yeniler', search: 'page=', selector: 'main' },
    });
    expect(config()).toMatchObject({
      name: 'Kitsune',
      id: 'kitsune',
      matches: ['*://kitsune.me/*', '*://kitsune.tv/*'],
    });

    for (const name of [/^Page name/, /^Path/, /^Query/, /^Only while/]) {
      fireEvent.input(textbox(name), { target: { value: '' } });
    }

    expect(page().name).toBeUndefined();
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
      text: 'example.com/yeniler/2 and similar',
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
