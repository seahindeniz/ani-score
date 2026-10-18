import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { SitePage } from '~/sites/schema';

import { PagesTab } from '../PagesTab';
import { renderInEditor, settle } from './harness';

const page = (overrides: Partial<SitePage> = {}): SitePage => ({
  match: { path: '^/episodes$' },
  cards: [{ selector: '.card', title: {}, inject: { position: 'append' } }],
  ...overrides,
});

function setUp(initial: SitePage[]) {
  const [pages, setPages] = createSignal(initial);
  const result = renderInEditor(() => (
    <PagesTab pages={pages()} onChange={setPages} />
  ));

  return { ...result, pages };
}

const tab = (name: string) => screen.getByRole('tab', { name });
const textbox = (name: RegExp) => screen.getByRole('textbox', { name });

afterEach(() => {
  cleanup();
  history.replaceState(null, '', '/');
});

describe('PagesTab', () => {
  it('says whether the page applies where the user is', () => {
    history.replaceState(null, '', '/episodes');
    setUp([page({ name: 'Episodes' })]);

    expect(tab('Episodes').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Applies to the page you are on')).toBeTruthy();

    fireEvent.input(textbox(/^Path/), { target: { value: '^/$' } });
    expect(
      screen.getByText("Doesn't apply to the page you are on"),
    ).toBeTruthy();

    // An expression being typed
    fireEvent.input(textbox(/^Path/), { target: { value: '(' } });
    expect(
      screen.getByText("Doesn't apply to the page you are on"),
    ).toBeTruthy();
  });

  it("edits the page's name, path, query and element", async () => {
    history.replaceState(null, '', '/episodes/latest/3');
    document.body.innerHTML = '<main id="episodes"></main>';

    const { pages, willPick } = setUp([page()]);

    fireEvent.input(textbox(/^Name/), { target: { value: 'Latest' } });
    fireEvent.click(
      screen.getByRole('button', { name: "Use this page's path" }),
    );
    fireEvent.input(textbox(/^Query/), { target: { value: 'page=\\d' } });
    fireEvent.input(textbox(/^Only while this exists/), {
      target: { value: 'main' },
    });

    expect(pages()[0]).toMatchObject({
      name: 'Latest',
      match: {
        path: '^/episodes/latest/\\d+$',
        search: 'page=\\d',
        selector: 'main',
      },
    });

    willPick(document.querySelector('main')!, undefined);
    fireEvent.click(
      screen.getByRole('button', { name: 'Pick an element the page has' }),
    );
    await settle();
    expect(pages()[0].match.selector).toBe('#episodes');

    fireEvent.click(
      screen.getByRole('button', { name: 'Pick an element the page has' }),
    );
    await settle();
    fireEvent.input(textbox(/^Name/), { target: { value: '' } });
    fireEvent.input(textbox(/^Path/), { target: { value: '' } });
    fireEvent.input(textbox(/^Query/), { target: { value: '' } });
    fireEvent.input(textbox(/^Only while this exists/), {
      target: { value: '' },
    });

    expect(pages()[0]).toMatchObject({
      name: undefined,
      match: { path: undefined, search: undefined, selector: undefined },
    });
  });

  it('adds, switches and removes pages', () => {
    history.replaceState(null, '', '/home');

    const { pages } = setUp([page({ name: 'Episodes' })]);

    expect(screen.queryByRole('button', { name: 'Remove page' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '+ Page' }));

    expect(pages()).toHaveLength(2);
    expect(pages()[1].match.path).toBe('^/home$');
    expect(tab('Page 2').getAttribute('aria-selected')).toBe('true');

    fireEvent.click(tab('Episodes'));
    expect((textbox(/^Name/) as HTMLInputElement).value).toBe('Episodes');

    fireEvent.click(screen.getByRole('button', { name: 'Remove page' }));
    expect(pages().map((item) => item.match.path)).toEqual(['^/home$']);
  });

  it('adds, edits and removes card types', () => {
    const { pages } = setUp([page()]);

    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '+ Card type' }));
    expect(pages()[0].cards).toHaveLength(2);

    fireEvent.input(
      screen.getAllByRole('textbox', { name: 'Card selector' })[1],
      {
        target: { value: '.series' },
      },
    );
    expect(pages()[0].cards[1].selector).toBe('.series');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(pages()[0].cards.map((card) => card.selector)).toEqual(['.series']);
  });

  it("spaces the cards' container", () => {
    document.body.innerHTML = `
      <div class="rail" style="display: flex"><div class="card"></div></div>
      <div class="tiles" style="display: grid"><div class="tile"></div></div>`;

    const { pages } = setUp([page()]);
    const add = () =>
      fireEvent.click(
        screen.getByRole('button', { name: "Add for the cards' container" }),
      );

    add();
    expect(pages()[0].layout).toEqual([
      { container: 'div.rail', mode: 'flex', gap: 30, minCardWidth: 220 },
    ]);

    fireEvent.input(screen.getByRole('textbox', { name: 'Container' }), {
      target: { value: '.rail' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Layout' }), {
      target: { value: 'grid' },
    });
    fireEvent.input(screen.getByRole('spinbutton', { name: /^Gap/ }), {
      target: { value: '12' },
    });
    fireEvent.input(screen.getByRole('spinbutton', { name: /^Card width/ }), {
      target: { value: '' },
    });
    expect(pages()[0].layout).toEqual([
      { container: '.rail', mode: 'grid', gap: 12, minCardWidth: undefined },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Remove spacing' }));
    expect(pages()[0].layout).toBeUndefined();

    // A grid, and a page whose cards aren't on the page
    fireEvent.input(screen.getByRole('textbox', { name: 'Card selector' }), {
      target: { value: '.tile' },
    });
    add();
    expect(pages()[0].layout).toEqual([
      { container: 'div.tiles', mode: 'grid', gap: 30, minCardWidth: 180 },
    ]);

    fireEvent.input(screen.getByRole('textbox', { name: 'Card selector' }), {
      target: { value: '.missing' },
    });
    add();
    expect(pages()[0].layout).toHaveLength(1);
  });

  it("edits the page's CSS", () => {
    const { pages } = setUp([page()]);

    fireEvent.input(screen.getByRole('textbox', { name: /^Page CSS/ }), {
      target: { value: '.grid { gap: 8px }' },
    });
    expect(pages()[0].css).toBe('.grid { gap: 8px }');

    fireEvent.input(screen.getByRole('textbox', { name: /^Page CSS/ }), {
      target: { value: '' },
    });
    expect(pages()[0].css).toBeUndefined();
  });
});
