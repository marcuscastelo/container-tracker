// import js from '@eslint/js'

import platformConfig from '@marcuscastelo/eslint-config/solid'
import { containerTrackerEslintPlugin } from '#container-tracker-eslint-plugin'

const moduleApplicationFiles = [
  'src/modules/*/application/**/*.{ts,tsx}',
  'src/modules/*/features/*/application/**/*.{ts,tsx}',
]

const trackingModuleApplicationFiles = [
  'src/modules/tracking/application/**/*.{ts,tsx}',
  'src/modules/tracking/features/*/application/**/*.{ts,tsx}',
]

const moduleUiFiles = [
  'src/modules/*/ui/**/*.{ts,tsx}',
  'src/modules/*/features/*/ui/**/*.{ts,tsx}',
]

const trackingModuleUiFiles = [
  'src/modules/tracking/ui/**/*.{ts,tsx}',
  'src/modules/tracking/features/*/ui/**/*.{ts,tsx}',
]

const moduleUiComponentFiles = [
  'src/modules/*/ui/components/**/*.{ts,tsx}',
  'src/modules/*/features/*/ui/components/**/*.{ts,tsx}',
]

const trackingModuleUiComponentFiles = [
  'src/modules/tracking/ui/components/**/*.{ts,tsx}',
  'src/modules/tracking/features/*/ui/components/**/*.{ts,tsx}',
]

const moduleUiPageFiles = [
  'src/modules/*/ui/screens/**/*.{ts,tsx}',
  'src/modules/*/ui/routes/**/*.{ts,tsx}',
  'src/modules/*/ui/pages/**/*.{ts,tsx}',
  'src/modules/*/ui/*View.tsx',
  'src/modules/*/ui/*Dialog.tsx',
  'src/modules/*/ui/**/index.tsx',
  'src/modules/*/features/*/ui/screens/**/*.{ts,tsx}',
  'src/modules/*/features/*/ui/routes/**/*.{ts,tsx}',
  'src/modules/*/features/*/ui/pages/**/*.{ts,tsx}',
  'src/modules/*/features/*/ui/*View.tsx',
  'src/modules/*/features/*/ui/*Dialog.tsx',
  'src/modules/*/features/*/ui/**/index.tsx',
]

const trackingModuleUiPageFiles = [
  'src/modules/tracking/ui/screens/**/*.{ts,tsx}',
  'src/modules/tracking/ui/routes/**/*.{ts,tsx}',
  'src/modules/tracking/ui/pages/**/*.{ts,tsx}',
  'src/modules/tracking/ui/*View.tsx',
  'src/modules/tracking/ui/*Dialog.tsx',
  'src/modules/tracking/ui/**/index.tsx',
  'src/modules/tracking/features/*/ui/screens/**/*.{ts,tsx}',
  'src/modules/tracking/features/*/ui/routes/**/*.{ts,tsx}',
  'src/modules/tracking/features/*/ui/pages/**/*.{ts,tsx}',
  'src/modules/tracking/features/*/ui/*View.tsx',
  'src/modules/tracking/features/*/ui/*Dialog.tsx',
  'src/modules/tracking/features/*/ui/**/index.tsx',
]

const nonModuleUiFiles = ['src/capabilities/*/ui/**/*.{ts,tsx}', 'src/shared/ui/**/*.{ts,tsx}']

const nonModuleUiComponentFiles = [
  'src/capabilities/*/ui/components/**/*.{ts,tsx}',
  'src/shared/ui/**/*.{ts,tsx}',
]

const nonModuleUiPageFiles = [
  'src/capabilities/*/ui/screens/**/*.{ts,tsx}',
  'src/capabilities/*/ui/routes/**/*.{ts,tsx}',
  'src/capabilities/*/ui/pages/**/*.{ts,tsx}',
  'src/capabilities/*/ui/*View.tsx',
  'src/capabilities/*/ui/*Dialog.tsx',
  'src/capabilities/*/ui/**/index.tsx',
  'src/capabilities/search/ui/SearchOverlay.tsx',
]

const moduleDomainFiles = [
  'src/modules/*/domain/**/*.{ts,tsx}',
  'src/modules/*/features/*/domain/**/*.{ts,tsx}',
]

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

const trackingInterpretationRestrictedPaths = [
  {
    name: '~/modules/tracking/domain/derive/deriveTimeline',
    importNames: ['deriveTimeline'],
    message:
      'Tracking interpretation must stay inside src/modules/tracking/**. Consume tracking read-model outputs instead.',
  },
  {
    name: '~/modules/tracking/features/timeline/domain/derive/deriveTimeline',
    importNames: ['deriveTimeline'],
    message:
      'Tracking interpretation must stay inside src/modules/tracking/**. Consume tracking read-model outputs instead.',
  },
  {
    name: '~/modules/tracking/domain/derive/deriveStatus',
    importNames: ['deriveStatus'],
    message:
      'Tracking interpretation must stay inside src/modules/tracking/**. Consume tracking read-model outputs instead.',
  },
  {
    name: '~/modules/tracking/features/status/domain/derive/deriveStatus',
    importNames: ['deriveStatus'],
    message:
      'Tracking interpretation must stay inside src/modules/tracking/**. Consume tracking read-model outputs instead.',
  },
  {
    name: '~/modules/tracking/domain/derive/deriveAlerts',
    importNames: ['deriveAlerts'],
    message:
      'Tracking interpretation must stay inside src/modules/tracking/**. Consume tracking read-model outputs instead.',
  },
  {
    name: '~/modules/tracking/features/alerts/domain/derive/deriveAlerts',
    importNames: ['deriveAlerts'],
    message:
      'Tracking interpretation must stay inside src/modules/tracking/**. Consume tracking read-model outputs instead.',
  },
  {
    name: '~/modules/tracking/application/projection/tracking.series.classification',
    importNames: ['classifyTrackingSeries'],
    message:
      'Tracking interpretation must stay inside src/modules/tracking/**. Consume tracking read-model outputs instead.',
  },
  {
    name: '~/modules/tracking/features/series/application/projection/tracking.series.classification',
    importNames: ['classifyTrackingSeries'],
    message:
      'Tracking interpretation must stay inside src/modules/tracking/**. Consume tracking read-model outputs instead.',
  },
]

const trackingReadModelRestrictedPaths = [
  {
    name: '~/modules/tracking/application/projection/tracking.timeline.readmodel',
    importNames: ['deriveTimelineWithSeriesReadModel'],
    message:
      'UI must not derive timeline semantics; consume timeline read-model output from backend responses.',
  },
  {
    name: '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel',
    importNames: ['deriveTimelineWithSeriesReadModel'],
    message:
      'UI must not derive timeline semantics; consume timeline read-model output from backend responses.',
  },
]

const createRestrictedImportsRule = ({ patterns = [], paths = [] } = {}) => [
  'error',
  {
    ...(patterns.length > 0 ? { patterns } : {}),
    ...(paths.length > 0 ? { paths } : {}),
  },
]

const moduleBoundaryRestrictedPatterns = [
  {
    group: ['~/capabilities/**'],
    message: 'Modules must not depend on capabilities.',
  },
]

const apiRouteRestrictedPatterns = [
  {
    group: ['~/modules/*/application/**', '~/modules/*/domain/**', '~/modules/*/infrastructure/**'],
    message: 'API routes must be thin adapters and depend only on interface/http controllers.',
  },
  {
    group: [
      '~/capabilities/*/application/**',
      '~/capabilities/*/domain/**',
      '~/capabilities/*/infrastructure/**',
      '~/capabilities/*/ui/**',
    ],
    message: 'API routes must use capability interface/http adapters instead of internal layers.',
  },
]

const applicationLayerRestrictedPatterns = [
  {
    group: ['~/shared/ui/**'],
    message: 'Application layer must not import UI types/components from shared/ui.',
  },
  {
    group: ['~/shared/api-schemas/**'],
    message: 'Application layer must not depend on HTTP DTO schemas from shared/api-schemas.',
  },
]

const moduleApplicationRestrictedPatterns = [
  ...moduleBoundaryRestrictedPatterns,
  ...applicationLayerRestrictedPatterns,
]

const uiValidationRestrictedPattern = {
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
}

const uiPageSchemaRestrictedPattern = {
  group: ['~/shared/api-schemas/**', '**/*schema*'],
  message: 'Pages-like UI files must delegate schema parsing to ui/validation or interface/http.',
}

const moduleUiRestrictedPatterns = [
  ...moduleBoundaryRestrictedPatterns,
  ...uiCoreRestrictedPatterns,
]

const moduleUiComponentRestrictedPatterns = [
  ...moduleUiRestrictedPatterns,
  uiValidationRestrictedPattern,
]

const nonModuleUiComponentRestrictedPatterns = [
  ...uiCoreRestrictedPatterns,
  uiValidationRestrictedPattern,
]

const moduleUiPageRestrictedPatterns = [
  ...moduleUiRestrictedPatterns,
  uiPageSchemaRestrictedPattern,
]

const nonModuleUiPageRestrictedPatterns = [
  ...uiCoreRestrictedPatterns,
  uiPageSchemaRestrictedPattern,
]

const capabilityRestrictedPatterns = [
  {
    group: ['~/modules/*/domain/**'],
    message: 'Capabilities can orchestrate modules, but must not import modules domain directly.',
  },
  {
    group: ['~/modules/*/infrastructure/**'],
    message:
      'Capabilities must not import module infrastructure directly; compose through application contracts.',
  },
]

const domainLayerRestrictedPatterns = [
  ...moduleBoundaryRestrictedPatterns,
  {
    group: ['~/modules/*/interface/**', '~/shared/ui/**', '~/routes/**'],
    message: 'Domain layer must not depend on interface/http, shared UI, or routes.',
  },
  {
    group: ['~/modules/*/application/**'],
    message: 'Domain layer must not depend on application layer.',
  },
]

const uiTrackingRestrictedPaths = [
  ...trackingReadModelRestrictedPaths,
  ...trackingInterpretationRestrictedPaths,
]

// biome-ignore lint/style/noDefaultExport: ESLint configs use default exports
export default [
  ...platformConfig,
  {
    ignores: [
      '.output/**',
      '.vinxi/**',
      'tools/ralph-loop/**',
      '.ralph-loop/**',
      'packaging/arch/src/agent-app/**',
    ],
  },
  {
    plugins: {
      'container-tracker': containerTrackerEslintPlugin,
    },
  },

  // TODO: move to shared plugin + platform config
  {
    files: ['src/modules/**/ui/**/*.{ts,tsx}'],
    rules: {
      'container-tracker/no-iife-in-jsx': 'warn',
    },
  },
  // TODO: move to shared plugin + platform config
  {
    files: [
      'src/modules/*/ui/**/*.tsx',
      'src/modules/*/features/*/ui/**/*.tsx',
      'src/capabilities/*/ui/**/*.tsx',
      'src/shared/ui/**/*.tsx',
    ],
    rules: {
      'container-tracker/no-jsx-short-circuit': 'error',
      'container-tracker/no-jsx-ternary': 'error',
    },
  },

  // --- App Only --- (DO NOT MOVE TO PLATFORM)
  {
    files: ['src/routes/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: apiRouteRestrictedPatterns,
        paths: trackingInterpretationRestrictedPaths,
      }),
    },
  },
  {
    files: ['src/routes/**/*.{ts,tsx}'],
    ignores: ['src/routes/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        paths: trackingInterpretationRestrictedPaths,
      }),
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    ignores: ['src/shared/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        paths: trackingInterpretationRestrictedPaths,
      }),
    },
  },
  {
    files: ['src/modules/**/*.{ts,tsx}'],
    ignores: [...moduleApplicationFiles, ...moduleUiFiles, ...moduleDomainFiles],
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: moduleBoundaryRestrictedPatterns,
      }),
    },
  },
  {
    files: trackingModuleApplicationFiles,
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: moduleApplicationRestrictedPatterns,
      }),
    },
  },
  {
    files: moduleApplicationFiles,
    ignores: trackingModuleApplicationFiles,
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: moduleApplicationRestrictedPatterns,
        paths: trackingInterpretationRestrictedPaths,
      }),
    },
  },
  {
    files: trackingModuleUiFiles,
    ignores: [...trackingModuleUiComponentFiles, ...trackingModuleUiPageFiles],
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: moduleUiRestrictedPatterns,
      }),
    },
  },
  {
    files: moduleUiFiles,
    ignores: [...trackingModuleUiFiles, ...moduleUiComponentFiles, ...moduleUiPageFiles],
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: moduleUiRestrictedPatterns,
        paths: uiTrackingRestrictedPaths,
      }),
    },
  },
  {
    files: nonModuleUiFiles,
    ignores: [...nonModuleUiComponentFiles, ...nonModuleUiPageFiles],
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: uiCoreRestrictedPatterns,
        paths: uiTrackingRestrictedPaths,
      }),
    },
  },
  {
    files: trackingModuleUiComponentFiles,
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: moduleUiComponentRestrictedPatterns,
        paths: schemaLibraryPaths,
      }),
    },
  },
  {
    files: moduleUiComponentFiles,
    ignores: trackingModuleUiComponentFiles,
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: moduleUiComponentRestrictedPatterns,
        paths: [...schemaLibraryPaths, ...uiTrackingRestrictedPaths],
      }),
    },
  },
  {
    files: nonModuleUiComponentFiles,
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: nonModuleUiComponentRestrictedPatterns,
        paths: [...schemaLibraryPaths, ...uiTrackingRestrictedPaths],
      }),
    },
  },
  {
    files: trackingModuleUiPageFiles,
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: moduleUiPageRestrictedPatterns,
        paths: schemaLibraryPaths,
      }),
    },
  },
  {
    files: moduleUiPageFiles,
    ignores: trackingModuleUiPageFiles,
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: moduleUiPageRestrictedPatterns,
        paths: [...schemaLibraryPaths, ...uiTrackingRestrictedPaths],
      }),
    },
  },
  {
    files: nonModuleUiPageFiles,
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: nonModuleUiPageRestrictedPatterns,
        paths: [...schemaLibraryPaths, ...uiTrackingRestrictedPaths],
      }),
    },
  },
  {
    files: ['src/capabilities/**/*.{ts,tsx}'],
    ignores: ['src/capabilities/*/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: capabilityRestrictedPatterns,
        paths: trackingInterpretationRestrictedPaths,
      }),
    },
  },
  {
    files: moduleDomainFiles,
    rules: {
      'no-restricted-imports': createRestrictedImportsRule({
        patterns: domainLayerRestrictedPatterns,
        paths: schemaLibraryPaths,
      }),
    },
  },

  // App-specific residual from a mixed block:
  // generic navigation restrictions moved to platformConfig;
  // DTO/entity contract restrictions stay local.
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