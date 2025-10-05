import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      'src/gql',
    ],
    unocss: true,
    solid: true,
  },
)
