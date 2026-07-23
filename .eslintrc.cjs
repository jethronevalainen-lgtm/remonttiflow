module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', 'dist-ssr', '*.local', 'coverage', 'playwright-report'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // Deliberately relaxed for the existing codebase — may be re-enabled later.
    '@typescript-eslint/no-explicit-any': 'off',
  },
  overrides: [
    {
      files: ['*.config.ts', '*.config.js', 'vite.config.ts', 'vitest.setup.ts'],
      env: { node: true },
    },
    {
      // shadcn/ui primitives export variants/helpers alongside components, and
      // context modules export hooks + providers by design; fast-refresh
      // component-only-export does not apply to these file kinds.
      files: ['src/components/ui/**', 'src/contexts/**'],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
  ],
};
