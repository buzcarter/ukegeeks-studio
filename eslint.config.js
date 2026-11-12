/**
 * `npm run lint`: the pages (web/js, browser modules), the tests and scripts (Node),
 * and the preview's fake Tauri (a plain browser script). web/vendor/ is copied in from
 * the @ukegeeks packages and isn't ours to lint.
 */
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['web/vendor/', 'src-tauri/', 'node_modules/'] },
  js.configs.recommended,
  {
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-throw-literal': 'error',
    },
  },
  {
    files: ['web/js/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        // the editor's bundle, loaded by editor.html before the page's module
        ugsEditorPlus: 'readonly',
      },
    },
  },
  {
    files: ['test/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // injected into each page by scripts/preview/server.js; rejects with plain
    // strings on purpose, as Tauri does
    files: ['scripts/preview/fake-tauri.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
    rules: { 'no-throw-literal': 'off' },
  },
];
