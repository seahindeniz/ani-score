import type { Config } from 'release-it'

export default {
  hooks: {
    'after:bump': 'pnpm pack-it',
  },
  npm: {
    publish: false,
  },
  github: {
    release: true,
    assets: [
      'extension/release/extension.zip',
      'extension/release/extension.crx',
      'extension/release/extension.xpi',
    ],
    comments: {
      submit: true,
      /* eslint-disable no-template-curly-in-string */
      issue: ':rocket: _This issue has been resolved in v${version}. '
        + 'See [${releaseName}](${releaseUrl}) for release notes._',
      pr: ':rocket: _This pull request has been resolved in v${version}. '
        + 'See [${releaseName}](${releaseUrl}) for release notes._',
      /* eslint-enable no-template-curly-in-string */
    },
  },
  git: {
    // eslint-disable-next-line no-template-curly-in-string
    commitMessage: 'chore(release): v${version} [skip ci]',
  },
} satisfies Config
