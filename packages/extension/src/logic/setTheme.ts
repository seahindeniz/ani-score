import { debounce } from '@solid-primitives/scheduled';
import { createEffect, createRoot, on } from 'solid-js';

import { useThemeStore } from './storage';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = Exclude<Theme, 'system'>;

const isDarkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');
const determineTheme = (matches: boolean) => (matches ? 'dark' : 'light');
const getSystemTheme = () => determineTheme(isDarkQuery().matches);

export function applyTheme(root: HTMLElement, theme: ResolvedTheme) {
  root.setAttribute('data-kb-theme', theme);
}

/**
 * Calls `onChange` with the resolved theme, then again whenever it changes, until `signal` aborts.
 */
export async function watchTheme(
  onChange: (theme: ResolvedTheme) => void,
  /**
   * @default 'system'
   */
  theme?: Theme,
  signal?: AbortSignal,
) {
  // A fixed theme doesn't depend on the stored setting, so apply it before storage loads; otherwise the light
  // defaults show until then
  if (theme && theme !== 'system') {
    onChange(theme);

    return;
  }

  const themeStore = useThemeStore();

  await themeStore.dataReady;

  if (signal?.aborted) return;

  const storedTheme = themeStore.data();

  if (!storedTheme) {
    themeStore.setData('system');
  }

  createRoot((dispose) => {
    createEffect(
      on(themeStore.data, (currentTheme) => {
        onChange(currentTheme === 'system' ? getSystemTheme() : currentTheme);
      }),
    );
    signal?.addEventListener('abort', dispose);
  });

  const onSystemChange = debounce((event: MediaQueryListEvent) => {
    const currentTheme = themeStore.data();

    if (currentTheme === 'system') {
      onChange(determineTheme(event.matches));
    }
  }, 200);

  isDarkQuery().addEventListener('change', onSystemChange, { signal });
  signal?.addEventListener('abort', () => onSystemChange.clear());
}

export async function setTheme(
  root = document.documentElement,
  /**
   * @default 'system'
   */
  theme?: Theme,
) {
  await watchTheme((resolvedTheme) => applyTheme(root, resolvedTheme), theme);
}
