import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs, styleText } from 'node:util';

export const argv = parseArgs({
  args: process.argv.slice(2),
  options: {
    mode: { type: 'string' },
    writeManifest: { type: 'boolean' },
    pack: { type: 'boolean' },
    zip: { type: 'boolean' },
    crx: { type: 'boolean' },
    xpi: { type: 'boolean' },
  },
  // Vite configs import this module too, so their own CLI arguments must pass through
  strict: false,
  allowPositionals: true,
}).values;

const __dirname = dirname(fileURLToPath(import.meta.url));

export const mode = typeof argv.mode === 'string' ? argv.mode : 'production';

export const port = Number(process.env.PORT || '') || 3303;
export const r = (...args: string[]) => resolve(__dirname, '..', ...args);
export const isDev = mode === 'development';
export const targetBrowser = process.env.EXTENSION || 'chrome';
export const isFirefox = targetBrowser === 'firefox';

export function log(name: string, message: string) {
  console.log(styleText(['black', 'bgCyan'], ` ${name} `), message);
}
