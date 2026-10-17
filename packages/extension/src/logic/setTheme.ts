import { debounce } from '@solid-primitives/scheduled'
import { createEffect, on } from 'solid-js'
import { useThemeStore } from './storage'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = Exclude<Theme, 'system'>

const isDarkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')
const determineTheme = (matches: boolean) => matches ? 'dark' : 'light'
const getSystemTheme = () => determineTheme(isDarkQuery().matches)

export function applyTheme(root: HTMLElement, theme: ResolvedTheme) {
  root.setAttribute('data-kb-theme', theme)
}

/**
 * Calls `onChange` with the resolved theme, then again whenever it changes.
 */
export async function watchTheme(
  onChange: (theme: ResolvedTheme) => void,
  /**
   * @default 'system'
   */
  theme?: Theme,
) {
  // A fixed theme doesn't depend on the stored setting, so apply it before storage loads; otherwise the light
  // defaults show until then
  if (theme && theme !== 'system') {
    onChange(theme)

    return
  }

  const themeStore = useThemeStore()

  await themeStore.dataReady

  const storedTheme = themeStore.data()

  if (!storedTheme) {
    themeStore.setData('system')
  }

  createEffect(on(themeStore.data, (currentTheme) => {
    onChange(currentTheme === 'system' ? getSystemTheme() : currentTheme)
  }))

  isDarkQuery().addEventListener('change', debounce((event) => {
    const currentTheme = themeStore.data()

    if (currentTheme === 'system') {
      onChange(determineTheme(event.matches))
    }
  }, 200))
}

export async function setTheme(
  root = document.documentElement,
  /**
   * @default 'system'
   */
  theme?: Theme,
) {
  await watchTheme(resolvedTheme => applyTheme(root, resolvedTheme), theme)
}
