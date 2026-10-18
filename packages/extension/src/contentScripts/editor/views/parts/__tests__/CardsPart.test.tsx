import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

import { cardSpec, episodeGrid, settle } from '../../__tests__/harness';
import { CardsPart, cardsSummary } from '../CardsPart';
import { renderCardPart } from './render';

afterEach(cleanup);

const button = (name: string) => screen.getByRole('button', { name });

describe('CardsPart', () => {
  it('picks a card as it opens, and outlines the ones like it', async () => {
    const cards = episodeGrid();
    const { card, marks } = renderCardPart(
      CardsPart,
      cardSpec({ selector: '' }),
      { autoPick: true },
      [cards[1].querySelector('h3')!],
    );

    await settle();

    expect(card().selector).toBe('div.episodes > div.cell');
    expect(screen.getByRole('status').textContent).toBe('Found 5 cards');
    expect(marks().card).toHaveLength(5);
  });

  it('waits for the click, and offers to pick again after Escape', async () => {
    episodeGrid();

    const { pick } = renderCardPart(CardsPart, cardSpec({ selector: '' }), {
      autoPick: true,
    });

    expect(screen.getByText('Waiting for your click on the page')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Pick on the page' }),
    ).toBeNull();
    expect(pick).toHaveBeenCalledTimes(1);

    // Picking again stops the pick that's waiting
    cleanup();
    renderCardPart(CardsPart, cardSpec({ selector: '' }));

    expect(screen.getByText('Pick a card on the page.')).toBeTruthy();
  });

  it('says when the selector finds nothing here', async () => {
    const cards = episodeGrid();
    const { card, willPick } = renderCardPart(
      CardsPart,
      cardSpec({ selector: '.gone' }),
    );

    expect(
      screen.getByText('No cards like this on this page. Pick one.'),
    ).toBeTruthy();

    willPick(cards[0]);
    fireEvent.click(button('Pick on the page'));
    await settle();

    expect(card().selector).toBe('div.episodes > div.cell');
  });

  it('makes the outline bigger, and smaller again', async () => {
    const cards = episodeGrid();
    const { card, willPick } = renderCardPart(CardsPart, cardSpec());

    expect(button('Make smaller').hasAttribute('disabled')).toBe(true);

    fireEvent.click(button('Make bigger'));

    expect(card().selector).toBe('div.episodes > div.cell');

    fireEvent.click(button('Make smaller'));

    expect(card().selector).toBe('article.card');

    // Nothing around the grid repeats
    fireEvent.click(button('Make bigger'));
    fireEvent.click(button('Make bigger'));

    expect(card().selector).toBe('div.episodes > div.cell');

    willPick(cards[2]);
    fireEvent.click(button('Pick a different card'));
    await settle();

    expect(button('Make smaller').hasAttribute('disabled')).toBe(true);
  });

  it('warns when only one card has the outline', () => {
    episodeGrid([['Frieren', '1. Bölüm']]);
    renderCardPart(CardsPart, cardSpec());

    expect(screen.getByRole('alert').textContent).toContain(
      'Only one card has this outline',
    );
  });

  it('edits the selectors under Advanced', async () => {
    const cards = episodeGrid();
    const { card, willPick } = renderCardPart(CardsPart, cardSpec(), {
      advanced: true,
    });

    fireEvent.click(button('Advanced'));
    fireEvent.input(screen.getByRole('textbox', { name: /^Card selector/ }), {
      target: { value: 'article' },
    });
    fireEvent.input(screen.getByRole('textbox', { name: /^Skip cards in/ }), {
      target: { value: '.clone' },
    });
    fireEvent.input(screen.getByRole('textbox', { name: /^Only cards with/ }), {
      target: { value: 'a' },
    });

    expect(card()).toMatchObject({
      selector: 'article',
      exclude: '.clone',
      has: 'a',
    });

    fireEvent.input(screen.getByRole('textbox', { name: /^Skip cards in/ }), {
      target: { value: '' },
    });
    fireEvent.input(screen.getByRole('textbox', { name: /^Only cards with/ }), {
      target: { value: '' },
    });
    willPick(cards[0].querySelector('span')!, cards[0]);
    fireEvent.click(button('Pick what cards must have'));
    await settle();

    expect(card()).toMatchObject({ exclude: undefined, has: 'span' });

    // The card itself isn't something it has
    fireEvent.click(button('Pick what cards must have'));
    await settle();

    expect(card().has).toBe('span');
  });
});

describe('cardsSummary', () => {
  it('counts the cards on the page', () => {
    expect(cardsSummary(episodeGrid())).toEqual({
      text: '5 on this page',
      status: 'ok',
    });
    expect(cardsSummary([])).toEqual({
      text: 'None on this page',
      status: 'issue',
    });
  });
});
