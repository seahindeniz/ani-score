import { execSync } from 'node:child_process'
import process from 'node:process'
import chokidar from 'chokidar'
import fs from 'fs-extra'
import { isDev, log, port, r } from './utils'

async function stubIndexHtml() {
  const views = ['options', 'popup', 'sidepanel']

  for (const view of views) {
    await fs.ensureDir(r(`extension/dist/${view}`))
    let data = await fs.readFile(r(`src/${view}/index.html`), 'utf-8')
    data = data
      .replace('"./main.tsx"', `"http://localhost:${port}/${view}/main.tsx"`)
    await fs.writeFile(r(`extension/dist/${view}/index.html`), data, 'utf-8')
    log('PRE', `stub ${view}`)
  }
}

async function writeManifest() {
  execSync(`npx tsx scripts/manifest --writeManifest`, { stdio: 'inherit', env: process.env })
}

writeManifest()

if (isDev) {
  stubIndexHtml()
  chokidar.watch(r('src/**/*.html'))
    .on('change', () => {
      stubIndexHtml()
    })
  chokidar.watch([r('scripts/manifest.ts'), r('package.json')])
    .on('change', () => {
      writeManifest()
    })
}
