// ESLint 10 flat config (replaces CRA's built-in "react-app" preset).
//
// - react-hooks: the plugin's recommended set, which includes the React
//   Compiler's rules: code the compiler can't safely optimize is reported
//   here instead of being skipped silently at build time.
// - ESLint 10 tracks JSX references itself, so no-unused-vars sees
//   components used only as <Tag />.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['build/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' }, // set in vite.config.js
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      // Most screens load their data in an effect (setLoading, then fetch),
      // which this rule reports. That costs an extra render, not a bug; the
      // fix is a data-loading layer, a separate change. A warning until then.
      'react-hooks/set-state-in-effect': 'warn',
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }],
    },
  },
  {
    files: ['**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
  {
    files: ['*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
