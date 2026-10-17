import type { SiteBaseConfig } from '~/contentScripts/site/base'
import type { ResolvedTheme } from '~/logic/setTheme'
import { applyTheme, watchTheme } from '~/logic/setTheme'

// Each root sits in a closed shadow root, so every one of them gets the theme written to it
const roots = new Set<HTMLElement>()
let currentTheme: ResolvedTheme | undefined

function setSiteTheme(theme: ResolvedTheme) {
  currentTheme = theme

  roots.forEach((root) => {
    // The card it belonged to was removed from the page
    if (!root.isConnected) {
      roots.delete(root)

      return
    }

    applyTheme(root, theme)
  })
}

/**
 * Resolves the site's theme once per page; roots added with `addThemeRoot` follow it.
 */
export function initSiteTheme(theme: SiteBaseConfig['theme']) {
  if (typeof theme !== 'function') {
    void watchTheme(setSiteTheme, theme)

    return
  }

  let isSetBySite = false

  theme((resolvedTheme) => {
    isSetBySite = true
    setSiteTheme(resolvedTheme)
  })

  // A site that resolves its theme later hasn't called `set` yet; follow the user's stored setting until it does
  if (!isSetBySite) {
    void watchTheme((resolvedTheme) => {
      if (!isSetBySite)
        setSiteTheme(resolvedTheme)
    })
  }
}

export function addThemeRoot(root: HTMLElement) {
  roots.add(root)

  if (currentTheme)
    applyTheme(root, currentTheme)
}
