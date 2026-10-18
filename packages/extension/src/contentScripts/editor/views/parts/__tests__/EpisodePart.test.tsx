import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

import { cardSpec, episodeGrid, settle } from '../../__tests__/harness';
import { describeRead, EpisodePart, episodeSummary } from '../EpisodePart';
import { renderCardPart } from './render';

afterEach(cleanup);

const turkishEpisode = {
  match: '(\\d+)(?:[.,]\\d+)?\\.\\s*B[öo]l[üu]m',
  flags: 'i',
};
const turkishSeason = { match: '(\\d+)\\.?\\s*Sezon', flags: 'i' };

const rows = () =>
  Array.from(screen.getAllByRole('row').slice(1), (row) =>
    Array.from(row.children, (cell) => cell.textContent),
  );

const withMovie = () =>
  episodeGrid([
    ['Sousou no Frieren', '12. Bölüm'],
    ['Suzume no Tojimari', 'Film'],
    ['Kusuriya no Hitorigoto', '2. Sezon 5. Bölüm'],
  ]);

describe('EpisodePart', () => {
  it('picks the episode as it opens, and reads the season when cards show one', async () => {
    const cards = episodeGrid();
    const { card, marks } = renderCardPart(
      EpisodePart,
      cardSpec(),
      { autoPick: true },
      [cards[2].querySelector('span')!],
    );

    expect(
      screen.getByText('Waiting for your click on an episode'),
    ).toBeTruthy();
    expect(marks().card).toHaveLength(5);

    await settle();

    expect(card()).toMatchObject({
      episode: { selector: 'span', steps: [turkishEpisode] },
      season: { selector: 'span', steps: [turkishSeason] },
    });
    expect(screen.getByRole('status').textContent).toBe(
      'Read an episode on all 5 cards',
    );
    expect(rows()).toEqual([
      ['12. Bölüm', 'Episode 12'],
      ['7. Bölüm', 'Episode 7'],
      ['2. Sezon 5. Bölüm', 'Season 2, episode 5'],
    ]);
    expect(marks().part).toHaveLength(5);

    fireEvent.click(
      screen.getByRole('checkbox', { name: /Read the season too/ }),
    );

    expect(card().season).toBeUndefined();
    expect(rows()[2]).toEqual(['2. Sezon 5. Bölüm', 'Episode 5']);

    fireEvent.click(
      screen.getByRole('checkbox', { name: /Read the season too/ }),
    );

    expect(card().season).toEqual({ selector: 'span', steps: [turkishSeason] });
  });

  it('reads the first number of other formats, and offers no season when there is none', async () => {
    const cards = episodeGrid([
      ['Frieren', '12'],
      ['Dandadan', '13'],
    ]);
    const { card, willPick } = renderCardPart(EpisodePart, cardSpec());

    expect(
      screen.getByText('Pick the episode text in one of the outlined cards.'),
    ).toBeTruthy();

    willPick(cards[0].querySelector('span')!);
    fireEvent.click(screen.getByRole('button', { name: 'Pick on the page' }));
    await settle();

    expect(card()).toMatchObject({
      episode: { selector: 'span', steps: [{ match: '(\\d+)' }] },
      season: undefined,
    });
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('reads an episode from the card itself, or an attribute', () => {
    episodeGrid([['Frieren', '12. Bölüm']]);
    document.querySelector('article')!.dataset.episode = '7';
    renderCardPart(
      EpisodePart,
      cardSpec({
        episode: { source: { attr: 'data-episode' } },
      }),
    );

    expect(rows()).toEqual([['7', 'Episode 7']]);
  });

  it('warns about cards without an episode, and can score them anyway', () => {
    withMovie();

    const { card, marks } = renderCardPart(
      EpisodePart,
      cardSpec({ episode: { selector: 'span', steps: [turkishEpisode] } }),
    );

    expect(screen.getByRole('status').textContent).toBe(
      'Read an episode on 2 of 3 cards',
    );
    expect(rows()[1]).toEqual(['Film', 'Nothing, card skipped']);
    expect(screen.getByRole('alert').textContent).toBe(
      "Suzume no Tojimari has no episode number, so it gets no score. Movies often don't have one.Score cards without an episode too",
    );
    expect(marks().skipped).toHaveLength(1);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Score cards without an episode too',
      }),
    );

    expect(card().allowMissingEpisode).toBe(true);
    expect(marks().skipped).toEqual([]);
    expect(
      screen.getByText('Cards without an episode get a score too.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Skip them instead' }));

    expect(card().allowMissingEpisode).toBeUndefined();
  });

  it('names the count of cards without an episode, or "One card" without a name', () => {
    withMovie();
    document.querySelectorAll('span')[2].textContent = 'OVA';

    const { unmount } = renderCardPart(
      EpisodePart,
      cardSpec({ episode: { selector: 'span', steps: [turkishEpisode] } }),
    );

    expect(screen.getByRole('alert').textContent).toStartWith(
      '2 cards have no episode number',
    );

    unmount();
    episodeGrid([['', 'Film']]);
    renderCardPart(
      EpisodePart,
      cardSpec({ episode: { selector: 'span', steps: [turkishEpisode] } }),
    );

    expect(screen.getByRole('alert').textContent).toStartWith(
      'One card has no episode number',
    );
  });

  it('picks again, and edits the episode and season under Advanced', async () => {
    const cards = episodeGrid();
    const { card, willPick } = renderCardPart(
      EpisodePart,
      cardSpec({ episode: { selector: 'h3' } }),
      { advanced: true },
    );

    willPick(cards[0].querySelector('span')!);
    fireEvent.click(screen.getByRole('button', { name: 'Pick again' }));
    await settle();

    expect(card().episode).toEqual({
      selector: 'span',
      steps: [turkishEpisode],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.click(screen.getAllByRole('button', { name: "Don't read" })[1]);

    expect(card().season).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: "Don't read" }));

    expect(card().episode).toBeUndefined();
  });
});

describe('episodeSummary', () => {
  it('says how many episodes it reads', () => {
    const cards = withMovie();
    const episode = { selector: 'span', steps: [turkishEpisode] };

    expect(episodeSummary(cardSpec(), cards)).toEqual({
      text: 'Not read',
      status: 'none',
    });
    expect(episodeSummary(cardSpec({ episode }), cards)).toEqual({
      text: 'Read on 2 of 3 cards',
      status: 'issue',
    });
    expect(
      episodeSummary(
        cardSpec({
          episode,
          season: { selector: 'span', steps: [turkishSeason] },
          allowMissingEpisode: true,
        }),
        cards,
      ),
    ).toEqual({ text: 'Read on 2 of 3 cards, with the season', status: 'ok' });
    expect(episodeSummary(cardSpec({ episode }), cards.slice(0, 1))).toEqual({
      text: 'Read on 1 of 1 card',
      status: 'ok',
    });
  });
});

describe('describeRead', () => {
  it('puts a read in words', () => {
    const element = document.createElement('div');

    expect(
      describeRead({ element, shown: '', episode: undefined, season: 2 }),
    ).toBe('Nothing, card skipped');
  });
});
