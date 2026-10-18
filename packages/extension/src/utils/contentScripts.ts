import { basename, sep } from 'node:path';

const removeExtension = (filename: string) =>
  filename.replace(/\.(ts|tsx)$/, '');

/**
 * @param path Absolute path of a content script entry, using `/` as the separator
 */
export function getContentScriptScope(path: string) {
  const pieces = path.replace(/.*src\/contentScripts\//g, '').split('/');
  let name = pieces.pop()!;
  let directory = pieces.join('/');
  const relativePath = path.replace(/^.*?(?=src)/g, '');

  if (!directory) {
    directory = `root/${removeExtension(name)}`;
    name = 'main';
  }

  return {
    path,
    directory,
    relativePath,
    relativeDir: relativePath.replace(basename(path), ''),
    name: `${removeExtension(name)}.js`,
  };
}

// Absolute paths relative to the working directory, sorted since the scan order isn't guaranteed
function findEntries(pattern: string, exclude = (_path: string) => false) {
  return Array.from(
    new Bun.Glob(pattern).scanSync({ absolute: true }),
    (path) => path.replaceAll(sep, '/'),
  )
    .filter((path) => !exclude(path))
    .sort();
}

const messageGatewayPath = 'src/contentScripts/messageGateway.ts';

// Injected when the user asks for it, rather than by the manifest
const onDemand = ['/contentScripts/widget/', '/contentScripts/editor/'];

export const contentScriptPaths = [
  ...findEntries(messageGatewayPath),
  ...findEntries('src/contentScripts/*/main.{ts,tsx}', (path) =>
    onDemand.some((directory) => path.includes(directory)),
  ),
  ...findEntries('src/contentScripts/*.{ts,tsx}', (path) =>
    path.endsWith(`/${messageGatewayPath}`),
  ),
].map(getContentScriptScope);

/**
 * Content scripts the background injects on demand (`scripting.executeScript`): the site editor.
 */
export const injectedScriptPaths = findEntries(
  'src/contentScripts/editor/main.{ts,tsx}',
).map(getContentScriptScope);
