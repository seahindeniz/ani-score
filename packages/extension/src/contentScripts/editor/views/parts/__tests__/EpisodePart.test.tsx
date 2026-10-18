import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

import { cardSpec, episodeGrid, settle } from '../../__tests__/harness';
import {
  describeRead,
  EpisodePart,
  episodeSummary,
  SeasonPart,
  seasonSummary,
} from '../EpisodePart';
import { renderCardPart } from './render';

afterEach(cleanup);

const turkishEpisode = {
  match: '(\\d+)(?:[.,]\\d+)?\\s*\\.?\\s*B[öo]l[üu]m',
  flags: 'i',
};
const turkishSeason = { match: '(\\d+)\\s*\\.?\\s*Sezon', flags: 'i' };

const rows = () =>
  Array.from(screen.getAllByRole('row').slice(1), (row) =>
    Array.from(row.children, (cell) => cell.textContent),
  );
const radio = (name: RegExp) =>
  screen.getByRole('radio', { name }) as HTMLInputElement;

const withMovie = () =>
  episodeGrid([
    ['Sousou no Frieren', '12. Bölüm'],
    ['Suzume no Tojimari', 'Film'],
    ['Kusuriya no Hitorigoto', '2. Sezon 5. Bölüm'],
  ]);

describe('EpisodePart', () => {
  it('starts from where it found the episode, and shows what it reads', () => {
    const cards = episodeGrid();
    const { card, marks, pick } = renderCardPart(EpisodePart, cardSpec(), {
      autoPick: true,
    });

    expect(pick).not.toHaveBeenCalled();
    expect(card().episode).toEqual({
      selector: 'span',
      steps: [turkishEpisode],
    });
    expect(radio(/^Episode 12, on 5 of 5 cards/).checked).toBe(true);
    expect(radio(/^Episode 12/).parentElement!.textContent).toContain(
      'From “12. Bölüm”',
    );
    expect(
      screen.queryByRole('radio', { name: /shows no episode/ }),
    ).toBeNull();
    expect(screen.getByRole('status').textContent).toBe(
      'Read an episode on all 5 cards',
    );
    expect(rows()).toEqual([
      ['12. Bölüm', 'Episode 12'],
      ['7. Bölüm', 'Episode 7'],
      ['2. Sezon 5. Bölüm', 'Episode 5'],
    ]);
    expect(marks().part).toEqual(
      cards.map((element) => element.querySelector('span')!),
    );
  });

  it('waits for a pick when it finds no episode, and reads the first number there', async () => {
    const cards = episodeGrid([
      ['Frieren', '12'],
      ['Dandadan', '13'],
    ]);
    const { card, marks } = renderCardPart(
      EpisodePart,
      cardSpec(),
      { autoPick: true },
      [cards[0].querySelector('span')!],
    );

    expect(
      screen.getByText('Waiting for your click on an episode'),
    ).toBeTruthy();
    expect(marks().card).toHaveLength(2);

    await settle();

    expect(card().episode).toEqual({
      selector: 'span',
      steps: [{ match: '(\\d+)' }],
    });
    expect(radio(/Where you set it/).checked).toBe(true);
  });

  it('offers to pick when nothing is found or picked', async () => {
    const cards = episodeGrid([['Frieren', '12']]);
    const { card, willPick } = renderCardPart(EpisodePart, cardSpec());

    expect(
      screen.getByText('Pick the episode text in one of the outlined cards.'),
    ).toBeTruthy();

    willPick(cards[0].querySelector('span')!);
    fireEvent.click(screen.getByRole('button', { name: 'Pick on the page' }));
    await settle();

    expect(card().episode).toEqual({
      selector: 'span',
      steps: [{ match: '(\\d+)' }],
    });
  });

  it('reads an episode from an attribute, and picks another place', async () => {
    const cards = episodeGrid([['Frieren', '12. Bölüm']]);

    cards[0].dataset.episode = '7';

    const { card, willPick } = renderCardPart(
      EpisodePart,
      cardSpec({ episode: { source: { attr: 'data-episode' } } }),
    );

    expect(rows()).toEqual([['7', 'Episode 7']]);

    fireEvent.click(radio(/^Episode 12/));

    expect(card().episode).toEqual({
      selector: 'span',
      steps: [turkishEpisode],
    });

    willPick(undefined);
    fireEvent.click(
      screen.getByRole('button', { name: 'Pick it on the page' }),
    );

    expect(
      screen.getByRole('button', {
        name: 'Waiting for your click on an episode',
      }),
    ).toBeTruthy();

    await settle();

    expect(card().episode).toEqual({
      selector: 'span',
      steps: [turkishEpisode],
    });
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
    expect(rows()[1]).toEqual(['Film', 'No episode, still scored']);
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

  it('stops reading episodes, and edits them under Advanced', () => {
    episodeGrid();

    const { card } = renderCardPart(
      EpisodePart,
      cardSpec({ episode: { selector: 'span', steps: [turkishEpisode] } }),
      { advanced: true },
    );

    fireEvent.click(radio(/This site shows no episode numbers/));

    expect(card().episode).toBeUndefined();

    fireEvent.click(radio(/^Episode 12/));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.click(screen.getByRole('button', { name: "Don't read" }));

    expect(card().episode).toBeUndefined();
  });
});

describe('SeasonPart', () => {
  it('starts from where it found the season, which first seasons leave out', () => {
    episodeGrid();

    const { card } = renderCardPart(SeasonPart, cardSpec(), {
      autoPick: true,
    });

    expect(card().season).toEqual({
      selector: 'span',
      steps: [turkishSeason],
    });
    expect(radio(/^Season 2, on 2 of 5 cards/).checked).toBe(true);
    expect(screen.getByRole('status').textContent).toBe(
      'Read a season on 2 of 5 cards',
    );
    expect(rows()[0]).toEqual(['12. Bölüm', 'None, the first season']);
    expect(rows()[2]).toEqual(['2. Sezon 5. Bölüm', 'Season 2']);

    fireEvent.click(radio(/Cards don't show a season/));

    expect(card().season).toBeUndefined();
  });

  it('says when it finds no season, and lets the user pick one', async () => {
    const cards = episodeGrid([
      ['Frieren', '12. Bölüm'],
      ['Dandadan', '7. Bölüm'],
    ]);

    cards[0].querySelector('h3')!.textContent = 'Frieren 2';

    const { card, willPick } = renderCardPart(SeasonPart, cardSpec(), {
      autoPick: true,
    });

    expect(card().season).toBeUndefined();
    expect(
      screen.getByText(/AniScore found no season on these cards/),
    ).toBeTruthy();

    willPick(cards[0].querySelector('h3')!);
    fireEvent.click(
      screen.getByRole('button', { name: 'Pick it on the page' }),
    );
    await settle();

    expect(card().season).toEqual({
      selector: 'h3',
      steps: [{ match: '(\\d+)' }],
    });
    expect(screen.getByRole('status').textContent).toBe(
      'Read a season on 1 of 2 cards',
    );
  });
});

describe('summaries', () => {
  it('say how many episodes and seasons they read', () => {
    const cards = withMovie();
    const episode = { selector: 'span', steps: [turkishEpisode] };
    const season = { selector: 'span', steps: [turkishSeason] };

    expect(episodeSummary(cardSpec(), cards)).toEqual({
      text: 'Not read',
      status: 'none',
    });
    expect(episodeSummary(cardSpec({ episode }), cards)).toEqual({
      text: 'Read on 2 of 3 cards',
      status: 'issue',
    });
    expect(
      episodeSummary(cardSpec({ episode, allowMissingEpisode: true }), cards),
    ).toEqual({ text: 'Read on 2 of 3 cards', status: 'ok' });
    expect(episodeSummary(cardSpec({ episode }), cards.slice(0, 1))).toEqual({
      text: 'Read on 1 of 1 card',
      status: 'ok',
    });

    expect(seasonSummary(cardSpec(), cards)).toEqual({
      text: 'Not read',
      status: 'none',
    });
    expect(seasonSummary(cardSpec({ season }), cards)).toEqual({
      text: 'Read on 1 of 3 cards',
      status: 'ok',
    });
    expect(seasonSummary(cardSpec({ season }), cards.slice(0, 1))).toEqual({
      text: 'No season on this page',
      status: 'none',
    });
  });

  it('put a read in words', () => {
    expect(describeRead('episode', undefined)).toBe('Nothing, card skipped');
    expect(describeRead('season', 3)).toBe('Season 3');
  });
});
