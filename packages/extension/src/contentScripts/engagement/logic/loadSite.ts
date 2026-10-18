import { debounce, leadingAndTrailing } from '@solid-primitives/scheduled';

import { rootContainerClass } from '~/constants/main';
import type { InternalSiteBaseConfig } from '~/contentScripts/site/base';

import { useRefStore } from '../store/refStore';
import { createEncapsulatedContainer } from './createEncapsulatedContainer';
import { createStyleLink } from './createStyleLink';
import { customizeCards } from './customizeCards';
import { initSiteTheme } from './siteTheme';

export async function initSiteLogic(config: InternalSiteBaseConfig) {
  let injectGlobals = () => {
    injectGlobals = () => {};

    const refStore = useRefStore();
    const siteSpecificGlobalStyle = createStyleLink(config.scope);

    initSiteTheme(config.theme);

    refStore.portalRoot = createEncapsulatedContainer();

    refStore.portalRoot.container.classList.add(rootContainerClass);

    document.body.append(
      siteSpecificGlobalStyle,
      refStore.portalRoot.container,
    );
  };

  config.listingPages.forEach((page) => {
    if (page.isValidPage()) {
      injectGlobals();

      const disposables = [] as (() => void)[];
      // Runs right away, and once more after a burst of re-renders settles, so the last re-render isn't dropped
      const runListingPageLogic = leadingAndTrailing(
        debounce,
        () => {
          disposables.forEach((dispose) => dispose());

          disposables.length = 0;

          disposables.push(customizeCards(page, config));
        },
        250,
      );

      runListingPageLogic();
      page.reInit?.(() => runListingPageLogic());
    }
  });
}
