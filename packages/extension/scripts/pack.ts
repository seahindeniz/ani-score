import { execSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { outputDirectory } from './constants';
import { argv, log, r } from './utils';

// `.env` is loaded by Bun itself
const wantAll = Boolean(argv.pack) || (!argv.zip && !argv.crx && !argv.xpi);
const wantZip = wantAll || Boolean(argv.zip);
const wantCrx = wantAll || Boolean(argv.crx);
const wantXpi = wantAll || Boolean(argv.xpi);
const { version } = await Bun.file(r('package.json')).json();

if (!version) {
  log('PACK', 'error: version is not defined in package.json');
  process.exit(1);
}

try {
  if (wantZip || wantCrx) {
    log('PACK', 'running build');
    execSync('bun run build', { stdio: 'inherit', env: process.env });
  }

  mkdirSync(r('release'), { recursive: true });

  if (wantZip) {
    log('PACK', 'creating ZIP');
    rmSync(`${outputDirectory}/extension-${version}.zip`, { force: true });
    execSync(
      `jszip-cli add extension/* -o ${outputDirectory}/extension-${version}.zip`,
      { stdio: 'inherit' },
    );
  }

  if (wantCrx) {
    log('PACK', 'creating CRX');
    execSync(
      `crx pack extension -p ${outputDirectory}/extension.pem -o ${outputDirectory}/extension-${version}.crx`,
      {
        stdio: 'inherit',
      },
    );
  }

  if (wantXpi) {
    log('PACK', 'running build for Firefox');
    execSync('bun run build-firefox', { stdio: 'inherit', env: process.env });

    const env = {
      ...process.env,
      WEB_EXT_ARTIFACTS_DIR: path.join(process.cwd(), outputDirectory),
      WEB_EXT_SOURCE_DIR: './extension',
      WEB_EXT_FILENAME: `extension-${version}.xpi`,
      WEB_EXT_OVERWRITE_DEST: 'true',
      WEB_EXT_CHANNEL: 'unlisted',
    };

    log('PACK', 'linting Firefox build');
    execSync(`web-ext lint`, { stdio: 'inherit', env });

    if (process.env.WEB_EXT_API_KEY && process.env.WEB_EXT_API_SECRET) {
      log('PACK', 'signing Firefox build');
      execSync(`web-ext sign`, { stdio: 'inherit', env });

      const file = Array.from(
        new Bun.Glob(`${outputDirectory}/*.xpi`).scanSync({ absolute: true }),
        (file) => file.replaceAll(path.sep, '/'),
      )
        .toSorted((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs)
        .pop();

      if (file)
        renameSync(
          file,
          file.replace(/(?<=release\/).{1,99}(?=-.*\.xpi)/, 'extension'),
        );
    } else {
      log('PACK', 'creating Firefox build');
      execSync(`web-ext build`, { stdio: 'inherit', env });
    }
  }

  log('PACK', 'done');
  process.exit(0);
} catch (err: any) {
  log('PACK', `error: ${err.message || err}`);
  process.exit(1);
}
