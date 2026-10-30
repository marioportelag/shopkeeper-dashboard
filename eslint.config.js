import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules', 'coverage'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.js', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, Chart: 'readonly', DataTable: 'readonly' },
    },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error',
      'prefer-const': 'error',
    },
  },
];
