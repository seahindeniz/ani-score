import { createStyleLink } from './createStyleLink'
import { addThemeRoot } from './siteTheme'

export function createEncapsulatedContainer() {
  const container = document.createElement('div')
  const root = document.createElement('div')
  const shadowDOM = container.attachShadow?.({ mode: 'closed' }) || container

  container.className = __NAME__

  addThemeRoot(root)
  shadowDOM.append(createStyleLink('engagement'), root)

  return { container, root, shadowDOM }
}
