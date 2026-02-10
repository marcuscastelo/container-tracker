// import js from '@eslint/js'
// biome-ignore lint/performance/noNamespaceImport: This is how ESLint configs are structured
import * as tsParser from '@typescript-eslint/parser'
import solid from 'eslint-plugin-solid/configs/typescript'

// biome-ignore lint/style/noDefaultExport: ESLint configs use default exports
export default [
  // js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    ...solid,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: 'tsconfig.json',
      },
    },
  },
]
