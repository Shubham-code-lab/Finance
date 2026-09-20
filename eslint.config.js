import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.chrome-layout-check*/**', '.finance-preview-profile/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        AbortSignal: 'readonly',
        Blob: 'readonly',
        crypto: 'readonly',
        document: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        fetch: 'readonly',
        HTMLElement: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        window: 'readonly',
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.api.ts'],
    rules: {
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Put network and resource requests in a dedicated *.api.ts module.' }],
    },
  },
  {
    files: ['src/**/*.tsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      'react/forbid-dom-props': ['error', { forbid: [{ propName: 'style', message: 'Use a react-jss class instead of inline styles.' }] }],
      'react/no-multi-comp': ['error', { ignoreStateless: false }],
      'react-refresh/only-export-components': ['error', { allowConstantExport: false }],
    },
  },
  prettier,
)
