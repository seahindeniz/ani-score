import type { AnimeData, AnimeMatch } from '~/logic';

/**
 * The anime database as stored: the entries, and for each term the entries whose title or synonyms contain it.
 * IndexedDB hands strings and array buffers back without rebuilding objects one by one, so this loads in about a
 * tenth of a second, where a serialized MiniSearch index took seconds.
 */
export interface AnimeIndexData {
  /**
   * JSON array of `AnimeMatch`.
   */
  entries: string;
  /**
   * Sorted terms, separated by line breaks (a term never contains one).
   */
  terms: string;
  /**
   * `Uint32Array`: where the entries of each term start in `postings`, followed by the end of the last term's.
   */
  offsets: ArrayBuffer;
  /**
   * `Uint32Array`: positions in `entries`, grouped by term.
   */
  postings: ArrayBuffer;
}

export interface AnimeIndex {
  /**
   * Entries sharing a term with the title, those sharing the rarest terms first.
   */
  search: (title: string, limit: number) => AnimeMatch[];
}

// MiniSearch's default tokenizer, which the index used to be built with
const termSeparator = /[\n\r\p{Z}\p{P}]+/u;

function termsOf(text: string) {
  return text
    .split(termSeparator)
    .filter(Boolean)
    .map((term) => term.toLowerCase());
}

// Matches are looked up on AniList, by its own ID or the MyAnimeList one
const isListSource = (source: string) =>
  source.includes('anilist.co') || source.includes('myanimelist.net');

/**
 * Indexes the entries with an AniList or MyAnimeList source. Gives the index to search right away, and the form to
 * store it in.
 */
export function buildAnimeIndex(data: AnimeData[]) {
  const entries: AnimeMatch[] = [];
  const positionsByTerm = new Map<string, number[]>();

  for (const { title, type, synonyms, sources } of data) {
    const listSources = sources.filter(isListSource);

    if (!listSources.length) continue;

    const position =
      entries.push({ title, type, synonyms, sources: listSources }) - 1;

    for (const term of [title, ...synonyms].flatMap(termsOf)) {
      const positions = positionsByTerm.get(term);

      if (!positions) positionsByTerm.set(term, [position]);
      else if (positions.at(-1) !== position) positions.push(position);
    }
  }

  const terms = [...positionsByTerm.keys()].sort();
  const offsets = new Uint32Array(terms.length + 1);

  terms.forEach((term, index) => {
    offsets[index + 1] = offsets[index] + positionsByTerm.get(term)!.length;
  });

  const postings = new Uint32Array(offsets[terms.length]);

  terms.forEach((term, index) => {
    postings.set(positionsByTerm.get(term)!, offsets[index]);
  });

  const stored: AnimeIndexData = {
    entries: JSON.stringify(entries),
    terms: terms.join('\n'),
    offsets: offsets.buffer,
    postings: postings.buffer,
  };

  return {
    stored,
    index: createAnimeIndex(entries, terms, offsets, postings),
  };
}

export function readAnimeIndex(data: AnimeIndexData) {
  return createAnimeIndex(
    JSON.parse(data.entries) as AnimeMatch[],
    data.terms.split('\n'),
    new Uint32Array(data.offsets),
    new Uint32Array(data.postings),
  );
}

function createAnimeIndex(
  entries: AnimeMatch[],
  terms: string[],
  offsets: Uint32Array,
  postings: Uint32Array,
): AnimeIndex {
  function findTerm(term: string) {
    let low = 0;
    let high = terms.length - 1;

    while (low <= high) {
      const middle = (low + high) >>> 1;

      if (terms[middle] === term) return middle;
      if (terms[middle] < term) low = middle + 1;
      else high = middle - 1;
    }

    return -1;
  }

  return {
    search(title, limit) {
      const scores = new Map<number, number>();

      for (const term of new Set(termsOf(title))) {
        const index = findTerm(term);

        if (index === -1) continue;

        const start = offsets[index];
        const end = offsets[index + 1];
        // A term few entries share says more about which one is meant than a common word like "no"
        const weight = Math.log(1 + entries.length / (end - start));

        for (let posting = start; posting < end; posting++) {
          const position = postings[posting];

          scores.set(position, (scores.get(position) ?? 0) + weight);
        }
      }

      return (
        [...scores]
          // Of entries sharing the same words, a series has a shorter title than its movies and specials
          .sort(
            ([a, aScore], [b, bScore]) =>
              bScore - aScore
              || entries[a].title.length - entries[b].title.length,
          )
          .slice(0, limit)
          .map(([position]) => entries[position])
      );
    },
  };
}
