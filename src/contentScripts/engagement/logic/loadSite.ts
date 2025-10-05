import type { InternalSiteBaseConfig } from '~/contentScripts/site/base'
import { debounce, leading } from '@solid-primitives/scheduled'
import { createStyleLink, customizeCards } from './customizeCards'

export async function initSiteLogic(config: InternalSiteBaseConfig) {
  let injectGlobalStyle = () => {
    injectGlobalStyle = () => {}

    document.body.appendChild(createStyleLink(config.scope))
  }

  config.listingPages.forEach((page) => {
    if (page.isValidPage()) {
      injectGlobalStyle()

      const disposables = [] as (() => void)[]
      const runListingPageLogic = leading(debounce, () => {
        disposables.push(customizeCards(page, config))
      }, 250)

      runListingPageLogic()
      page.reInit?.(() => {
        disposables.forEach(dispose => dispose())

        disposables.length = 0

        runListingPageLogic()
      })
    }
  })
}
