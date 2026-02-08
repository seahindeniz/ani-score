import { execSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { config as loadEnv } from 'dotenv'
import glob from 'fast-glob'
import fs from 'fs-extra'
import { outputDirectory } from './constants'
import { argv, log, r } from './utils'

loadEnv()

const wantAll = Boolean(argv.pack) || (!argv.zip && !argv.crx && !argv.xpi)
const wantZip = wantAll || Boolean(argv.zip)
const wantCrx = wantAll || Boolean(argv.crx)
const wantXpi = wantAll || Boolean(argv.xpi)
const version = process.env.npm_package_version

if (!version) {
  log('PACK', 'error: npm_package_version is not defined')
  process.exit(1)
}

try {
  if (wantZip || wantCrx) {
    log('PACK', 'running build')
    execSync('pnpm run build', { stdio: 'inherit', env: process.env })
  }

  await fs.ensureDir(r('release'))

  if (wantZip) {
    log('PACK', 'creating ZIP')
    execSync(`rimraf ${outputDirectory}/extension-${version}.zip && jszip-cli add extension/* -o ${outputDirectory}/extension-${version}.zip`, { stdio: 'inherit' })
  }

  if (wantCrx) {
    log('PACK', 'creating CRX')
    execSync(`crx pack extension -p ${outputDirectory}/extension.pem -o ${outputDirectory}/extension-${version}.crx`, { stdio: 'inherit' })
  }

  if (wantXpi) {
    log('PACK', 'running build for Firefox')
    execSync('pnpm run build-firefox', { stdio: 'inherit', env: process.env })

    const env = {
      ...process.env,
      WEB_EXT_ARTIFACTS_DIR: path.join(process.cwd(), outputDirectory),
      WEB_EXT_SOURCE_DIR: './extension',
      WEB_EXT_FILENAME: `extension-${version}.xpi`,
      WEB_EXT_OVERWRITE_DEST: 'true',
      WEB_EXT_CHANNEL: 'unlisted',
    }

    log('PACK', 'linting Firefox build')
    execSync(`web-ext lint`, { stdio: 'inherit', env })

    if (process.env.WEB_EXT_API_KEY && process.env.WEB_EXT_API_SECRET) {
      log('PACK', 'signing Firefox build')
      execSync(`web-ext sign`, { stdio: 'inherit', env })

      const file = glob.sync(`${outputDirectory}/*.xpi`, { absolute: true, stats: true })
        .toSorted((a, b) => a.stats!.mtimeMs - b.stats!.mtimeMs)
        .map(f => f.path)
        .pop()

      if (file)
        fs.renameSync(file, file.replace(/(?<=release\/).{1,99}(?=-.*\.xpi)/, 'extension'))
    }
    else {
      log('PACK', 'creating Firefox build')
      execSync(`web-ext build`, { stdio: 'inherit', env })
    }
  }

  log('PACK', 'done')
  process.exit(0)
}
catch (err: any) {
  log('PACK', `error: ${err.message || err}`)
  process.exit(1)
}
