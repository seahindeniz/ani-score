import type { SiteConfig } from '~/sites/schema';
import { shareLink } from '~/sites/share';

const json = (config: SiteConfig) => `${JSON.stringify(config, null, 2)}\n`;

/**
 * Opens the repository's prefilled "Site integration" issue for the config. A config too long for a link goes to the
 * clipboard first, while the click still counts as the user's. Returns what to tell the user.
 */
export async function shareConfig(config: SiteConfig) {
  // Without the query and hash, which can hold session data that has no place in a public issue
  const link = shareLink(config, `${location.origin}${location.pathname}`);

  if (link.pasteConfig) await navigator.clipboard.writeText(json(config));

  window.open(link.url, '_blank', 'noopener');

  return link.pasteConfig
    ? "The setup is too long for a link, so it's on your clipboard: paste it into the form's Config field."
    : 'Opened a GitHub issue with the setup. Once a maintainer reviews it, it ships with AniScore for everyone.';
}

export async function copyConfig(config: SiteConfig) {
  await navigator.clipboard.writeText(json(config));

  return 'Copied the setup.';
}

export function downloadConfig(config: SiteConfig) {
  const url = URL.createObjectURL(
    new Blob([json(config)], { type: 'application/json' }),
  );
  const link = document.createElement('a');

  link.href = url;
  link.download = `${config.id || 'site'}.json`;
  link.click();
  URL.revokeObjectURL(url);

  return `Downloaded ${link.download}.`;
}
