import js from '@eslint/js'
import globals from 'globals'
import solid from 'eslint-plugin-solid/configs/typescript'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, solid],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['tsconfig.app.json', 'tsconfig.node.json'],
      },
    },
  },
])
