import type { Plugin } from 'vite';

/**
 * Stands in for a content script's stylesheet until the build replaces it; see `inlineCss`.
 */
export const inlineCssPlaceholder = '__ANI_SCORE_INLINE_CSS__';

/**
 * Moves a content script's CSS into its JavaScript, replacing the `inlineCssPlaceholder` string, and drops the CSS file.
 * Pages then never load anything from the extension, so it needs no web-accessible resources on them (which would
 * let any page detect it), and sites the user adds at runtime work the same as bundled ones.
 */
export function inlineCss(): Plugin {
  return {
    name: 'ani-score-inline-css',
    apply: 'build',
    // After UnoCSS has written its utilities into the CSS
    enforce: 'post',
    generateBundle(_, bundle) {
      const stylesheets = Object.values(bundle).filter(
        (output) => output.type === 'asset' && output.fileName.endsWith('.css'),
      );
      const css = stylesheets
        .map((output) => (output.type === 'asset' ? String(output.source) : ''))
        .join('\n');

      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') {
          output.code = output.code.replace(
            new RegExp(`(["'\`])${inlineCssPlaceholder}\\1`, 'g'),
            () => JSON.stringify(css),
          );
        }
      }

      for (const stylesheet of stylesheets) delete bundle[stylesheet.fileName];
    },
  };
}
