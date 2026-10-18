import { readField } from '~/contentScripts/sites/extract';
import type { SiteExtract, SiteStep } from '~/sites/schema';

import { relativeSelector } from './selectors';

/**
 * Finds where cards keep their name, episode and season, so the editor can suggest them. Sites often put several in
 * one text ("Ao Ashi 2.Sezon 3.Bölüm izle"), or the name in two places, so every element and attribute of a card is
 * tried, and the name is cut off where the season or episode starts.
 */

export type NumberKind = 'episode' | 'season';

interface NumberFormat {
  kind: NumberKind;
  /**
   * Finds the format in a text.
   */
  marker: string;
  /**
   * Keeps the number from it.
   */
  read: string;
  /**
   * Read from links (`/bolum-4`) rather than from text.
   */
  link?: boolean;
}

const sxe = 'S\\d+\\s*[-·]?\\s*E\\d+';

// Most specific first: "2. Sezon 5. Bölüm" holds two numbers, and each format reads its own
const formats: NumberFormat[] = [
  {
    kind: 'season',
    marker: '\\d+\\s*\\.?\\s*Sezon',
    read: '(\\d+)\\s*\\.?\\s*Sezon',
  },
  { kind: 'season', marker: 'Sezon\\s*\\d+', read: 'Sezon\\s*(\\d+)' },
  {
    kind: 'season',
    marker: '\\d+(?:st|nd|rd|th)\\s+Season',
    read: '(\\d+)(?:st|nd|rd|th)\\s+Season',
  },
  { kind: 'season', marker: 'Season\\s*\\d+', read: 'Season\\s*(\\d+)' },
  { kind: 'season', marker: sxe, read: 'S(\\d+)\\s*[-·]?\\s*E\\d' },
  {
    kind: 'episode',
    marker: '\\d+(?:[.,]\\d+)?\\s*\\.?\\s*B[öo]l[üu]m',
    read: '(\\d+)(?:[.,]\\d+)?\\s*\\.?\\s*B[öo]l[üu]m',
  },
  {
    kind: 'episode',
    marker: 'B[öo]l[üu]m\\s*\\d+',
    read: 'B[öo]l[üu]m\\s*(\\d+)',
  },
  {
    kind: 'episode',
    marker: '(?:Episode|Ep\\.?)\\s*\\d+',
    read: '(?:Episode|Ep\\.?)\\s*(\\d+)',
  },
  { kind: 'episode', marker: sxe, read: 'S\\d+\\s*[-·]?\\s*E(\\d+)' },
  {
    kind: 'episode',
    marker: '(?:bolum|episode|ep)[-/_]?\\d+',
    read: '(?:bolum|episode|ep)[-/_]?(\\d+)',
    link: true,
  },
  {
    kind: 'season',
    marker: '(?:sezon|season)[-/_]?\\d+',
    read: '(?:sezon|season)[-/_]?(\\d+)',
    link: true,
  },
];

// Words around the name that aren't part of it ("Frieren 5. Bölüm izle"), only as whole words
const extras =
  '(?<![^\\s,:|–-])(?:izle|türkçe altyazılı|türkçe|altyazılı|dublaj)(?![^\\s,:|–-])';

const textMarkers = [
  ...new Set(
    formats.filter((format) => !format.link).map((format) => format.marker),
  ),
];

const test = (pattern: string, text: string) =>
  new RegExp(pattern, 'i').test(text);

/**
 * Whether a text holds more than a name: a season, an episode, or words like "izle".
 */
export const holdsMore = (text: string) =>
  [...textMarkers, extras].some((pattern) => test(pattern, text));

/**
 * Whether a text is the same words twice, as when a card shows the name in two elements (whose texts join without a
 * space).
 */
export const isRepeated = (text: string) => /^(.{3,}?)\s*\1$/.test(text);

/**
 * The step that keeps the name from texts like the given ones: what comes before the first season, episode or extra
 * word they have. `undefined` when they're names already.
 */
export function nameSteps(texts: string[]): SiteStep[] | undefined {
  const used = [...textMarkers, extras].filter((pattern) =>
    texts.some((text) => test(pattern, text)),
  );

  if (!used.length) return undefined;

  return [{ match: `^(.*?)[\\s,:|–-]*(?:${used.join('|')}|$)`, flags: 'i' }];
}

type Location = Pick<SiteExtract, 'selector' | 'source'>;

const skipped = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'path',
  'use',
  'source',
]);
const attributes = ['title', 'alt', 'aria-label', 'href'];

/**
 * Every place in a card a value could come from: each element's text, and its attributes that hold words.
 */
function locations(card: Element): Location[] {
  const elements = [card, ...card.querySelectorAll('*')]
    .filter(
      (element) =>
        !skipped.has(element.localName)
        && !element.closest(`.${__NAME__}, svg`),
    )
    .slice(0, 300);

  return elements.flatMap((element) => {
    const selector =
      element === card ? undefined : relativeSelector(card, element);

    return [
      { selector },
      ...attributes
        .filter((name) => element.getAttribute(name)?.trim())
        .map((attr) => ({ selector, source: { attr } })),
    ];
  });
}

export interface Candidate {
  extract: SiteExtract;
  /**
   * What it reads from each card, empty where it reads nothing.
   */
  reads: string[];
  /**
   * The text it reads from on each card.
   */
  shown: string[];
}

const isLink = (location: Location) =>
  typeof location.source === 'object' && location.source.attr === 'href';

const first = (values: string[]) => values.find(Boolean) ?? '';

const hits = (candidate: Candidate) => candidate.reads.filter(Boolean).length;

// What the user can see on the page comes before attributes
const isAttribute = (candidate: Candidate) =>
  typeof candidate.extract.source === 'object' ? 1 : 0;

/**
 * The candidates in the order of their ranks (compared like words), keeping the first of those that read the same on
 * every card: they're one suggestion.
 */
function distinct(
  candidates: Candidate[],
  rank: (candidate: Candidate) => number[],
) {
  const seen = new Set<string>();

  return candidates
    .map((candidate) => ({ candidate, order: rank(candidate) }))
    .sort((a, b) => {
      const at = a.order.findIndex((value, index) => value !== b.order[index]);

      return at === -1 ? 0 : a.order[at] - b.order[at];
    })
    .flatMap(({ candidate }) => {
      const key = JSON.stringify(candidate.reads);

      if (seen.has(key)) return [];

      seen.add(key);

      return [candidate];
    });
}

// Enough cards to see a pattern, few enough to stay quick on long lists
const sample = (cards: Element[]) => cards.slice(0, 12);

function readNumber(card: Element, extract: SiteExtract) {
  const number = Number.parseInt(readField(card, extract));

  return Number.isNaN(number) ? '' : String(number);
}

/**
 * The steps that read the most numbers of the kind from a place in the cards, or `undefined` when none reads one.
 */
export function numberSteps(
  cards: Element[],
  location: Location,
  kind: NumberKind,
): SiteStep[] | undefined {
  let best: { steps: SiteStep[]; count: number } | undefined;

  for (const format of formats) {
    if (format.kind !== kind || Boolean(format.link) !== isLink(location)) {
      continue;
    }

    const steps = [{ match: format.read, flags: 'i' }];
    const count = sample(cards).filter((card) =>
      readNumber(card, { ...location, steps }),
    ).length;

    if (count > (best?.count ?? 0)) best = { steps, count };
  }

  return best?.steps;
}

/**
 * Where the cards show their episode or season number, the best first: those that read it on the most cards, then
 * those from the least text.
 */
export function numberCandidates(cards: Element[], kind: NumberKind) {
  const some = sample(cards);

  if (!some.length) return [];

  const found = locations(some[0]).flatMap((location) => {
    const steps = numberSteps(some, location, kind);

    if (!steps) return [];

    const extract = { ...location, steps };

    return [
      {
        extract,
        reads: some.map((card) => readNumber(card, extract)),
        shown: some.map((card) => readField(card, location)),
      },
    ];
  });

  return distinct(found, (candidate) => [
    -hits(candidate),
    isAttribute(candidate),
    first(candidate.shown).length,
  ]).slice(0, 4);
}

const isName = (text: string) => /\p{L}.*\p{L}/u.test(text);

/**
 * Where the cards show the anime's name alone, the best first. A name shows on most cards, differs between them, and
 * is cut where a season or episode starts. Places inside `anchor` (the element the user picked) come first. A place
 * that reads a name twice holds two elements' texts, so it isn't one.
 */
export function nameCandidates(cards: Element[], anchor?: string) {
  const some = sample(cards);

  if (!some.length) return [];

  const card = some[0];
  const anchorElement = anchor ? card.querySelector(anchor) : card;
  const enough = Math.ceil(some.length * 0.6);
  const found = locations(card).flatMap((location) => {
    if (isLink(location)) return [];

    const shown = some.map((item) => readField(item, location));
    const steps = nameSteps(shown);
    const extract = steps ? { ...location, steps } : location;
    const reads = steps ? some.map((item) => readField(item, extract)) : shown;
    const names = reads.filter(isName);

    // A label like "New" reads the same on every card
    if (
      names.length < enough
      || reads.some(isRepeated)
      || (some.length > 1 && new Set(reads).size === 1)
    ) {
      return [];
    }

    return [{ extract, reads, shown }];
  });

  const inAnchor = (candidate: Candidate) => {
    const { selector } = candidate.extract;
    const element = selector ? card.querySelector(selector) : card;

    return element != null && anchorElement?.contains(element) === true;
  };
  return distinct(found, (candidate) => [
    inAnchor(candidate) ? 0 : 1,
    -hits(candidate),
    isAttribute(candidate),
    first(candidate.shown).length,
  ]).slice(0, 3);
}

/**
 * Where a suggestion comes from, in words: the text it reads, and the attribute when it's one.
 */
export function describeSource(candidate: Candidate) {
  const text = first(candidate.shown);
  const quoted = `“${text.length > 64 ? `${text.slice(0, 63)}…` : text}”`;
  const { source } = candidate.extract;

  if (typeof source !== 'object') return `From ${quoted}`;

  const where: Record<string, string> = {
    title: 'its tooltip',
    alt: "the image's description",
    'aria-label': 'its label',
    href: 'the link',
  };

  return `From ${where[source.attr]}, ${quoted}`;
}
