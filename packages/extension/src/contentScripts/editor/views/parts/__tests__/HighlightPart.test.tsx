import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { SiteCard, SitePage } from '~/sites/schema';

import { cardElements } from '../../../logic/detect';
import {
  cardSpec,
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
      screen.getByText(
        'If the glow runs into the next card, add space until it stands alone.',
      ),
    ).toBeTruthy();

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
      screen.getByText('Add space if the score makes the cards look cramped.'),
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
    fireEvent.change(screen.getByRole('combobox', { name: 'Layout' }), {
      target: { value: 'flex' },
    });
    fireEvent.input(screen.getByRole('spinbutton', { name: /Gap/ }), {
      target: { value: '12' },
    });
    fireEvent.input(screen.getByRole('spinbutton', { name: /Card width/ }), {
      target: { value: '' },
    });

    expect(page().layout).toEqual([
      { container: 'main', mode: 'flex', gap: 12, minCardWidth: undefined },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Remove spacing' }));

    expect(page().layout).toBeUndefined();
  });
});

describe('highlightSummary', () => {
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
