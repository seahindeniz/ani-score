import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      '.claude',
      'src/gql',
      'src/components/ui/*',
    ],
    unocss: true,
    solid: true,
  },
  {
    files: ['src/components/ui/*'],
    rules: {
      'ts/no-use-before-define': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'style/quote-props': ['error', 'as-needed'],
    },
  },
)
