import { describe, expect, it, vi } from 'vitest'

const updateManifestHandlers = vi.hoisted(() => ({
  getUpdateManifest: vi.fn(),
}))

vi.mock('~/modules/agent/interface/http/update-manifest.controllers.bootstrap', () => ({
  bootstrapUpdateManifestControllers: () => ({
    getUpdateManifest: updateManifestHandlers.getUpdateManifest,
  }),
}))

import { GET as updateManifestGet } from '~/routes/api/agent/update-manifest'

describe('agent update manifest route', () => {
  it('binds GET /api/agent/update-manifest to getUpdateManifest controller', () => {
    expect(updateManifestGet).toBe(updateManifestHandlers.getUpdateManifest)
  })
})
