import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { wait } from '~/utils/wait';

import type { ResolvedTheme } from '../setTheme';
import { applyTheme, setTheme, watchTheme } from '../setTheme';
import { useThemeStore } from '../storage';

function stubColorScheme(prefersDark: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>();

  window.matchMedia = mock(() => ({
    matches: prefersDark,
    addEventListener: (
      _type: string,
      listener: (event: { matches: boolean }) => void,
      options?: { signal?: AbortSignal },
    ) => {
      listeners.add(listener);
      options?.signal?.addEventListener('abort', () =>
        listeners.delete(listener),
      );
    },
  })) as unknown as typeof window.matchMedia;

  return {
    change: (matches: boolean) =>
      listeners.forEach((listener) => listener({ matches })),
  };
}

describe('applyTheme', () => {
  it('sets the Kobalte theme attribute', () => {
    const root = document.createElement('div');

    applyTheme(root, 'dark');

    expect(root.getAttribute('data-kb-theme')).toBe('dark');
  });
});

describe('watchTheme', () => {
  const originalMatchMedia = window.matchMedia;
  const themeStore = useThemeStore();

  beforeEach(async () => {
    await themeStore.dataReady;
    themeStore.setData('system');
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('applies a fixed theme right away without reading the stored setting', async () => {
    const onChange = mock();

    themeStore.setData('light');
    await watchTheme(onChange, 'dark');

    expect(onChange.mock.calls).toEqual([['dark']]);
  });

  it('follows the stored setting', async () => {
    stubColorScheme(true);

    const themes: ResolvedTheme[] = [];

    themeStore.setData('light');
    await watchTheme((theme) => themes.push(theme));
    themeStore.setData('dark');

    expect(themes).toEqual(['light', 'dark']);
  });

  it('resolves "system" from the color scheme and follows its changes', async () => {
    const colorScheme = stubColorScheme(false);
    const themes: ResolvedTheme[] = [];

    await watchTheme((theme) => themes.push(theme), 'system');
    colorScheme.change(true);
    await wait(250);

    expect(themes).toEqual(['light', 'dark']);
  });

  it('ignores color scheme changes when a theme is chosen', async () => {
    const colorScheme = stubColorScheme(false);
    const themes: ResolvedTheme[] = [];

    themeStore.setData('dark');
    await watchTheme((theme) => themes.push(theme));
    colorScheme.change(false);
    await wait(250);

    expect(themes).toEqual(['dark']);
  });

  it('stops following the stored setting and the color scheme once aborted', async () => {
    const colorScheme = stubColorScheme(false);
    const themes: ResolvedTheme[] = [];
    const stopped = new AbortController();

    await watchTheme((theme) => themes.push(theme), 'system', stopped.signal);
    colorScheme.change(true);
    stopped.abort();
    await wait(250);
    colorScheme.change(true);
    themeStore.setData('dark');
    await wait(250);

    expect(themes).toEqual(['light']);
  });

  it('does nothing when aborted before the stored setting loads', async () => {
    const onChange = mock();
    const stopped = new AbortController();
    const watching = watchTheme(onChange, 'system', stopped.signal);

    stopped.abort();
    await watching;

    expect(onChange).not.toHaveBeenCalled();
  });

  it('stores "system" when no setting is stored', async () => {
    stubColorScheme(true);

    const themes: ResolvedTheme[] = [];

    themeStore.setData('' as 'system');
    await watchTheme((theme) => themes.push(theme));

    expect(themeStore.data()).toBe('system');
    expect(themes.at(-1)).toBe('dark');
  });
});

describe('setTheme', () => {
  it('applies the theme to the document by default', async () => {
    await setTheme(undefined, 'dark');

    expect(document.documentElement.getAttribute('data-kb-theme')).toBe('dark');
  });

  it('applies the theme to the given root', async () => {
    const root = document.createElement('main');

    await setTheme(root, 'light');

    expect(root.getAttribute('data-kb-theme')).toBe('light');
  });
});
