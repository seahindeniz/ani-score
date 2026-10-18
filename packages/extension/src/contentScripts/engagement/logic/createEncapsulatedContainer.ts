import { createStyle } from './createStyle';
import { engagementStyles } from './engagementStyles';
import { addThemeRoot } from './siteTheme';

export function createEncapsulatedContainer() {
  const container = document.createElement('div');
  const root = document.createElement('div');
  // Open in dev builds so E2E tests can reach the card details
  const shadowDOM =
    container.attachShadow?.({ mode: __DEV__ ? 'open' : 'closed' })
    || container;

  container.className = __NAME__;

  addThemeRoot(root);
  shadowDOM.append(createStyle(engagementStyles), root);

  return { container, root, shadowDOM };
}
