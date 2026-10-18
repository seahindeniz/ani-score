import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { SiteCard, SitePage } from '~/sites/schema';

import { cardElements } from '../../../logic/detect';
import {
  cardSpec,
  chooseOption,
  episodeGrid,
  renderInEditor,
  settle,
} from '../../__tests__/harness';
import { HighlightPart, highlightSummary } from '../HighlightPart';

// The cells are the cards, so the grid with its gap is around them
const cellCard = (changes: Partial<SiteCard> = {}) =>
  cardSpec({ selector: 'div.cell', ...changes });

function setUp(initialCard: SiteCard, initialPage: Partial<SitePage> = {}) {
  const [card, setCard] = createSignal(initialCard);
  const [page, setPage] = createSignal<SitePage>({
    match: {},
    cards: [initialCard],
    ...initialPage,
  });
  const result = renderInEditor(() => (
    <HighlightPart
      card={card()}
      onChange={setCard}
      elements={() => cardElements(card())}
      page={page()}
      onPageChange={(changes) =>
        setPage((current) => ({ ...current, ...changes }))
      }
      advanced
    />
  ));

  return { ...result, card, page };
}

const radio = (name: RegExp) =>
  screen.getByRole('radio', { name }) as HTMLInputElement;
const slider = () => screen.getByRole('slider') as HTMLInputElement;

afterEach(cleanup);

describe('HighlightPart', () => {
  it('chooses what glows, and shows it on the first two cards', async () => {
    const cards = episodeGrid();
    const { card, marks, willPick } = setUp(cellCard());

    expect(radio(/Don't highlight/).checked).toBe(true);
    expect(marks().glow).toEqual([]);

    fireEvent.click(radio(/The poster/));

    expect(card().shimmer).toEqual({ selector: 'div.poster' });
    expect(marks().glow).toEqual(
      cards.slice(0, 2).map((element) => element.querySelector('.poster')!),
    );
    expect(
      screen.getByText('In this preview, the first two cards glow.'),
    ).toBeTruthy();

    fireEvent.click(radio(/The whole card/));

    expect(card().shimmer).toEqual({});
    expect(marks().glow).toHaveLength(2);

    willPick(cards[0].querySelector('h3')!);
    fireEvent.click(radio(/Another part/));
    await settle();

    expect(card().shimmer).toEqual({ selector: 'h3' });
    expect(radio(/Another part/).parentElement!.textContent).toContain('h3');

    willPick(cards[0].parentElement!);
    fireEvent.click(radio(/The poster/));
    fireEvent.click(radio(/Another part/));
    await settle();

    expect(card().shimmer).toEqual({});

    fireEvent.click(radio(/Don't highlight/));

    expect(card().shimmer).toBeUndefined();
  });

  it('glows only where the element is', () => {
    episodeGrid();
    setUp(cellCard({ shimmer: { selector: '.missing' } }));

    expect(screen.queryByRole('radio', { name: /The poster/ })).toBeTruthy();
  });

  it("sets the space between the cards, from the site's own", () => {
    episodeGrid();

    const { page } = setUp(cellCard({ shimmer: {} }));

    expect(slider().value).toBe('20');
    expect(slider().getAttribute('aria-valuetext')).toBe("Site's own, 20 px");
    expect(
      screen.getByText(/^If the glow runs into the next card/).textContent,
    ).toBe(
      "If the glow runs into the next card, add space until it stands alone. The site spaces its cards with the gap between them, so that's what changes.",
    );

    fireEvent.input(slider(), { target: { value: '32' } });

    expect(page().layout).toEqual([
      { container: 'div.episodes', mode: 'grid', gap: 32 },
    ]);
    expect(slider().getAttribute('aria-valuetext')).toBe('32 px');

    fireEvent.click(
      screen.getByRole('button', { name: "Use the site's spacing" }),
    );

    expect(page().layout).toBeUndefined();
  });

  it('keeps the rest of the layout when going back to the site spacing', () => {
    episodeGrid();

    const { page } = setUp(cellCard(), {
      layout: [
        { container: 'div.episodes', mode: 'grid', gap: 30, minCardWidth: 180 },
        { container: 'main', mode: 'flex', gap: 8 },
      ],
    });

    expect(
      screen.getByText(/^Add space if the score makes the cards look cramped/),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: "Use the site's spacing" }),
    );

    expect(page().layout).toEqual([
      { container: 'main', mode: 'flex', gap: 8 },
      {
        container: 'div.episodes',
        mode: 'grid',
        gap: undefined,
        minCardWidth: 180,
      },
    ]);
  });

  it('spaces cards the way the site does, like with their padding', () => {
    episodeGrid();
    (document.querySelector('.episodes') as HTMLElement).style.display =
      'block';

    for (const cell of document.querySelectorAll<HTMLElement>('.cell')) {
      cell.style.padding = '0 8px';
    }

    const { page } = setUp(cellCard());

    expect(slider().value).toBe('16');
    expect(
      screen.getByText(/spaces its cards with their padding/),
    ).toBeTruthy();

    fireEvent.input(slider(), { target: { value: '24' } });

    expect(page().layout).toEqual([
      { container: 'div.episodes', mode: 'block', spacing: 'padding', gap: 24 },
    ]);
  });

  it('lists the parts of the cards around the score, and sizes them', () => {
    const cards = episodeGrid();

    // Each card's name box is 70px high and 150px wide, too small for the details
    for (const card of cards) {
      const box = card.querySelector('h3')!;
      const details = document.createElement('div');

      details.className = 'ani-score';
      box.append(details);
      box.style.height = '70px';
      box.style.width = '150px';
      Object.defineProperties(box, {
        scrollHeight: { value: 120 },
        clientHeight: { value: 70 },
        scrollWidth: { value: 200 },
        clientWidth: { value: 150 },
      });
    }

    const { page, pointed } = setUp(cellCard());
    const sizes = screen.getByRole('region', { name: 'Room for the score' });
    const height = () =>
      screen.getByRole('combobox', { name: 'Height of :is(div.cell) h3' });
    const width = () =>
      screen.getByRole('combobox', { name: 'Width of :is(div.cell) h3' });

    expect(screen.getByRole('alert').textContent).toStartWith(
      'One part of the cards is too small for the score',
    );
    // From the closest to the whole card
    expect(
      Array.from(sizes.querySelectorAll('code'), (code) => code.textContent),
    ).toEqual([':is(div.cell) h3', ':is(div.cell) article.card', 'div.cell']);
    expect(
      screen.getByText(
        '150 × 70 px, too short on 5 cards, too narrow on 5 cards',
      ),
    ).toBeTruthy();

    // Pointing at one outlines it on the page
    const block = sizes.querySelector('code')!.parentElement!;

    fireEvent.mouseEnter(block);

    expect(pointed()).toEqual(cards.map((card) => card.querySelector('h3')!));

    fireEvent.mouseLeave(block);

    expect(pointed()).toEqual([]);

    fireEvent.focusIn(block);
    fireEvent.focusOut(block);

    chooseOption(height(), 'Fit the content');
    chooseOption(width(), 'Set a width');

    expect(page().sizes).toEqual([
      { selector: ':is(div.cell) h3', height: 'auto', width: 190 },
    ]);

    fireEvent.input(
      screen.getByRole('spinbutton', {
        name: 'Width of :is(div.cell) h3 in pixels',
      }),
      { target: { value: '' } },
    );

    expect(page().sizes).toEqual([
      { selector: ':is(div.cell) h3', height: 'auto', width: 'auto' },
    ]);

    chooseOption(height(), "The site's height");
    chooseOption(width(), 'No limit');

    expect(page().sizes).toEqual([
      { selector: ':is(div.cell) h3', width: 'auto' },
    ]);

    chooseOption(width(), "The site's width");

    expect(page().sizes).toBeUndefined();
  });

  it('keeps a size set before, also off this page', () => {
    episodeGrid();

    const { pointed } = setUp(cellCard(), {
      sizes: [
        { selector: ':is(div.cell) h3', height: 140 },
        { selector: 'div[', width: 'auto' },
      ],
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.getAllByText('Not around the score on this page'),
    ).toHaveLength(2);
    expect(
      (
        screen.getByRole('spinbutton', {
          name: 'Height of :is(div.cell) h3 in pixels',
        }) as HTMLInputElement
      ).value,
    ).toBe('140');

    // A selector being typed outlines nothing
    fireEvent.mouseEnter(screen.getByText('div[').parentElement!);

    expect(pointed()).toEqual([]);
  });

  it('has no spacing without cards', () => {
    episodeGrid();
    setUp(cellCard({ selector: '.missing' }));

    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('edits the glowing element and the layout under Advanced', () => {
    episodeGrid();

    const { card, page } = setUp(cellCard({ shimmer: {} }), {
      layout: [{ container: 'div.episodes', mode: 'grid', gap: 30 }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.input(screen.getByRole('textbox', { name: /Glowing element/ }), {
      target: { value: 'img' },
    });

    expect(card().shimmer).toEqual({ selector: 'img' });

    fireEvent.input(screen.getByRole('textbox', { name: /Glowing element/ }), {
      target: { value: '' },
    });

    expect(card().shimmer).toEqual({ selector: undefined });

    fireEvent.input(screen.getByRole('textbox', { name: 'Container' }), {
      target: { value: 'main' },
    });
    chooseOption(screen.getByRole('combobox', { name: 'Layout' }), 'Row');
    chooseOption(
      screen.getByRole('combobox', { name: 'Spaced by' }),
      "Cards' margins",
    );
    fireEvent.input(screen.getByRole('spinbutton', { name: /Space/ }), {
      target: { value: '12' },
    });
    fireEvent.input(screen.getByRole('spinbutton', { name: /Card width/ }), {
      target: { value: '' },
    });

    expect(page().layout).toEqual([
      {
        container: 'main',
        mode: 'flex',
        spacing: 'margin',
        gap: 12,
        minCardWidth: undefined,
      },
    ]);

    chooseOption(screen.getByRole('combobox', { name: 'Spaced by' }), 'Gap');

    expect(page().layout![0].spacing).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: 'Remove spacing' }));

    expect(page().layout).toBeUndefined();
  });
});

describe('highlightSummary', () => {
  it('says when cards cut the score off', () => {
    const [card] = episodeGrid();
    const name = card.querySelector('h3')!;

    name.append(
      Object.assign(document.createElement('div'), { className: 'ani-score' }),
    );
    Object.defineProperties(name, {
      scrollHeight: { value: 120 },
      clientHeight: { value: 70 },
    });

    expect(
      highlightSummary(cellCard(), { match: {}, cards: [] }, [card]),
    ).toEqual({ text: 'Some cards cut the score off', status: 'issue' });
  });

  it('names what glows and the spacing', () => {
    const cards = cardElements(cellCard({ selector: '' }));

    episodeGrid();

    const elements = cardElements(cellCard());

    expect(cards).toEqual([]);
    expect(
      highlightSummary(cellCard(), { match: {}, cards: [] }, elements).text,
    ).toBe("No highlight, site's own spacing");
    expect(
      highlightSummary(
        cellCard({ shimmer: { selector: 'h3' } }),
        {
          match: {},
          cards: [],
          layout: [{ container: 'div.episodes', mode: 'grid', gap: 30 }],
        },
        elements,
      ).text,
    ).toBe('Another part, 30 px apart');
    expect(
      highlightSummary(cellCard({ shimmer: {} }), { match: {}, cards: [] }, [])
        .text,
    ).toBe("The whole card, site's own spacing");
  });
});
