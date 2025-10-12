import { debounce } from '@solid-primitives/scheduled'
import { createEffect, on } from 'solid-js'
import { useThemeStore } from './storage'

const isDarkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')
const determineTheme = (matches: boolean) => matches ? 'dark' : 'light'
const getSystemTheme = () => determineTheme(isDarkQuery().matches)

function applyTheme(themeValue: ReturnType<ReturnType<typeof useThemeStore>['data']>) {
  document.documentElement.setAttribute(
    'data-kb-theme',
    themeValue === 'system' ? getSystemTheme() : themeValue,
  )
}

export async function setTheme() {
  const theme = useThemeStore()

  await theme.dataReady

  const storedTheme = theme.data()

  if (!storedTheme) {
    theme.setData('system')
  }

  createEffect(on(theme.data, (currentTheme) => {
    applyTheme(currentTheme)
  }))

  isDarkQuery().addEventListener('change', debounce((event) => {
    const currentTheme = theme.data()

    if (currentTheme === 'system') {
      applyTheme(determineTheme(event.matches))
    }
  }, 200))
}
