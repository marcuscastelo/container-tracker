// import js from '@eslint/js'
// biome-ignore lint/performance/noNamespaceImport: This is how ESLint configs are structured
import * as tsParser from '@typescript-eslint/parser'
import solid from 'eslint-plugin-solid/configs/typescript'
import { containerTrackerEslintPlugin } from '#container-tracker-eslint-plugin'

const schemaLibraryPaths = [
  {
    name: 'zod',
    message:
      'Schema/validation libraries are not allowed here. Move parsing to ui/validation or interface/http.',
  },
  {
    name: 'yup',
    message:
      'Schema/validation libraries are not allowed here. Move parsing to ui/validation or interface/http.',
  },
  {
    name: 'valibot',
    message:
      'Schema/validation libraries are not allowed here. Move parsing to ui/validation or interface/http.',
  },
  {
    name: 'superstruct',
    message:
      'Schema/validation libraries are not allowed here. Move parsing to ui/validation or interface/http.',
  },
  {
    name: 'arktype',
    message:
      'Schema/validation libraries are not allowed here. Move parsing to ui/validation or interface/http.',
  },
]

const uiCoreRestrictedPatterns = [
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
]

// biome-ignore lint/style/noDefaultExport: ESLint configs use default exports
export default [
  // Ignore build/output folders from linting
  {
    ignores: ['.output/**', '.vinxi/**', 'tools/ralph-loop/**', '.ralph-loop/**'],
  },
  {
    plugins: {
      'container-tracker': containerTrackerEslintPlugin,
    },
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
    files: ['src/modules/**/ui/**/*.{ts,tsx}'],
    rules: {
      'container-tracker/no-iife-in-jsx': 'warn',
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
          patterns: uiCoreRestrictedPatterns,
        },
      ],
    },
  },
  {
    files: ['src/modules/*/ui/components/**/*.{ts,tsx}', 'src/shared/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...uiCoreRestrictedPatterns,
            {
              group: [
                '~/modules/*/ui/validation/**',
                '~/capabilities/*/ui/validation/**',
                '../validation/**',
                '../../validation/**',
                '../../../validation/**',
                '../../../../validation/**',
                '**/*schema*',
                '**/*validation*',
              ],
              message:
                'Visual components must not import schema/validation modules. Move parsing to ui/validation.',
            },
          ],
          paths: schemaLibraryPaths,
        },
      ],
      complexity: ['error', 15],
      'max-depth': ['error', 4],
      'max-nested-callbacks': ['error', 3],
    },
  },
  {
    files: [
      'src/modules/*/ui/screens/**/*.{ts,tsx}',
      'src/modules/*/ui/routes/**/*.{ts,tsx}',
      'src/modules/*/ui/pages/**/*.{ts,tsx}',
      'src/modules/*/ui/*View.tsx',
      'src/modules/*/ui/*Dialog.tsx',
      'src/capabilities/*/ui/screens/**/*.{ts,tsx}',
      'src/capabilities/*/ui/routes/**/*.{ts,tsx}',
      'src/capabilities/*/ui/pages/**/*.{ts,tsx}',
      'src/capabilities/*/ui/*View.tsx',
      'src/capabilities/*/ui/*Dialog.tsx',
      'src/**/ui/**/index.tsx',
      'src/capabilities/search/ui/SearchOverlay.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...uiCoreRestrictedPatterns,
            {
              group: ['~/shared/api-schemas/**', '**/*schema*'],
              message:
                'Pages-like UI files must delegate schema parsing to ui/validation or interface/http.',
            },
          ],
          paths: schemaLibraryPaths,
        },
      ],
      complexity: ['error', 20],
      'max-depth': ['error', 5],
      'max-nested-callbacks': ['error', 4],
    },
  },
  {
    files: [
      'src/modules/*/ui/**/*.{ts,tsx}',
      'src/capabilities/*/ui/**/*.{ts,tsx}',
      'src/shared/ui/**/*.{ts,tsx}',
    ],
    rules: {
      'max-lines-per-function': ['error', 220],
    },
  },
  {
    files: [
      'src/modules/*/ui/**/*.tsx',
      'src/capabilities/*/ui/**/*.tsx',
      'src/shared/ui/**/*.tsx',
    ],
    rules: {
      'container-tracker/no-jsx-short-circuit': 'error',
      'container-tracker/no-jsx-ternary': 'error',
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
            {
              group: ['~/modules/*/infrastructure/**'],
              message:
                'Capabilities must not import module infrastructure directly; compose through application contracts.',
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
            {
              group: ['~/modules/*/application/**'],
              message: 'Domain layer must not depend on application layer.',
            },
            {
              group: ['~/capabilities/**'],
              message: 'Domain layer must not depend on capabilities.',
            },
          ],
          paths: schemaLibraryPaths,
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
          patterns: uiCoreRestrictedPatterns,
          paths: [
            {
              name: '~/modules/tracking/application/projection/tracking.timeline.readmodel',
              importNames: ['deriveTimelineWithSeriesReadModel'],
              message:
                'UI must not derive timeline semantics; consume timeline read-model output from backend responses.',
            },
            {
              name: '~/modules/tracking/application/projection/tracking.series.classification',
              importNames: ['classifyTrackingSeries'],
              message:
                'UI must not classify tracking series; consume classified series from tracking read models.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.vm.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportNamedDeclaration > FunctionDeclaration',
          message: '*.vm.ts files must export shape/type/constants only, not behavioral functions.',
        },
        {
          selector:
            "ExportNamedDeclaration VariableDeclaration > VariableDeclarator[init.type='ArrowFunctionExpression']",
          message: '*.vm.ts files must not export behavioral arrow functions.',
        },
        {
          selector:
            "ExportNamedDeclaration VariableDeclaration > VariableDeclarator[init.type='FunctionExpression']",
          message: '*.vm.ts files must not export behavioral function expressions.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/interface/http/**', 'src/shared/api-schemas/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'TSTypeAliasDeclaration[id.name=/.*DTO$/], TSInterfaceDeclaration[id.name=/.*DTO$/], ClassDeclaration[id.name=/.*DTO$/]',
          message: 'DTO suffix is reserved for HTTP boundary types.',
        },
        {
          selector:
            'TSTypeReference[typeName.name=/^(Partial|Pick|Omit)$/] > TSTypeParameterInstantiation > TSTypeReference[typeName.name=/.*Entity$/]',
          message:
            'Partial/Pick/Omit<Entity> is forbidden for contracts; define explicit contract types.',
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
