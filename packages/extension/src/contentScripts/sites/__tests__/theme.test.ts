import { afterEach, describe, expect, it } from 'bun:test';

import type { ResolvedTheme } from '~/logic/setTheme';
import type { SiteConfig } from '~/sites/schema';
import { wait } from '~/utils/wait';

import { toThemeSource } from '../theme';

function follow(theme: SiteConfig['theme']) {
  const themes: ResolvedTheme[] = [];

  (toThemeSource(theme) as (set: (theme: ResolvedTheme) => void) => void)(
    (resolved) => themes.push(resolved),
  );

  return themes;
}

afterEach(() => {
  document.documentElement.className = '';
  localStorage.clear();
});

describe('toThemeSource', () => {
  it('passes fixed themes through', () => {
    expect(toThemeSource('dark')).toBe('dark');
    expect(toThemeSource(undefined)).toBeUndefined();
  });

  it('is dark while an element matches, following class changes on <html>', async () => {
    const themes = follow({ dark: { selector: 'html.dark' } });

    document.documentElement.className = 'dark';
    await wait();

    expect(themes).toEqual(['light', 'dark']);
  });

  it('is dark when any of the conditions holds', () => {
    localStorage.setItem('theme', 'dark');

    expect(
      follow({
        dark: {
          any: [
            { selector: 'html.dark' },
            { localStorage: { key: 'theme', equals: 'dark' } },
          ],
        },
      }),
    ).toEqual(['dark']);
  });

  it('follows a theme saved in another tab', () => {
    const themes = follow({
      dark: { localStorage: { key: 'theme', equals: 'dark' } },
    });

    localStorage.setItem('theme', 'dark');
    window.dispatchEvent(new Event('storage'));

    expect(themes).toEqual(['light', 'dark']);
  });
});
