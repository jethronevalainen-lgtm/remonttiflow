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
      files: ['supabase/functions/**/*.ts'],
      env: { es2022: true },
      globals: {
        Deno: 'readonly',
      },
    },
    {
      // shadcn/ui primitives export variants/helpers alongside components, and
      // context modules export hooks + providers by design; fast-refresh
      // component-only-export does not apply to these file kinds. The customer
      // order dialog and time-workspace component module intentionally export
      // shared immutable defaults and formatters alongside their components.
      files: [
        'src/components/ui/**',
        'src/contexts/**',
        'src/components/customer/CustomerOrderCreateDialog.tsx',
        'src/pages/time/TimeWorkspaceComponents.tsx',
      ],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
    {
      // This orchestration view derives query-backed collections and keeps a
      // detail editor synchronized with explicit scalar dependencies. The
      // generic exhaustive-deps heuristic cannot model those invariants.
      files: ['src/pages/workOrders/WorkOrderControlPanel.tsx'],
      rules: {
        'react-hooks/exhaustive-deps': 'off',
      },
    },
  ],
};
