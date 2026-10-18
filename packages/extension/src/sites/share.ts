import { matchPatternFormat } from './matchPattern';
import type { SiteConfig } from './schema';

const newIssueUrl = 'https://github.com/seahindeniz/ani-score/issues/new';

/**
 * GitHub answers longer links with "414 URI Too Long"; the exact limit isn't documented, so this stays well under it.
 */
export const maxIssueUrlLength = 8000;

export interface ShareLink {
  url: string;
  /**
   * The config didn't fit in the link: the user pastes it into the form.
   */
  pasteConfig: boolean;
}

/**
 * A link to the repository's "Site integration" issue form (`.github/ISSUE_TEMPLATE/site-integration.yml`), filled in
 * with the config. A maintainer reviews it, and labelling it approved opens a pull request that adds the site.
 */
export function shareLink(config: SiteConfig, pageUrl?: string): ShareLink {
  const host = matchPatternFormat
    .exec(config.matches[0] ?? '')?.[2]
    ?.replace(/^\*\.?/, '');
  const link = (withConfig: boolean) => {
    const url = new URL(newIssueUrl);

    url.searchParams.set('template', 'site-integration.yml');
    url.searchParams.set('title', `Site: ${config.name}`);
    url.searchParams.set(
      'site-url',
      pageUrl ?? (host ? `https://${host}/` : ''),
    );

    if (withConfig) {
      url.searchParams.set('config', JSON.stringify(config, null, 2));
    }

    return url.toString();
  };
  const full = link(true);

  return full.length <= maxIssueUrlLength
    ? { url: full, pasteConfig: false }
    : { url: link(false), pasteConfig: true };
}
