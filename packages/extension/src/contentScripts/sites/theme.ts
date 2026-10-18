import type { SiteThemeSource } from '~/contentScripts/engagement/logic/siteTheme';
import type { Condition, SiteConfig } from '~/sites/schema';

function holds(condition: Condition): boolean {
  if ('selector' in condition) {
    return document.querySelector(condition.selector) != null;
  }

  if ('localStorage' in condition) {
    return (
      window.localStorage.getItem(condition.localStorage.key)
      === condition.localStorage.equals
    );
  }

  return condition.any.some(holds);
}

/**
 * A config's theme in the form `initSiteTheme` takes. A condition is checked again whenever the `<html>` or `<body>`
 * attributes change (where theme toggles put their classes) and when another tab saves to storage.
 */
export function toThemeSource(theme: SiteConfig['theme']): SiteThemeSource {
  if (typeof theme !== 'object') return theme;

  return (set) => {
    const sync = () => set(holds(theme.dark) ? 'dark' : 'light');
    const observer = new MutationObserver(sync);

    sync();
    observer.observe(document.documentElement, { attributes: true });
    observer.observe(document.body, { attributes: true });
    window.addEventListener('storage', sync);
  };
}
