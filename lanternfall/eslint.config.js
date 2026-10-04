import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'sim-reports'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The simulation must be pure and deterministic (see CLAUDE.md, rule 1).
    files: ['src/sim/**/*.ts', 'src/data/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'performance',
        'localStorage',
        'navigator',
        'requestAnimationFrame',
        'setTimeout',
        'setInterval',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Rng.' },
        { object: 'Date', property: 'now', message: 'Use sim ticks.' },
      ],
    },
  },
  {
    files: ['eslint.config.js', 'vite.config.ts'],
    rules: { 'no-restricted-exports': 'off' },
  },
);
