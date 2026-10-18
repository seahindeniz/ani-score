import { beforeEach, describe, expect, it } from 'bun:test';

import type { ResolvedTheme } from '~/logic/setTheme';
import { useThemeStore } from '~/logic/storage';

let instance = 0;

// The module tracks its roots and current theme, so each test gets its own copy
async function freshSiteTheme() {
  return (await import(
    `../siteTheme.ts?case=${++instance}`
  )) as typeof import('../siteTheme');
}

function themedRoot() {
  const root = document.createElement('div');

  document.body.append(root);

  return root;
}

describe('siteTheme', () => {
  const themeStore = useThemeStore();

  beforeEach(async () => {
    await themeStore.dataReady;
    themeStore.setData('light');
  });

  it('applies a fixed theme to roots added before and after it resolves', async () => {
    const { addThemeRoot, initSiteTheme } = await freshSiteTheme();
    const early = themedRoot();

    addThemeRoot(early);
    expect(early.hasAttribute('data-kb-theme')).toBe(false);

    initSiteTheme('dark');

    const late = themedRoot();

    addThemeRoot(late);

    expect(early.getAttribute('data-kb-theme')).toBe('dark');
    expect(late.getAttribute('data-kb-theme')).toBe('dark');
  });

  it('follows a site that reports its own theme', async () => {
    const { addThemeRoot, initSiteTheme } = await freshSiteTheme();
    const root = themedRoot();
    let setSiteTheme!: (theme: ResolvedTheme) => void;

    addThemeRoot(root);
    initSiteTheme((set) => {
      setSiteTheme = set;
      set('dark');
    });

    expect(root.getAttribute('data-kb-theme')).toBe('dark');

    setSiteTheme('light');
    expect(root.getAttribute('data-kb-theme')).toBe('light');

    // The site's theme wins over the stored setting
    themeStore.setData('dark');
    expect(root.getAttribute('data-kb-theme')).toBe('light');
  });

  it('uses the stored setting until a late site reports its theme', async () => {
    const { addThemeRoot, initSiteTheme } = await freshSiteTheme();
    const root = themedRoot();
    let setSiteTheme!: (theme: ResolvedTheme) => void;

    addThemeRoot(root);
    initSiteTheme((set) => {
      setSiteTheme = set;
    });
    await themeStore.dataReady;
    await Promise.resolve();

    expect(root.getAttribute('data-kb-theme')).toBe('light');

    setSiteTheme('dark');
    themeStore.setData('dark');
    themeStore.setData('light');

    expect(root.getAttribute('data-kb-theme')).toBe('dark');
  });

  it('forgets roots whose cards were removed from the page', async () => {
    const { addThemeRoot, initSiteTheme } = await freshSiteTheme();
    const removed = themedRoot();
    let setSiteTheme!: (theme: ResolvedTheme) => void;

    addThemeRoot(removed);
    initSiteTheme((set) => {
      setSiteTheme = set;
      set('dark');
    });
    removed.remove();
    setSiteTheme('light');

    expect(removed.getAttribute('data-kb-theme')).toBe('dark');

    // Reconnecting doesn't bring it back, since it was dropped from the set
    document.body.append(removed);
    setSiteTheme('light');

    expect(removed.getAttribute('data-kb-theme')).toBe('dark');
  });
});
