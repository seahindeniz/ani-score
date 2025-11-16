import type { InternalSiteBaseConfig } from '~/contentScripts/site/base'
import { debounce, leading } from '@solid-primitives/scheduled'
import { useRefStore } from '../store/refStore'
import { createEncapsulatedContainer } from './createEncapsulatedContainer'
import { createStyleLink } from './createStyleLink'
import { customizeCards } from './customizeCards'

export async function initSiteLogic(config: InternalSiteBaseConfig) {
  let injectGlobals = () => {
    injectGlobals = () => {}

    const refStore = useRefStore()
    const siteSpecificGlobalStyle = createStyleLink(config.scope)

    refStore.portalRoot = createEncapsulatedContainer(config)

    document.body.append(
      siteSpecificGlobalStyle,
      refStore.portalRoot.container,
    )
  }

  config.listingPages.forEach((page) => {
    if (page.isValidPage()) {
      injectGlobals()

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
