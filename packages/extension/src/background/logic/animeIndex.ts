import type { AnimeData, AnimeMatch } from '~/logic/animeData';

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

/**
 * An index ready to search, with the form to store it in.
 */
export interface BuiltAnimeIndex {
  index: AnimeIndex;
  stored: AnimeIndexData;
}

// MiniSearch's default tokenizer, which the index used to be built with
const termSeparator = /[\n\r\p{Z}\p{P}]+/u;

function termsOf(text: string) {
  return text
    .split(termSeparator)
    .filter(Boolean)
    .map((term) => term.toLowerCase());
}

/**
 * The version of the stored and the published form: a stored index of another version is downloaded again, and an
 * extension only fetches the prebuilt index of its own version. Bump it whenever the tokenizer, the entry fields, the
 * layout or the file packing changes.
 */
export const animeIndexFormat = 1;

const fileHeaderSize = 16;

/**
 * Packs the stored index into one file, as the site publishes it prebuilt: the byte lengths of the four parts as
 * little-endian `uint32`s, then the entries and the terms as UTF-8, then the offsets and the postings.
 */
export function packAnimeIndex(
  stored: AnimeIndexData,
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const parts = [
    encoder.encode(stored.entries),
    encoder.encode(stored.terms),
    new Uint8Array(stored.offsets),
    new Uint8Array(stored.postings),
  ];
  const file = new Uint8Array(
    parts.reduce((size, part) => size + part.byteLength, fileHeaderSize),
  );
  const header = new DataView(file.buffer);
  let position = fileHeaderSize;

  parts.forEach((part, index) => {
    header.setUint32(index * 4, part.byteLength, true);
    file.set(part, position);
    position += part.byteLength;
  });

  return file;
}

/**
 * Throws for a file whose parts don't add up, e.g. a truncated download.
 */
export function unpackAnimeIndex(file: ArrayBuffer): AnimeIndexData {
  const header = new DataView(file);
  const lengths =
    file.byteLength < fileHeaderSize
      ? []
      : [0, 1, 2, 3].map((index) => header.getUint32(index * 4, true));

  if (
    lengths.reduce((size, length) => size + length, fileHeaderSize)
    !== file.byteLength
  ) {
    throw new TypeError('The anime index file is malformed');
  }

  const decoder = new TextDecoder();
  let position = fileHeaderSize;
  const take = (length: number) => file.slice(position, (position += length));

  return {
    entries: decoder.decode(take(lengths[0])),
    terms: decoder.decode(take(lengths[1])),
    offsets: take(lengths[2]),
    postings: take(lengths[3]),
  };
}

/**
 * Hosts of the sites whose IDs AniList can be asked about: its own, and MyAnimeList's.
 */
export const listSiteHosts = {
  anilist: 'anilist.co',
  mal: 'myanimelist.net',
} as const;

const isListSource = (source: string) =>
  source.includes(listSiteHosts.anilist) || source.includes(listSiteHosts.mal);

/**
 * Indexes the entries with an AniList or MyAnimeList source. Gives the index to search right away, and the form to
 * store it in.
 */
export function buildAnimeIndex(data: AnimeData[]): BuiltAnimeIndex {
  const entries: AnimeMatch[] = [];
  const positionsByTerm = new Map<string, number[]>();

  // The schema lists synonyms for every entry, but a missing list shouldn't drop the whole download
  for (const { title, type, synonyms = [], sources } of data) {
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

/**
 * Throws for an index of the wrong shape, which is then downloaded again rather than searched.
 */
export function readAnimeIndex(data: AnimeIndexData) {
  const entries = JSON.parse(data.entries) as AnimeMatch[];
  // An empty index has no terms, which joined make an empty string
  const terms = data.terms ? data.terms.split('\n') : [];
  const offsets = new Uint32Array(data.offsets);
  const postings = new Uint32Array(data.postings);

  if (
    !Array.isArray(entries)
    || offsets.length !== terms.length + 1
    || offsets[terms.length] !== postings.length
  ) {
    throw new TypeError('The stored anime index is malformed');
  }

  return createAnimeIndex(entries, terms, offsets, postings);
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
