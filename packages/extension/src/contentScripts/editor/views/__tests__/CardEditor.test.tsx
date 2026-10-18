import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen, within } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { SiteCard } from '~/sites/schema';

import { CardEditor, cardElements } from '../CardEditor';
import { renderInEditor, settle } from './harness';

function page() {
  document.body.innerHTML = `
    <main class="episodes">
      <div class="cell"><a class="card" href="/frieren/bolum-5"><img class="poster"><h3>Frieren</h3><p>5. Bölüm</p></a></div>
      <div class="cell"><a class="card" href="/dandadan/bolum-12"><img class="poster"><h3>Dandadan</h3><p>12. Bölüm</p></a></div>
      <div class="cell cloned"><a class="card" href="/dandadan/bolum-12"><img class="poster"><h3>Dandadan</h3></a></div>
      <div class="cell"><a class="card" href="/one-piece"><img class="poster"><h3>One Piece</h3></a></div>
    </main>`;
}

const card = (overrides: Partial<SiteCard> = {}): SiteCard => ({
  selector: '.card',
  title: { selector: 'h3' },
  inject: { position: 'append' },
  ...overrides,
});

function setUp(initial: SiteCard, onRemove?: () => void) {
  page();

  const [value, setValue] = createSignal(initial);
  const result = renderInEditor(() => (
    <CardEditor
      card={value()}
      index={0}
      onChange={setValue}
      onRemove={onRemove}
    />
  ));

  return { ...result, value };
}

const status = () => screen.getAllByRole('status')[0].textContent;

const readCards = () =>
  Array.from(
    screen.getByRole('list', { name: 'Cards read' }).children,
    (item) => item.textContent,
  );

afterEach(cleanup);

describe('cardElements', () => {
  it('finds the cards, filtered like the runtime does', () => {
    page();

    expect(cardElements(card())).toHaveLength(4);
    expect(cardElements(card({ exclude: '.cloned' }))).toHaveLength(3);
    expect(cardElements(card({ has: 'p' }))).toHaveLength(2);
    expect(cardElements(card({ selector: '' }))).toHaveLength(0);
    expect(cardElements(card({ selector: 'a[' }))).toHaveLength(0);
  });
});

describe('CardEditor', () => {
  it('counts the cards and shows what AniScore reads from them', () => {
    setUp(
      card({
        exclude: '.cloned',
        episode: { selector: 'p', steps: [{ match: '(\\d+)' }] },
      }),
    );

    expect(status()).toBe('3 cards on this page');
    expect(readCards()).toEqual([
      'Frieren · episode 5',
      'Dandadan · episode 12',
      "Skipped: it's missing the title, the episode or the place for the details",
    ]);
  });

  it('picks the cards from an element in one of them, and widens them', async () => {
    const { value, willPick } = setUp(card({ selector: '' }));

    expect(status()).toBe('0 cards on this page');

    willPick(document.querySelector('h3')!, undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Pick a card' }));
    await settle();

    // The cell around each card link repeats as often, and is outermost
    expect(value().selector).toBe('main.episodes > div.cell');
    expect(status()).toBe('4 cards on this page');

    fireEvent.input(screen.getByRole('textbox', { name: 'Card selector' }), {
      target: { value: 'a.card' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Widen to the element around the cards',
      }),
    );

    expect(value().selector).toBe('main.episodes > div.cell');

    // A cancelled pick, and nothing around the cards that repeats
    fireEvent.click(screen.getByRole('button', { name: 'Pick a card' }));
    await settle();
    fireEvent.input(screen.getByRole('textbox', { name: 'Card selector' }), {
      target: { value: 'main' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Widen to the element around the cards',
      }),
    );

    expect(value().selector).toBe('main');
  });

  it('filters the cards', async () => {
    const { value, willPick } = setUp(card());
    const input = (name: RegExp) => screen.getByRole('textbox', { name });

    fireEvent.input(input(/^Skip cards in/), { target: { value: '.cloned' } });
    fireEvent.input(input(/^Only cards with/), { target: { value: 'p' } });

    expect(value()).toMatchObject({ exclude: '.cloned', has: 'p' });

    willPick(document.querySelector('h3')!, document.body);
    fireEvent.click(
      screen.getByRole('button', { name: 'Pick what cards must have' }),
    );
    await settle();

    expect(value().has).toBe('h3');

    // Outside the cards
    fireEvent.click(
      screen.getByRole('button', { name: 'Pick what cards must have' }),
    );
    await settle();
    fireEvent.input(input(/^Skip cards in/), { target: { value: '' } });
    fireEvent.input(input(/^Only cards with/), { target: { value: '' } });

    expect(value()).toMatchObject({ exclude: undefined, has: undefined });
  });

  it('edits the title, episode and season', () => {
    const { value } = setUp(card());
    const section = (name: string) =>
      screen.getByRole('heading', { name }).closest('section')!;

    fireEvent.input(
      within(section('Title')).getByRole('textbox', { name: /^Element/ }),
      {
        target: { value: '' },
      },
    );
    expect(value().title).toEqual({});

    fireEvent.click(
      within(section('Episode')).getByRole('button', { name: 'Read it' }),
    );
    fireEvent.click(
      within(section('Season')).getByRole('button', { name: 'Read it' }),
    );
    expect(value()).toMatchObject({ episode: {}, season: {} });

    fireEvent.click(
      within(section('Season')).getByRole('button', { name: "Don't read" }),
    );
    expect(value().season).toBeUndefined();
  });

  it('places the details where the user says', async () => {
    const { value, willPick } = setUp(card());

    fireEvent.input(
      screen.getByRole('textbox', { name: /^Show the details next to/ }),
      {
        target: { value: 'h3' },
      },
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Position' }), {
      target: { value: 'after' },
    });
    expect(value().inject).toEqual({ selector: 'h3', position: 'after' });

    willPick(
      document.querySelector('.poster')!,
      document.querySelector('.card')!,
      undefined,
    );

    const pickPlace = () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'Pick where the details go' }),
      );

    pickPlace();
    await settle();
    expect(value().inject).toEqual({
      selector: 'img.poster',
      position: 'after',
    });

    // The card itself, then a cancelled pick
    pickPlace();
    await settle();
    pickPlace();
    await settle();
    expect(value().inject).toEqual({ selector: undefined, position: 'after' });

    fireEvent.input(
      screen.getByRole('textbox', { name: /^Show the details next to/ }),
      {
        target: { value: '' },
      },
    );
    expect(value().inject).toEqual({ selector: undefined, position: 'after' });
  });

  it('shimmers the element the user picks, or nothing', async () => {
    const { value, willPick } = setUp(card());

    fireEvent.click(
      screen.getByRole('button', { name: 'Shimmer while watching' }),
    );
    expect(value().shimmer).toEqual({});

    willPick(
      document.querySelector('.poster')!,
      document.querySelector('.card')!,
      undefined,
    );

    const pickShimmer = () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'Pick the shimmering element' }),
      );

    pickShimmer();
    await settle();
    expect(value().shimmer).toEqual({ selector: 'img.poster' });

    pickShimmer();
    await settle();
    pickShimmer();
    await settle();
    expect(value().shimmer).toEqual({ selector: undefined });

    const shimmerElement = () =>
      within(
        screen.getByRole('heading', { name: 'Shimmer' }).closest('section')!,
      ).getByRole('textbox', { name: /^Element/ });

    fireEvent.input(shimmerElement(), { target: { value: '.poster' } });
    expect(value().shimmer).toEqual({ selector: '.poster' });

    fireEvent.input(shimmerElement(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'No shimmer' }));
    expect(value().shimmer).toBeUndefined();
  });

  it('counts one card in the singular, and can be removed', () => {
    let removed = false;

    setUp(card({ selector: '.card[href="/one-piece"]' }), () => {
      removed = true;
    });

    expect(status()).toBe('1 card on this page');

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(removed).toBe(true);
  });
});
