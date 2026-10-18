import { describe, expect, it } from 'bun:test';

import {
  describeSource,
  holdsMore,
  isRepeated,
  nameCandidates,
  nameSteps,
  numberCandidates,
  numberSteps,
} from '../analyze';

// Cards like the ones whose whole title line went to AniList: the name (with its season) in one element, and the
// name again with the season and the episode in the next, and the episode in the link
const mixedCards = (
  entries: [name: string, season: string, episode: string][] = [
    ['Tensei Kizoku, Kantei Skill de Nariagaru', '3.Sezon', '4.Bölüm izle'],
    ['Shinja Zero no Megami-sama', '', '2.Bölüm izle'],
    ['Vertex Force', '', '3.Bölüm Türkçe'],
    ['Ao Ashi', '2.Sezon', '3.Bölüm izle'],
  ],
) => {
  document.body.innerHTML = entries
    .map(([name, season, episode]) => {
      const full = [name, season].filter(Boolean).join(' ');

      return `<div class="item"><a href="/izle/x-bolum-${/\d+/.exec(episode)![0]}"><img alt="${full}"></a><div class="info"><b>${full}</b><small>${full} ${episode}</small></div></div>`;
    })
    .join('');

  return Array.from(document.querySelectorAll('.item'));
};

describe('holdsMore', () => {
  it('finds a season, an episode or extra words in a text', () => {
    expect(holdsMore('Ao Ashi 2.Sezon')).toBe(true);
    expect(holdsMore('Frieren Episode 5')).toBe(true);
    expect(holdsMore('Vertex Force izle')).toBe(true);
    expect(holdsMore('Frieren S2E5')).toBe(true);
    expect(holdsMore('Kizler')).toBe(false);
    expect(holdsMore('Sousou no Frieren')).toBe(false);
  });
});

describe('isRepeated', () => {
  it('finds a text that is the same words twice', () => {
    expect(isRepeated('Vertex Force Vertex Force')).toBe(true);
    expect(isRepeated('Vertex ForceVertex Force')).toBe(true);
    expect(isRepeated('Vertex Force')).toBe(false);
    expect(isRepeated('Ao Ao')).toBe(false);
  });
});

describe('nameSteps', () => {
  it('keeps what comes before the season, the episode or extra words', () => {
    const [step] = nameSteps(['Ao Ashi 2.Sezon 3.Bölüm izle', 'Frieren'])!;
    const name = (text: string) =>
      new RegExp((step as { match: string }).match, 'i').exec(text)![1];

    expect(name('Ao Ashi 2.Sezon 3.Bölüm izle')).toBe('Ao Ashi');
    expect(name('Frieren - 12. Bölüm')).toBe('Frieren');
    expect(name('Frieren')).toBe('Frieren');
    expect(nameSteps(['Ao Ashi', 'Frieren'])).toBeUndefined();
  });
});

describe('nameCandidates', () => {
  it('suggests the name alone, from the picked text first, never a name twice', () => {
    const cards = mixedCards();
    const [best, ...others] = nameCandidates(cards, 'small');

    expect(best.extract.selector).toBe('small');
    expect(best.reads).toEqual([
      'Tensei Kizoku, Kantei Skill de Nariagaru',
      'Shinja Zero no Megami-sama',
      'Vertex Force',
      'Ao Ashi',
    ]);
    // The whole card reads the name twice on the cards without a season
    expect(
      others.every((candidate) => candidate.extract.selector !== undefined),
    ).toBe(true);
  });

  it('prefers what shows on the page over attributes, and leaves out labels', () => {
    document.body.innerHTML = ['Frieren', 'Dandadan', 'Ao Ashi']
      .map(
        (name) =>
          `<div class="item"><img alt="${name}"><h3>${name}</h3><span class="badge">Yeni</span></div>`,
      )
      .join('');

    const candidates = nameCandidates(
      Array.from(document.querySelectorAll('.item')),
    );

    // The image says the same as the heading, which shows on the page
    expect(candidates[0].extract).toEqual({ selector: 'h3' });
    expect(
      candidates.some(
        (candidate) => candidate.extract.selector === 'span.badge',
      ),
    ).toBe(false);
    expect(nameCandidates([])).toEqual([]);
  });
});

describe('numberCandidates', () => {
  it('finds the episode and the season, each where it reads best', () => {
    const cards = mixedCards();
    const [episode] = numberCandidates(cards, 'episode');
    const [season] = numberCandidates(cards, 'season');

    expect(episode).toMatchObject({
      extract: { selector: 'small' },
      reads: ['4', '2', '3', '3'],
    });
    expect(season).toMatchObject({
      extract: { selector: 'b' },
      reads: ['3', '', '', '2'],
    });
    expect(numberCandidates([], 'episode')).toEqual([]);
  });

  it('reads the episode from the link when nothing else has it', () => {
    document.body.innerHTML = [4, 7]
      .map(
        (episode) =>
          `<div class="item"><a href="/watch/frieren/episode-${episode}">Frieren</a></div>`,
      )
      .join('');

    expect(
      numberCandidates(
        Array.from(document.querySelectorAll('.item')),
        'episode',
      ),
    ).toMatchObject([
      {
        extract: { selector: 'a', source: { attr: 'href' } },
        reads: ['4', '7'],
      },
    ]);
  });
});

describe('numberSteps', () => {
  it('reads the number in the format the place has', () => {
    const cards = mixedCards();

    expect(numberSteps(cards, { selector: 'small' }, 'episode')).toEqual([
      { match: '(\\d+)(?:[.,]\\d+)?\\s*\\.?\\s*B[öo]l[üu]m', flags: 'i' },
    ]);
    expect(numberSteps(cards, { selector: 'b' }, 'episode')).toBeUndefined();
  });
});

describe('describeSource', () => {
  it('says where a suggestion reads from', () => {
    const text = 'x'.repeat(70);

    expect(
      describeSource({ extract: {}, reads: [], shown: ['', 'Frieren'] }),
    ).toBe('From “Frieren”');
    expect(describeSource({ extract: {}, reads: [], shown: [text] })).toBe(
      `From “${'x'.repeat(63)}…”`,
    );
    expect(
      describeSource({
        extract: { source: { attr: 'alt' } },
        reads: [],
        shown: ['Frieren'],
      }),
    ).toBe("From the image's description, “Frieren”");
  });
});
