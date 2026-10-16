import { debounce } from '@solid-primitives/scheduled'
import { createEffect, on } from 'solid-js'
import { useThemeStore } from './storage'

const isDarkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')
const determineTheme = (matches: boolean) => matches ? 'dark' : 'light'
const getSystemTheme = () => determineTheme(isDarkQuery().matches)

export async function setTheme(
  root = document.documentElement,
  /**
   * @default 'system'
   */
  theme?: 'system' | 'light' | 'dark',
) {
  const applyTheme = (themeValue: ReturnType<ReturnType<typeof useThemeStore>['data']>) => {
    root.setAttribute(
      'data-kb-theme',
      themeValue === 'system' ? getSystemTheme() : themeValue,
    )
  }

  // A fixed theme doesn't depend on the stored setting, so apply it before storage loads; otherwise the light
  // defaults show until then
  if (theme && theme !== 'system') {
    applyTheme(theme)

    return
  }

  const themeStore = useThemeStore()

  await themeStore.dataReady

  const storedTheme = themeStore.data()

  if (!storedTheme) {
    themeStore.setData('system')
  }

  createEffect(on(themeStore.data, (currentTheme) => {
    applyTheme(currentTheme)
  }))

  isDarkQuery().addEventListener('change', debounce((event) => {
    const currentTheme = themeStore.data()

    if (currentTheme === 'system') {
      applyTheme(determineTheme(event.matches))
    }
  }, 200))
}
