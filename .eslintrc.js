module.exports = {
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json'],
  },
  plugins: ['@typescript-eslint'],
  env: {
    browser: false,
    node: true,
  },
  rules: {
    semi: [2, 'never'],
    'key-spacing': 0,
    'no-multi-spaces': 0,
    'no-param-reassign': 0,
    'no-underscore-dangle': 0,
    '@typescript-eslint/no-explicit-any': 'warn',
    'import/no-extraneous-dependencies': 'warn',
    '@typescript-eslint/triple-slash-reference': 'warn',
  },
  root: true,
}
