import { execSync } from 'node:child_process';
import { mkdirSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import webExt from 'web-ext';

import { outputDirectory } from './constants';
import { argv, log, logError, r } from './utils';

// `.env` is loaded by Bun itself
const wantAll = Boolean(argv.pack) || (!argv.zip && !argv.crx && !argv.xpi);
const wantZip = wantAll || Boolean(argv.zip);
const wantCrx = wantAll || Boolean(argv.crx);
// Temporarily disabled Mozilla (XPI) packing and releasing
const wantXpi = false as boolean;

if (argv.xpi) {
  log('PACK', 'Mozilla (XPI) packing is temporarily disabled');
}
const { version } = await Bun.file(r('package.json')).json();

if (!version) {
  logError('PACK', 'version is not defined in package.json');
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
    // Bun can't write zip archives; web-ext packs any extension folder, not only Firefox builds
    execSync(
      `web-ext build --source-dir extension --artifacts-dir ${outputDirectory} --filename extension-${version}.zip --overwrite-dest`,
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
      WEB_EXT_CHANNEL: 'unlisted' as const,
    };

    log('PACK', 'linting Firefox build');
    execSync(`web-ext lint`, { stdio: 'inherit', env });

    if (process.env.WEB_EXT_API_KEY && process.env.WEB_EXT_API_SECRET) {
      log('PACK', 'signing Firefox build');
      // Through web-ext's API rather than its CLI: on Bun the CLI prints its errors without their message
      await webExt.cmd
        .sign(
          {
            sourceDir: r('extension'),
            artifactsDir: env.WEB_EXT_ARTIFACTS_DIR,
            apiKey: process.env.WEB_EXT_API_KEY,
            apiSecret: process.env.WEB_EXT_API_SECRET,
            channel: env.WEB_EXT_CHANNEL,
          },
          { shouldExitProgram: false },
        )
        .catch((error: Error) => {
          throw new Error(`signing failed: ${error.message}`);
        });

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
  logError('PACK', err.message || err);
  process.exit(1);
}
