/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-length': [0],
    'subject-case': [0],
    'footer-max-line-length': [0],
  },
}
