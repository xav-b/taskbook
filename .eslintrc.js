module.exports = {
  root: true,
  extends: [
    // 'plugin:import/typescript',
    // 'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // 'plugin:import/recommended',
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
    'prettier',
  ],
  plugins: ['@typescript-eslint/eslint-plugin'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  env: {
    node: true,
  },
  rules: {
    semi: [2, 'never'],
    'key-spacing': 0,
    'no-multi-spaces': 0,
    'no-param-reassign': 0,
    'no-underscore-dangle': 0,
    '@typescript-eslint/no-explicit-any': 'warn',
    // 'import/no-extraneous-dependencies': 'warn',
    '@typescript-eslint/triple-slash-reference': 'warn',
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
  },
  ignorePatterns: [
    '.*.js',
    '*.setup.js',
    '*.config.js',
    '.turbo/',
    'dist/',
    'coverage/',
    'node_modules/',
  ],
}
