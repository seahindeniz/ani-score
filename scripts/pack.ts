import { execSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import fs from 'fs-extra'
import { argv, log, r } from './utils'

const wantAll = Boolean(argv.pack) || (!argv.zip && !argv.crx && !argv.xpi)
const wantZip = wantAll || Boolean(argv.zip)
const wantCrx = wantAll || Boolean(argv.crx)
const wantXpi = wantAll || Boolean(argv.xpi)
const outputDirectory = './release'
const version = process.env.npm_package_version

if (!version) {
  log('PACK', 'error: npm_package_version is not defined')
  process.exit(1)
}

try {
  log('PACK', 'running build')
  execSync('pnpm run build', { stdio: 'inherit', env: process.env })

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
    log('PACK', 'creating XPI')
    const env = { ...process.env, WEB_EXT_ARTIFACTS_DIR: path.join(process.cwd(), outputDirectory) }
    execSync(`web-ext build --source-dir ./extension --filename extension-${version}.xpi --overwrite-dest`, { stdio: 'inherit', env })
  }

  log('PACK', 'done')
  process.exit(0)
}
catch (err: any) {
  log('PACK', `error: ${err.message || err}`)
  process.exit(1)
}
