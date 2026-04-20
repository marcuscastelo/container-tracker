import { describe, expect, it, vi } from 'vitest'

const accessHandlers = vi.hoisted(() => ({
  listOverview: vi.fn(),
  createTenant: vi.fn(),
  createImporter: vi.fn(),
  upsertMembership: vi.fn(),
  bridgeSession: vi.fn(),
}))

vi.mock('~/modules/access/interface/http/access.controllers.bootstrap', () => ({
  accessControllers: {
    listOverview: accessHandlers.listOverview,
    createTenant: accessHandlers.createTenant,
    createImporter: accessHandlers.createImporter,
    upsertMembership: accessHandlers.upsertMembership,
    bridgeSession: accessHandlers.bridgeSession,
  },
}))

import {
  POST as bridgeSessionPost,
  runtime as bridgeSessionRuntime,
} from '~/routes/api/access/bridge-session'
import { POST as importersPost, runtime as importersRuntime } from '~/routes/api/access/importers'
import {
  POST as membershipsPost,
  runtime as membershipsRuntime,
} from '~/routes/api/access/memberships'
import { GET as overviewGet, runtime as overviewRuntime } from '~/routes/api/access/overview'
import { POST as tenantsPost, runtime as tenantsRuntime } from '~/routes/api/access/tenants'

describe('access routes', () => {
  it('binds GET /api/access/overview to listOverview controller', () => {
    expect(overviewGet).toBe(accessHandlers.listOverview)
  })

  it('binds POST /api/access/tenants to createTenant controller', () => {
    expect(tenantsPost).toBe(accessHandlers.createTenant)
  })

  it('binds POST /api/access/importers to createImporter controller', () => {
    expect(importersPost).toBe(accessHandlers.createImporter)
  })

  it('binds POST /api/access/memberships to upsertMembership controller', () => {
    expect(membershipsPost).toBe(accessHandlers.upsertMembership)
  })

  it('binds POST /api/access/bridge-session to bridgeSession controller', () => {
    expect(bridgeSessionPost).toBe(accessHandlers.bridgeSession)
  })

  it('forces nodejs runtime for all /api/access routes', () => {
    expect(overviewRuntime).toBe('nodejs')
    expect(tenantsRuntime).toBe('nodejs')
    expect(importersRuntime).toBe('nodejs')
    expect(membershipsRuntime).toBe('nodejs')
    expect(bridgeSessionRuntime).toBe('nodejs')
  })
})
