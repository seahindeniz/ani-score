import type { Plugin } from 'vite'
import glob from 'fast-glob'
import { minimatch } from 'minimatch'
import { getContentScriptScope } from '~/utils/contentScripts'

export function injectEngageWithSite(include: string[]): Plugin {
  return {
    name: 'inject-engage-with-site',
    enforce: 'pre',
    transform(code, id) {
      if (!include.some(pattern => minimatch(id, pattern))) {
        return null
      }

      const [entry] = glob.sync(id, { absolute: true, stats: true })

      if (!entry) {
        return null
      }

      const detail = getContentScriptScope(entry)

      return {
        code: `${code}\n\nwindow.engageWithSite(config, '${detail.directory}')`,
        map: null,
      }
      // // Check if this file should be processed
      // const shouldInclude = include.some(pattern =>
      //   id.includes(pattern.replace(/\*/g, ''))
      //   || new RegExp(pattern.replace(/\*/g, '.*')).test(id),
      // )

      // const shouldExclude = exclude.some(pattern =>
      //   id.includes(pattern.replace(/\*/g, ''))
      //   || new RegExp(pattern.replace(/\*/g, '.*')).test(id),
      // )

      // if (!shouldInclude || shouldExclude) {
      //   return null
      // }

      // // Check if file exports a config (if required)
      // if (onlyIfConfigExists && !code.includes('export const config')) {
      //   return null
      // }

      // // Check if engageWithSite is already called
      // if (code.includes('window.engageWithSite(')) {
      //   return null
      // }

      // // Inject the call at the end
      // const injectedCode = `${code}\n\nwindow.engageWithSite(config)`

      // return {
      //   code: injectedCode,
      //   map: null, // You could generate a source map here if needed
      // }
    },
  }
}
