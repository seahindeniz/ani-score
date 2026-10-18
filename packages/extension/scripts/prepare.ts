import { execSync } from 'node:child_process'
import { watch } from 'node:fs'
import process from 'node:process'
import { isDev, log, mode, port, r } from './utils'

async function stubIndexHtml() {
  const views = ['options', 'popup', 'sidepanel']

  for (const view of views) {
    let data = await Bun.file(r(`src/${view}/index.html`)).text()
    data = data
      .replace('"./main.tsx"', `"http://localhost:${port}/${view}/main.tsx"`)
    // Creates the folder when it's missing
    await Bun.write(r(`extension/dist/${view}/index.html`), data)
    log('PRE', `stub ${view}`)
  }
}

async function writeManifest() {
  log('PRE', `Writing manifest for ${mode} mode`)

  execSync(`bun scripts/manifest.ts --writeManifest --mode ${mode}`, { stdio: 'inherit', env: process.env })
}

async function generateGraphQLTypes() {
  log('PRE', `Generating GraphQL types`)

  execSync(`bun run codegen`, { stdio: 'inherit', env: process.env })
}

// `fs.watch` reports a save as several events, so the task runs once they settle
function onChange(task: () => unknown, filter: (file: string) => boolean) {
  let timer: ReturnType<typeof setTimeout> | undefined

  return (_event: string, file: string | null) => {
    if (!file || !filter(file))
      return

    clearTimeout(timer)
    timer = setTimeout(task, 100)
  }
}

// Set by E2E runs, which use the committed types instead of fetching AniList's schema
if (!process.env.SKIP_GRAPHQL_CODEGEN)
  generateGraphQLTypes()

writeManifest()

if (isDev) {
  stubIndexHtml()
  watch(r('src'), { recursive: true }, onChange(stubIndexHtml, file => file.endsWith('.html')))
  // Watching the folders rather than the files keeps working when an editor saves by replacing the file
  watch(r('scripts'), onChange(writeManifest, file => file === 'manifest.ts'))
  watch(r(), onChange(writeManifest, file => file === 'package.json'))
  watch(r('src/background/gql-queries'), { recursive: true }, onChange(generateGraphQLTypes, file => file.endsWith('.ts')))
}
