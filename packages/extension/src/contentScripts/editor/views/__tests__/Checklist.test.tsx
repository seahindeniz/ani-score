import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { SiteConfig } from '~/sites/schema';

import type { ChecklistProps } from '../Checklist';
import { Checklist } from '../Checklist';
import { cardSpec, episodeGrid, renderInEditor, settle } from './harness';

const saved: SiteConfig = {
  schemaVersion: 1,
  id: 'example',
  name: 'Example',
  matches: ['*://example.com/*'],
  theme: 'dark',
  pages: [
    {
      name: 'Latest',
      match: {},
      cards: [
        cardSpec({
          // Misses the episodes with a season, so there's something to point out
          episode: { selector: 'span', steps: [{ match: '^(\\d+)\\. Bölüm' }] },
          inject: { selector: 'h3', position: 'after' },
        }),
      ],
    },
    {
      match: { path: '^/elsewhere$' },
      cards: [cardSpec({ selector: '.other' })],
    },
  ],
};

function setUp(
  initial: SiteConfig = saved,
  overrides: Partial<ChecklistProps> = {},
  { deletable = true } = {},
) {
  episodeGrid();

  const [config, setConfig] = createSignal(initial);
  const handlers = {
    onSave: mock(async (_: SiteConfig) => {}),
    onDiscard: mock(),
    onStartOver: mock(),
    onDelete: deletable ? mock(async () => {}) : undefined,
    onClose: mock(),
    onMove: mock(),
  };
  const result = renderInEditor(() => (
    <Checklist
      config={config()}
      onChange={setConfig}
      dirty={JSON.stringify(config()) !== JSON.stringify(initial)}
      subtitle="Your setup, saved 12 October"
      position={undefined}
      {...handlers}
      {...overrides}
    />
  ));

  return { ...result, ...handlers, props: handlers, config };
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const row = (name: string) =>
  button(new RegExp(`^((Works|Needs a look) )?${name}`));
const status = () =>
  screen.getAllByRole('status').find((element) => element.tagName === 'SPAN')!
    .textContent;

afterEach(cleanup);

describe('Checklist', () => {
  it('lists what the setup does, each with what it reads now, one open at a time', () => {
    setUp();

    expect(screen.getByText('Your setup, saved 12 October')).toBeTruthy();
    expect(
      Array.from(
        screen.getAllByRole('heading', { level: 2 }),
        (heading) => heading.textContent,
      ),
    ).toEqual(['What AniScore reads', 'How it looks', 'Where it works']);
    expect(row('Episode cards').textContent).toContain('5 on this page');
    expect(
      row('Episode cards')
        .querySelector('[role=img]')!
        .getAttribute('aria-label'),
    ).toBe('Works');
    expect(row('Episode number').textContent).toContain('Read on 3 of 5 cards');
    expect(
      row('Episode number')
        .querySelector('[role=img]')!
        .getAttribute('aria-label'),
    ).toBe('Needs a look');
    expect(row('Colors').textContent).toContain('Dark');

    fireEvent.click(row('Name'));

    expect(row('Name').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Pick again' })).toBeTruthy();

    fireEvent.click(row('Score position'));

    expect(row('Name').getAttribute('aria-expanded')).toBe('false');
    expect(
      screen.getByRole('radiogroup', { name: 'Where the score goes' }),
    ).toBeTruthy();

    fireEvent.click(row('Score position'));

    expect(screen.queryByRole('radiogroup')).toBeNull();

    // Every part opens in place
    for (const name of [
      'Episode number',
      'Season',
      'Colors',
      'Highlight and spacing',
      'Pages and addresses',
    ]) {
      fireEvent.click(row(name));

      expect(row(name).getAttribute('aria-expanded')).toBe('true');
    }
  });

  it('saves the changes, or discards them', async () => {
    const { onSave, onDiscard, config } = setUp();

    expect(status()).toBe('No changes');
    expect(button('Save').hasAttribute('disabled')).toBe(true);

    fireEvent.click(row('Colors'));
    fireEvent.click(screen.getByRole('radio', { name: /^Light/ }));

    expect(status()).toBe('Unsaved changes, shown on the page');

    fireEvent.click(button('Discard'));

    expect(onDiscard).toHaveBeenCalled();

    fireEvent.click(button('Save'));
    await settle();

    expect(onSave).toHaveBeenCalledWith(config());
  });

  it("says when it's saved, and what keeps a setup from saving", async () => {
    const [dirty, setDirty] = createSignal(true);
    const { onSave } = setUp(saved, {
      get dirty() {
        return dirty();
      },
    });

    fireEvent.click(button('Save'));
    await settle();
    setDirty(false);

    expect(onSave).toHaveBeenCalled();
    expect(status()).toBe('Saved');

    cleanup();
    setUp({ ...saved, id: '' }, { dirty: true });
    fireEvent.click(button('Save'));
    await settle();

    expect(screen.getByRole('alert').textContent).toStartWith(
      "Can't save yet:",
    );
  });

  it('switches between pages and kinds of cards, and adds and removes them', () => {
    const { config } = setUp();
    const page = () => screen.getByRole('combobox', { name: 'Page' });

    expect(
      Array.from(
        (page() as HTMLSelectElement).options,
        (option) => option.text,
      ),
    ).toEqual(['Latest (this page)', 'Page 2', 'Add a page']);

    fireEvent.change(page(), { target: { value: '1' } });

    expect(row('Episode cards').textContent).toContain('None on this page');

    fireEvent.click(row('Pages and addresses'));
    fireEvent.click(button('Remove this page'));

    expect(config().pages).toHaveLength(1);

    fireEvent.change(page(), { target: { value: 'add' } });

    expect(config().pages).toHaveLength(2);
    expect(row('Episode cards').getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(button('Add another kind of card'));

    expect(config().pages[1].cards).toHaveLength(2);

    const cards = screen.getByRole('combobox', { name: 'Cards' });

    fireEvent.change(cards, { target: { value: '0' } });
    fireEvent.click(button('Remove this kind of card'));

    expect(config().pages[1].cards).toHaveLength(1);
    expect(screen.queryByRole('combobox', { name: 'Cards' })).toBeNull();
  });

  it('starts over, shares, copies, downloads and deletes from its menu', async () => {
    const { onStartOver, onDelete } = setUp();
    const open = spyOn(window, 'open').mockImplementation(() => null);
    const writeText = mock(async () => {});
    const click = spyOn(
      HTMLAnchorElement.prototype,
      'click',
    ).mockImplementation(() => {});
    const menu = () => {
      fireEvent.click(button('More actions'));

      return screen.getByRole('menu');
    };
    const item = (name: string) => screen.getByRole('menuitem', { name });

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    expect(button('More actions').getAttribute('aria-expanded')).toBe('false');

    menu();
    fireEvent.click(item('Start from scratch'));

    expect(onStartOver).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();

    menu();
    fireEvent.click(item('Share with everyone'));
    await settle();

    expect(open).toHaveBeenCalled();

    menu();
    fireEvent.click(item('Copy the setup'));
    await settle();

    expect(writeText).toHaveBeenCalled();
    expect(screen.getByText('Copied the setup.')).toBeTruthy();

    menu();
    fireEvent.click(item('Download the setup file'));
    await settle();

    expect(click).toHaveBeenCalled();

    // Escape and leaving the menu close it
    fireEvent.keyDown(menu(), { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.keyDown(button('More actions'), { key: 'Enter' });
    fireEvent.focusOut(menu(), { relatedTarget: item('Copy the setup') });

    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.focusOut(screen.getByRole('menu'), {
      relatedTarget: document.body,
    });

    expect(screen.queryByRole('menu')).toBeNull();

    menu();
    fireEvent.click(item('Delete this setup'));

    expect(
      screen.getByRole('dialog', {
        name: 'Delete your setup for example.com?',
      }),
    ).toBeTruthy();

    fireEvent.keyDown(
      screen.getByRole('dialog', { name: /^Delete your setup/ }),
      { key: 'Escape' },
    );

    expect(screen.queryByRole('dialog', { name: /Delete/ })).toBeNull();

    menu();
    fireEvent.click(item('Delete this setup'));
    fireEvent.click(button('Cancel'));

    expect(screen.queryByRole('dialog', { name: /Delete/ })).toBeNull();

    menu();
    fireEvent.click(item('Delete this setup'));
    fireEvent.click(button('Delete'));

    expect(onDelete).toHaveBeenCalled();

    open.mockRestore();
    click.mockRestore();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it("doesn't offer to delete a setup the user didn't save", () => {
    setUp(saved, {}, { deletable: false });
    fireEvent.click(button('More actions'));

    expect(
      screen.queryByRole('menuitem', { name: 'Delete this setup' }),
    ).toBeNull();
  });

  it('changes the card, the page and the site from the parts, and moves', async () => {
    const { config, willPick, props } = setUp();
    const cards = Array.from(document.querySelectorAll('article.card'));

    fireEvent.click(row('Name'));
    willPick(cards[0].querySelector('div.poster')!);
    fireEvent.click(button('Pick again'));
    await settle();

    expect(config().pages[0].cards[0].title).toEqual({
      selector: 'div.poster',
    });

    fireEvent.click(row('Colors'));
    fireEvent.click(screen.getByRole('radio', { name: /Follow the site's/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Dark/ }));
    fireEvent.click(button('Advanced'));
    fireEvent.input(screen.getByRole('textbox', { name: /^Page CSS/ }), {
      target: { value: 'b {}' },
    });

    expect(config().pages[0].css).toBe('b {}');

    fireEvent.click(row('Pages and addresses'));
    fireEvent.click(button('Advanced'));
    fireEvent.input(screen.getByRole('textbox', { name: /^Site name/ }), {
      target: { value: 'Kitsune' },
    });

    expect(config().name).toBe('Kitsune');

    fireEvent.keyDown(button(/^Move the panel/), { key: 'ArrowDown' });

    expect(props.onMove).toHaveBeenCalled();
  });
});
