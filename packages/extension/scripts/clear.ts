import { rmSync } from 'node:fs'
import { r } from './utils'

// Build output and the generated manifest, plus `release/extension.*` (which includes the CRX key `extension.pem`)
const paths = [
  'extension/dist',
  'extension/manifest.json',
  ...new Bun.Glob('release/extension.*').scanSync({ cwd: r() }),
]

for (const path of paths)
  rmSync(r(path), { recursive: true, force: true })
