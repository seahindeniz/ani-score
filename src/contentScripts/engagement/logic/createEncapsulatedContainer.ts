import type { SiteBaseConfig } from '~/contentScripts/site/base'
import { setTheme } from '~/logic/setTheme'
import { createStyleLink } from './createStyleLink'

export function createEncapsulatedContainer(siteConfig: SiteBaseConfig) {
  const container = document.createElement('div')
  const root = document.createElement('div')
  const shadowDOM = container.attachShadow?.({ mode: 'closed' }) || container

  container.className = __NAME__

  setTheme(root, siteConfig.theme)
  shadowDOM.append(createStyleLink('engagement'), root)

  return { container, root, shadowDOM }
}
