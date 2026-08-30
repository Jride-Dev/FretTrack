import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';

const sharedIgnores = [
  'dist/**',
  'build/**',
  'coverage/**',
  'node_modules/**',
  'playwright-report/**',
  'test-results/**',
  'supabase/**',
  'docs/**',
  'Screenshots/**',
];

const sharedLanguageOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  globals: {
    ...globals.browser,
    ...globals.node,
    ...globals.serviceworker,
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
};

export default [
  {
    ignores: sharedIgnores,
  },
  {
    files: ['**/*.{js,mjs,jsx}'],
    languageOptions: sharedLanguageOptions,
    plugins: {
      import: importPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'off',
      'no-useless-catch': 'off',
      'import/no-duplicates': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}', 'cloudflare/**/*.{js,mjs}', 'vite.config.js', 'playwright.config.js', 'db.js'],
    languageOptions: sharedLanguageOptions,
  },
];
