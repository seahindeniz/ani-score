import glob from 'fast-glob'

const removeExtension = (filename: string) => filename.replace(/\.(ts|tsx)$/, '')

export function getContentScriptScope(entry: glob.Entry) {
  const pieces = entry.path.replace(/.*src\/contentScripts\//g, '').split('/')
  let name = pieces.pop()!
  let directory = pieces.join('/')
  const relativePath = entry.path.replace(/^.*?(?=src)/g, '')

  if (!directory) {
    directory = `root/${removeExtension(name)}`
    name = 'main'
  }

  return {
    path: entry.path,
    directory,
    relativePath,
    relativeDir: relativePath.replace(entry.name, ''),
    name: `${removeExtension(name)}.js`,
  }
}

const messageGatewayPath = './src/contentScripts/messageGateway.ts'

export const contentScriptPaths = [
  ...glob.sync(messageGatewayPath, { absolute: true, stats: true }),
  ...glob.sync('src/contentScripts/*/main.{ts,tsx}', { ignore: ['**/widget'], absolute: true, stats: true }),
  ...glob.sync('src/contentScripts/site/*/main.{ts,tsx}', { absolute: true, stats: true }),
  ...glob.sync('src/contentScripts/*.{ts,tsx}', { absolute: true, stats: true, ignore: [messageGatewayPath] }),
].map(getContentScriptScope)
