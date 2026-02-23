// import js from '@eslint/js'
// biome-ignore lint/performance/noNamespaceImport: This is how ESLint configs are structured
import * as tsParser from '@typescript-eslint/parser'
import solid from 'eslint-plugin-solid/configs/typescript'

// biome-ignore lint/style/noDefaultExport: ESLint configs use default exports
export default [
  // Ignore build/output folders from linting
  {
    ignores: ['.output/**', '.vinxi/**'],
  },
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
  {
    files: ['src/routes/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '~/modules/*/application/**',
                '~/modules/*/domain/**',
                '~/modules/*/infrastructure/**',
              ],
              message:
                'API routes must be thin adapters and depend only on interface/http controllers.',
            },
            {
              group: [
                '~/capabilities/*/application/**',
                '~/capabilities/*/domain/**',
                '~/capabilities/*/infrastructure/**',
                '~/capabilities/*/ui/**',
              ],
              message:
                'API routes must use capability interface/http adapters instead of internal layers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['~/capabilities/**'],
              message: 'Modules must not depend on capabilities.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/*/application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['~/shared/ui/**'],
              message: 'Application layer must not import UI types/components from shared/ui.',
            },
            {
              group: ['~/shared/api-schemas/**'],
              message:
                'Application layer must not depend on HTTP DTO schemas from shared/api-schemas.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/modules/*/ui/**/*.{ts,tsx}',
      'src/capabilities/*/ui/**/*.{ts,tsx}',
      'src/shared/ui/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '~/modules/*/infrastructure/**',
                '~/capabilities/*/infrastructure/**',
                '~/infrastructure/**',
                '../infrastructure/**',
                '../../infrastructure/**',
                '../../../infrastructure/**',
                '../../../../infrastructure/**',
              ],
              message: 'UI layer must not import infrastructure modules.',
            },
            {
              group: ['~/shared/supabase/**'],
              message:
                'UI layer must not import shared/supabase directly. Use interface or shared/api adapters.',
            },
            {
              group: [
                '~/modules/*/domain/**',
                '~/capabilities/*/domain/**',
                '../domain/**',
                '../../domain/**',
                '../../../domain/**',
                '../../../../domain/**',
              ],
              message: 'UI layer must not import domain semantics directly.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/capabilities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['~/modules/*/domain/**'],
              message:
                'Capabilities can orchestrate modules, but must not import modules domain directly.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/*/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['~/modules/*/interface/**', '~/shared/ui/**', '~/routes/**'],
              message: 'Domain layer must not depend on interface/http, shared UI, or routes.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/process/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value=/^~\\/modules\\/(container|tracking)\\/domain\\//]',
          message: 'Cross-BC domain imports are forbidden in process module.',
        },
      ],
    },
  },
  {
    files: ['src/modules/container/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value=/^~\\/modules\\/(process|tracking)\\/domain\\//]',
          message: 'Cross-BC domain imports are forbidden in container module.',
        },
      ],
    },
  },
  {
    files: ['src/modules/tracking/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value=/^~\\/modules\\/(process|container)\\/domain\\//]',
          message: 'Cross-BC domain imports are forbidden in tracking module.',
        },
      ],
    },
  },
]
