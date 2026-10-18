import { presets } from '~/sites/presets';
import type {
  SiteCard,
  SiteExtract,
  SiteField,
  SitePage,
  SiteStep,
} from '~/sites/schema';

import type { EpisodeCard } from './types';

const regExps = new Map<string, RegExp>();

// Cards are read again on every change to the page, so each expression is compiled once
function regExp(source: string, flags = '') {
  const key = `${flags}/${source}`;
  let compiled = regExps.get(key);

  if (!compiled) {
    compiled = new RegExp(source, flags);
    regExps.set(key, compiled);
  }

  return compiled;
}

function readSource(element: Element, source: SiteExtract['source'] = 'text') {
  if (source === 'text') return element.textContent;

  if (source === 'ownText') {
    return Array.from(element.childNodes, (node) =>
      node.nodeType === Node.TEXT_NODE ? node.textContent : '',
    ).join('');
  }

  return element.getAttribute(source.attr) ?? '';
}

function applyStep(value: string, step: SiteStep) {
  if ('match' in step) {
    return regExp(step.match, step.flags).exec(value)?.[step.group ?? 1] ?? '';
  }

  if ('replace' in step) {
    return value.replace(
      regExp(step.replace, `g${step.flags ?? ''}`),
      step.with,
    );
  }

  return presets[step.preset](value);
}

// Whitespace is collapsed, so markup indentation doesn't leak into titles and expressions can rely on single spaces
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

function readExtract(card: Element, extract: SiteExtract) {
  const element = extract.selector
    ? card.querySelector(extract.selector)
    : card;

  if (!element) return '';

  return normalize(
    (extract.steps ?? []).reduce(
      (value, step) => normalize(applyStep(value, step)),
      normalize(readSource(element, extract.source)),
    ),
  );
}

/**
 * The first non-empty value among the field's extractions.
 */
export function readField(card: Element, field: SiteField) {
  for (const extract of Array.isArray(field) ? field : [field]) {
    const value = readExtract(card, extract);

    if (value) return value;
  }

  return '';
}

function parseNumber(text: string) {
  const number = Number.parseInt(text);

  return Number.isNaN(number) ? undefined : number;
}

export const toQueryTitle = (title: string, season?: number) =>
  season != null && season > 1 ? `${title} Season ${season}` : title;

/**
 * Reads a card, or returns `undefined` when it lacks a title, its declared episode number, or the element to inject
 * the details at.
 */
export function readCard(
  element: HTMLElement,
  spec: SiteCard,
): EpisodeCard | undefined {
  const title = readField(element, spec.title);
  const episodeNumber = spec.episode
    ? parseNumber(readField(element, spec.episode))
    : undefined;
  const season = spec.season
    ? parseNumber(readField(element, spec.season))
    : undefined;
  const anchor = spec.inject.selector
    ? element.querySelector(spec.inject.selector)
    : element;

  if (!title || (spec.episode && episodeNumber == null) || !anchor) {
    return undefined;
  }

  return {
    element,
    title: toQueryTitle(title, season),
    episodeNumber,
    render: (container) => anchor[spec.inject.position](container),
    shimmeringElement: spec.shimmer
      ? spec.shimmer.selector
        ? element.querySelector<HTMLElement>(spec.shimmer.selector)
        : element
      : null,
  };
}

export function pageMatches(page: SitePage, location: Location) {
  const { path, search, selector } = page.match;

  return (
    (!path || regExp(path).test(location.pathname))
    && (!search || regExp(search).test(location.search))
    && (!selector || document.querySelector(selector) != null)
  );
}

/**
 * The readable cards of the given pages. A card only counts once, for the first card type that reads it.
 */
export function collectCards(pages: SitePage[]) {
  const cards = new Map<HTMLElement, EpisodeCard>();

  for (const spec of pages.flatMap((page) => page.cards)) {
    for (const element of document.querySelectorAll<HTMLElement>(
      spec.selector,
    )) {
      if (
        cards.has(element)
        // Also skips cards inside excluded elements, such as a carousel's cloned slides
        || (spec.exclude && element.closest(spec.exclude))
        || (spec.has && !element.querySelector(spec.has))
      ) {
        continue;
      }

      const card = readCard(element, spec);

      if (card) cards.set(element, card);
    }
  }

  return Array.from(cards.values());
}
