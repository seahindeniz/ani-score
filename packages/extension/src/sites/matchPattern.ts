/**
 * The subset of extension match patterns a site config may use: `http`, `https` or `*` as the scheme, a host that is
 * `*`, an exact name or `*.` followed by a name, and a path that may contain `*` wildcards.
 *
 * @see https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
 */
export const matchPatternFormat =
  /^(\*|https?):\/\/(\*|(?:\*\.)?[^/*:]+)(\/.*)$/;

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function matchesPattern(pattern: string, url: URL) {
  const [, scheme, host, path] = matchPatternFormat.exec(pattern) ?? [];

  if (!scheme) return false;

  const schemeMatches =
    scheme === '*'
      ? url.protocol === 'http:' || url.protocol === 'https:'
      : url.protocol === `${scheme}:`;
  const hostMatches =
    host === '*'
    || url.hostname === host.replace(/^\*\./, '')
    || (host.startsWith('*.') && url.hostname.endsWith(host.slice(1)));
  const pathMatches = new RegExp(
    `^${path.split('*').map(escapeRegExp).join('.*')}$`,
  ).test(url.pathname + url.search);

  return schemeMatches && hostMatches && pathMatches;
}
