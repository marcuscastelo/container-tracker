import { describe, expect, it } from 'vitest'
import {
  buildCoveragePolicyReport,
  createBaselineSnapshot,
  renderCoveragePolicyMarkdown,
} from '../coverage-policy-report.mjs'

const CWD = '/repo'

const scope = {
  coverage: {
    include: [
      'src/modules/process/**/*.{ts,tsx,js,mjs}',
      'src/modules/container/**/*.{ts,tsx,js,mjs}',
      'src/modules/tracking/**/*.{ts,tsx,js,mjs}',
      'src/capabilities/**/*.{ts,tsx,js,mjs}',
      'src/shared/**/*.{ts,tsx,js,mjs}',
    ],
    exclude: ['**/tests/**', '**/*.test.*', '**/fixtures/**', 'src/modules/tracking/dev/**'],
  },
  modules: {
    process: ['src/modules/process/'],
    container: ['src/modules/container/'],
    tracking: ['src/modules/tracking/'],
    capabilities: ['src/capabilities/'],
    shared: ['src/shared/'],
  },
  layers: {
    domain: { segments: ['/domain/'], prefixes: [] },
    application: { segments: ['/application/'], prefixes: [] },
    infrastructure: {
      segments: ['/infrastructure/'],
      prefixes: ['src/shared/config/', 'src/shared/observability/', 'src/shared/supabase/'],
    },
    'interface/http': {
      segments: ['/interface/http/'],
      prefixes: ['src/shared/api/', 'src/shared/api-schemas/'],
    },
    ui: {
      segments: ['/ui/'],
      prefixes: ['src/shared/ui/'],
    },
  },
  trackingCritical: {
    observation: ['src/modules/tracking/features/observation/'],
    series: ['src/modules/tracking/features/series/'],
    timeline: ['src/modules/tracking/features/timeline/'],
    status: ['src/modules/tracking/features/status/'],
    alerts: ['src/modules/tracking/features/alerts/'],
  },
}

function makeCoverageEntry(filePath, overrides = {}) {
  return {
    path: filePath,
    statementMap: overrides.statementMap ?? {
      0: { start: { line: 1 }, end: { line: 1 } },
      1: { start: { line: 2 }, end: { line: 2 } },
    },
    s: overrides.s ?? {
      0: 1,
      1: 0,
    },
    branchMap: overrides.branchMap ?? {
      0: {
        line: 1,
        type: 'if',
        locations: [{ start: { line: 1 } }, { start: { line: 1 } }],
      },
    },
    b: overrides.b ?? {
      0: [1, 0],
    },
    fnMap: overrides.fnMap ?? {
      0: {
        name: 'fn0',
        decl: { start: { line: 1 }, end: { line: 1 } },
        loc: { start: { line: 1 }, end: { line: 2 } },
      },
    },
    f: overrides.f ?? {
      0: 1,
    },
  }
}

describe('buildCoveragePolicyReport', () => {
  it('aggregates module, layer and tracking-critical buckets from scoped coverage data', () => {
    const coverageMap = {
      processDomain: makeCoverageEntry(`${CWD}/src/modules/process/domain/process.entity.ts`),
      sharedApi: makeCoverageEntry(`${CWD}/src/shared/api/respondWithSchema.ts`, {
        s: { 0: 1, 1: 1 },
        b: { 0: [1, 1] },
      }),
      trackingStatus: makeCoverageEntry(
        `${CWD}/src/modules/tracking/features/status/domain/derive/deriveStatus.ts`,
        {
          s: { 0: 1, 1: 1 },
          b: { 0: [1, 1] },
        },
      ),
      sharedUtils: makeCoverageEntry(`${CWD}/src/shared/utils/normalizeTimestamptz.ts`, {
        s: { 0: 0, 1: 0 },
        b: { 0: [0, 0] },
        f: { 0: 0 },
      }),
      excludedTrackingDev: makeCoverageEntry(
        `${CWD}/src/modules/tracking/dev/scenario-lab/scenario.seed.ts`,
      ),
      outOfScopeRoute: makeCoverageEntry(`${CWD}/src/routes/api/processes.ts`),
    }

    const report = buildCoveragePolicyReport({
      cwd: CWD,
      coverageMap,
      scope,
      coverageFile: 'coverage/vitest/coverage-final.json',
      scopePath: 'docs/plans/coverage-scope.json',
      baselinePath: 'docs/plans/coverage-baseline.json',
    })

    expect(report.summary.scopedFileCount).toBe(4)
    expect(report.modules.process.fileCount).toBe(1)
    expect(report.modules.tracking.fileCount).toBe(1)
    expect(report.modules.shared.fileCount).toBe(2)
    expect(report.layers.domain.fileCount).toBe(2)
    expect(report.layers['interface/http'].fileCount).toBe(1)
    expect(report.layers.unclassified.fileCount).toBe(1)
    expect(report.trackingCritical.status.fileCount).toBe(1)
    expect(report.unclassified.files).toEqual(['src/shared/utils/normalizeTimestamptz.ts'])
    expect(report.global.branches.total).toBe(8)
    expect(report.global.branches.covered).toBe(5)
    expect(report.global.branches.pct).toBe(62.5)
  })

  it('computes deltas against an existing baseline snapshot', () => {
    const currentReport = buildCoveragePolicyReport({
      cwd: CWD,
      coverageMap: {
        trackingStatus: makeCoverageEntry(
          `${CWD}/src/modules/tracking/features/status/domain/derive/deriveStatus.ts`,
          {
            s: { 0: 1, 1: 1 },
            b: { 0: [1, 1] },
          },
        ),
      },
      scope,
      coverageFile: 'coverage/vitest/coverage-final.json',
      scopePath: 'docs/plans/coverage-scope.json',
      baselinePath: 'docs/plans/coverage-baseline.json',
    })

    const baseline = createBaselineSnapshot(currentReport)
    baseline.global.branches.pct = 60
    baseline.modules.tracking.branches.pct = 60
    baseline.layers.domain.branches.pct = 60
    baseline.trackingCritical.status.branches.pct = 60

    const reportWithDelta = buildCoveragePolicyReport({
      cwd: CWD,
      coverageMap: {
        trackingStatus: makeCoverageEntry(
          `${CWD}/src/modules/tracking/features/status/domain/derive/deriveStatus.ts`,
          {
            s: { 0: 1, 1: 1 },
            b: { 0: [1, 1] },
          },
        ),
      },
      scope,
      baseline,
      coverageFile: 'coverage/vitest/coverage-final.json',
      scopePath: 'docs/plans/coverage-scope.json',
      baselinePath: 'docs/plans/coverage-baseline.json',
    })

    expect(reportWithDelta.summary.baselineStatus).toBe('present')
    expect(reportWithDelta.delta.global.branches).toBe(40)
    expect(reportWithDelta.delta.modules.tracking.branches).toBe(40)
    expect(reportWithDelta.delta.layers.domain.branches).toBe(40)
    expect(reportWithDelta.delta.trackingCritical.status.branches).toBe(40)
  })

  it('renders unclassified output explicitly in markdown', () => {
    const report = buildCoveragePolicyReport({
      cwd: CWD,
      coverageMap: {
        sharedUtils: makeCoverageEntry(`${CWD}/src/shared/utils/normalizeTimestamptz.ts`, {
          s: { 0: 0, 1: 0 },
          b: { 0: [0, 0] },
          f: { 0: 0 },
        }),
      },
      scope,
      coverageFile: 'coverage/vitest/coverage-final.json',
      scopePath: 'docs/plans/coverage-scope.json',
      baselinePath: 'docs/plans/coverage-baseline.json',
    })

    const markdown = renderCoveragePolicyMarkdown(report)

    expect(markdown).toContain('## Unclassified')
    expect(markdown).toContain('`src/shared/utils/normalizeTimestamptz.ts`')
    expect(markdown).toContain('unclassified')
  })
})
