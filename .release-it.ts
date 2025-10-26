/* eslint-disable no-template-curly-in-string */
import type { Config } from 'release-it'
import { outputDirectory } from './scripts/constants'

export default {
  hooks: {
    'after:bump': 'pnpm run pack',
  },
  npm: {
    publish: false,
  },
  github: {
    release: true,
    assets: [
      `${outputDirectory}/extension-\${version}.zip`,
      `${outputDirectory}/extension-\${version}.crx`,
      `${outputDirectory}/extension-\${version}.xpi`,
    ],
    comments: {
      submit: true,
      issue: ':rocket: _This issue has been resolved in v${version}. '
        + 'See [${releaseName}](${releaseUrl}) for release notes._',
      pr: ':rocket: _This pull request has been resolved in v${version}. '
        + 'See [${releaseName}](${releaseUrl}) for release notes._',
    },
  },
  git: {
    commitMessage: 'chore(release): v${version} [skip ci]',
    requireCleanWorkingDir: false,
  },
} satisfies Config
