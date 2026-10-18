import { describe, expect, it } from 'bun:test';

import { matchesPattern } from '../matchPattern';

const matches = (pattern: string, url: string) =>
  matchesPattern(pattern, new URL(url));

describe('matchesPattern', () => {
  it('matches the scheme, host and path', () => {
    expect(matches('*://anizm.net/*', 'https://anizm.net/yeniler')).toBe(true);
    expect(matches('*://anizm.net/*', 'http://anizm.net/')).toBe(true);
    expect(matches('https://anizm.net/*', 'http://anizm.net/')).toBe(false);
    expect(matches('*://anizm.net/*', 'https://www.anizm.net/')).toBe(false);
    expect(matches('*://anizm.net/*', 'ftp://anizm.net/')).toBe(false);
  });

  it('matches only the given path, including the query', () => {
    expect(matches('*://anizm.net/', 'https://anizm.net/')).toBe(true);
    expect(matches('*://anizm.net/', 'https://anizm.net/yeniler')).toBe(false);
    expect(
      matches('*://example.com/list?page=*', 'https://example.com/list?page=2'),
    ).toBe(true);
  });

  it('matches subdomains and any host', () => {
    expect(matches('*://*.example.com/*', 'https://example.com/')).toBe(true);
    expect(matches('*://*.example.com/*', 'https://a.b.example.com/')).toBe(
      true,
    );
    expect(matches('*://*.example.com/*', 'https://notexample.com/')).toBe(
      false,
    );
    expect(matches('*://*/*', 'https://anything.org/a')).toBe(true);
  });

  it('never matches an invalid pattern', () => {
    expect(matches('<all_urls>', 'https://example.com/')).toBe(false);
  });
});
