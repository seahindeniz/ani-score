import { execSync } from 'node:child_process'
import process from 'node:process'
import { watch } from 'chokidar'
import fs from 'fs-extra'
import { isDev, log, mode, port, r } from './utils'

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
  execSync(`npx tsx scripts/manifest --writeManifest --mode ${mode}`, { stdio: 'inherit', env: process.env })
}

async function generateGraphQLTypes() {
  log('PRE', `Generating GraphQL types`)

  execSync(`pnpm run codegen`, { stdio: 'inherit', env: process.env })
}

generateGraphQLTypes()
writeManifest()

console.log('isDev', isDev)

if (isDev) {
  stubIndexHtml()
  watch(r('src/**/*.html')).on('change', stubIndexHtml)
  watch([r('scripts/manifest.ts'), r('package.json')]).on('change', writeManifest)
  watch(r('src/background/gql-queries/**/*.ts'), { persistent: true }).on('change', generateGraphQLTypes)
}
