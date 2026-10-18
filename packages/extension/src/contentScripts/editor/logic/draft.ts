import type { SiteCard, SiteConfig, SitePage } from '~/sites/schema';
import { currentSchemaVersion } from '~/sites/schema';

import { suggestPathPattern } from './selectors';

export const newCard = (): SiteCard => ({
  selector: '',
  title: {},
  inject: { position: 'append' },
});

export const newPage = (pathname: string): SitePage => ({
  match: { path: suggestPathPattern(pathname) },
  cards: [newCard()],
});

/**
 * An id from the site's name: `www.openani.me` → `openani`.
 */
export function idFromHost(hostname: string) {
  const labels = hostname.replace(/^www\./, '').split('.');
  const name = labels.length > 1 ? labels.slice(0, -1).join('-') : labels[0];

  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A config to start from on a site no config covers yet: just the current page, with one card type to fill in.
 */
export function newDraft(location: Pick<Location, 'hostname' | 'pathname'>) {
  const id = idFromHost(location.hostname);

  return {
    schemaVersion: currentSchemaVersion,
    id,
    name: id ? `${id[0].toUpperCase()}${id.slice(1)}` : location.hostname,
    matches: [`*://${location.hostname}/*`],
    pages: [newPage(location.pathname)],
  } satisfies SiteConfig;
}
