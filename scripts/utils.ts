import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { bgCyan, black } from 'kolorist'
import parser from 'yargs-parser'

export const argv = parser(process.argv.slice(2)) as Record<string, string | boolean>

const __dirname = dirname(fileURLToPath(import.meta.url))

export const mode = argv.mode || 'production'

export const port = Number(process.env.PORT || '') || 3303
export const r = (...args: string[]) => resolve(__dirname, '..', ...args)
export const isDev = mode === 'development'
export const targetBrowser = process.env.EXTENSION || 'chrome'
export const isFirefox = targetBrowser === 'firefox'

export function log(name: string, message: string) {
  console.log(black(bgCyan(` ${name} `)), message)
}
