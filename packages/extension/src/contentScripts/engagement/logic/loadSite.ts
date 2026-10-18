import { leadingAndTrailing, throttle } from '@solid-primitives/scheduled';

import { rootContainerClass } from '~/constants/main';
import { collectCards, pageMatches } from '~/contentScripts/sites/extract';
import { toThemeSource } from '~/contentScripts/sites/theme';
import { pageCss } from '~/sites/layout';
import type { SiteConfig, SitePage } from '~/sites/schema';

import { useRefStore } from '../store/refStore';
import { createEncapsulatedContainer } from './createEncapsulatedContainer';
import { createStyle, ownElementAttribute } from './createStyle';
import { createCardCustomizer } from './customizeCards';
import { initSiteTheme } from './siteTheme';

import globalStyles from '../global.css?raw';

const watchingClass = 'ani-score-watching';

const isOwnElement = (node: Node) =>
  node instanceof Element
  && (node.classList.contains(__NAME__)
    || node.hasAttribute(ownElementAttribute));

const classTokens = (value: string | null) =>
  new Set(value?.split(/\s+/).filter(Boolean));

/**
 * Whether a change could matter to the cards. AniScore's own changes don't count: adding its details and styles, and
 * toggling the shimmer. A site removing the details does, so they're put back.
 */
function isSiteMutation(record: MutationRecord) {
  if (record.type === 'childList') {
    return (
      Array.from(record.removedNodes).some(isOwnElement)
      || !Array.from(record.addedNodes).every(isOwnElement)
    );
  }

  if (record.type === 'attributes' && record.attributeName === 'class') {
    const changed = classTokens(record.oldValue).symmetricDifference(
      classTokens((record.target as Element).getAttribute('class')),
    );

    return Array.from(changed).some((token) => token !== watchingClass);
  }

  return true;
}

/**
 * The attributes the config can depend on. Watching every attribute would include the `style` that animations and
 * carousels change on every frame.
 */
function watchedAttributes(site: SiteConfig) {
  const json = JSON.stringify(site.pages);
  const names = new Set(['class', 'id', 'href', 'src', 'title', 'alt']);

  for (const [, name] of json.matchAll(/\[\s*([\w-]+)/g)) names.add(name);
  for (const [, name] of json.matchAll(/"attr":"([^"]+)"/g)) names.add(name);

  return Array.from(names);
}

export function initSiteLogic(site: SiteConfig) {
  const siteStyles = [globalStyles, site.css].filter(Boolean).join('\n');
  const pageStyles = new Map<SitePage, HTMLStyleElement>();
  const customizer = createCardCustomizer(siteStyles);
  const globals: Element[] = [];

  let injectGlobals = () => {
    injectGlobals = () => {};

    const refStore = useRefStore();

    initSiteTheme(toThemeSource(site.theme));

    refStore.portalRoot = createEncapsulatedContainer();

    refStore.portalRoot.container.classList.add(rootContainerClass);

    globals.push(createStyle(siteStyles), refStore.portalRoot.container);
    document.body.append(...globals);
  };

  function run() {
    const pages = site.pages.filter((page) => pageMatches(page, location));

    if (pages.length) injectGlobals();

    for (const page of site.pages) {
      const style = pageStyles.get(page);

      const css = pageCss(page);

      if (css && pages.includes(page) && !style) {
        pageStyles.set(page, createStyle(css));
        document.body.append(pageStyles.get(page)!);
      } else if (style && !pages.includes(page)) {
        style.remove();
        pageStyles.delete(page);
      }
    }

    customizer.update(collectCards(pages));
  }

  // Runs right away, then at most every 250ms while the page keeps changing (SPA navigation, in-place paging, lazily
  // rendered cards), and once more after it settles, so the last change isn't dropped
  const scheduleRun = leadingAndTrailing(throttle, run, 250);
  const observer = new MutationObserver((records) => {
    if (records.some(isSiteMutation)) scheduleRun();
  });

  scheduleRun();
  observer.observe(
    (site.observe && document.querySelector(site.observe)) || document.body,
    {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: watchedAttributes(site),
    },
  );

  // Leaves the page as it was, e.g. to start again with an edited config
  return () => {
    observer.disconnect();
    scheduleRun.clear();
    customizer.dispose();
    [...globals, ...pageStyles.values()].forEach((element) => element.remove());
  };
}
