import { describe, expect, test } from 'bun:test';

import type { AnimeData } from '~/logic';

import { buildAnimeIndex, readAnimeIndex } from '../animeIndex';

function entry(title: string, synonyms: string[] = [], id = 1) {
  return {
    title,
    type: 'TV',
    sources: [`https://anilist.co/anime/${id}`],
    synonyms,
  } as AnimeData;
}

/**
 * The index as read back from storage.
 */
const storedIndex = (data: AnimeData[]) =>
  readAnimeIndex(buildAnimeIndex(data).stored);

const titles = (matches: { title: string }[]) =>
  matches.map(({ title }) => title);

describe('anime index', () => {
  test('finds entries by any word of their title or synonyms', () => {
    const index = storedIndex([
      entry('Sousou no Frieren', ["Frieren: Beyond Journey's End"]),
      entry('Kusuriya no Hitorigoto'),
    ]);

    expect(titles(index.search('beyond', 10))).toEqual(['Sousou no Frieren']);
    // Case and punctuation don't count
    expect(titles(index.search('FRIEREN!', 10))).toEqual(['Sousou no Frieren']);
    expect(index.search('Unknown', 10)).toEqual([]);
  });

  test('ranks entries sharing rarer words first, and returns at most the limit', () => {
    const index = storedIndex([
      entry('Boku no Hero Academia'),
      entry('Kimi no Na wa'),
      entry('Tonari no Totoro'),
      entry('Kimi ni Todoke'),
    ]);

    expect(titles(index.search('Kimi no Na wa', 2))).toEqual([
      'Kimi no Na wa',
      'Kimi ni Todoke',
    ]);
  });

  test('ranks the shorter title first among entries sharing the same words', () => {
    const index = storedIndex([
      entry('Detective Conan Movie 01: The Timed Skyscraper'),
      entry('Detective Conan: The Culprit Hanzawa'),
      entry('Detective Conan'),
    ]);

    expect(titles(index.search('Detective Conan', 1))).toEqual([
      'Detective Conan',
    ]);
  });

  test('searches the same right after building as when read back', () => {
    const data = [entry('Sousou no Frieren'), entry('Kusuriya no Hitorigoto')];

    expect(buildAnimeIndex(data).index.search('no', 10)).toEqual(
      storedIndex(data).search('no', 10),
    );
  });

  test('keeps only entries and sources that AniList can be asked about', () => {
    const index = storedIndex([
      {
        ...entry('Sousou no Frieren'),
        sources: [
          'https://kitsu.app/anime/46474',
          'https://myanimelist.net/anime/52991',
          'https://anilist.co/anime/154587',
        ],
      },
      { ...entry('Kitsu Only Anime'), sources: ['https://kitsu.app/anime/1'] },
    ]);

    expect(index.search('Sousou no Frieren', 10)).toEqual([
      {
        title: 'Sousou no Frieren',
        type: 'TV',
        sources: [
          'https://myanimelist.net/anime/52991',
          'https://anilist.co/anime/154587',
        ],
        synonyms: [],
      },
    ]);
    expect(index.search('Kitsu Only Anime', 10)).toEqual([]);
  });

  test('lists an entry once for a word its title and synonyms share', () => {
    const index = storedIndex([
      entry('Frieren', ['Frieren', 'Sousou no Frieren']),
    ]);

    expect(index.search('Frieren', 10)).toHaveLength(1);
  });

  test('indexes an entry without synonyms', () => {
    const { synonyms: _, ...withoutSynonyms } = entry('Sousou no Frieren');

    expect(
      titles(storedIndex([withoutSynonyms as AnimeData]).search('Frieren', 10)),
    ).toEqual(['Sousou no Frieren']);
  });

  test('refuses a stored index of the wrong shape', () => {
    const { stored } = buildAnimeIndex([entry('Sousou no Frieren')]);

    expect(() =>
      readAnimeIndex({ ...stored, offsets: new ArrayBuffer(4) }),
    ).toThrow('malformed');
    expect(() =>
      readAnimeIndex({ ...stored, postings: new ArrayBuffer(0) }),
    ).toThrow('malformed');
    expect(() => readAnimeIndex({ ...stored, entries: '{}' })).toThrow(
      'malformed',
    );
  });

  test('can be empty', () => {
    expect(storedIndex([]).search('Frieren', 10)).toEqual([]);
    expect(buildAnimeIndex([]).index.search('Frieren', 10)).toEqual([]);
  });
});
