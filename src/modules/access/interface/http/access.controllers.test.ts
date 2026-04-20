import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccessControllers } from '~/modules/access/interface/http/access.controllers'

const getUserMock = vi.hoisted(() => vi.fn())
const maybeSingleMock = vi.hoisted(() => vi.fn())
const eqMock = vi.hoisted(() =>
  vi.fn(() => ({
    maybeSingle: maybeSingleMock,
  })),
)
const selectMock = vi.hoisted(() =>
  vi.fn(() => ({
    eq: eqMock,
  })),
)
const fromMock = vi.hoisted(() =>
  vi.fn(() => ({
    select: selectMock,
  })),
)
const createSupabaseRequestAuthClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
)

vi.mock('~/shared/supabase/supabase.request-auth.server', () => ({
  createSupabaseRequestAuthClient: createSupabaseRequestAuthClientMock,
}))

vi.mock('~/shared/supabase/supabase.server', () => ({
  supabaseServer: {
    from: fromMock,
  },
}))

describe('createAccessControllers auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when bearer token is missing', async () => {
    const accessUseCases = {
      listOverview: vi.fn(),
      createTenant: vi.fn(),
      createImporter: vi.fn(),
      upsertMembershipAndScope: vi.fn(),
    }
    const controllers = createAccessControllers({ accessUseCases })
    const request = new Request('http://local.test/api/access/overview')

    const response = await controllers.listOverview({ request })
    expect(response.status).toBe(401)
  })

  it('returns 403 when authenticated user is not platform superadmin', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user_workos_1',
        },
      },
      error: null,
    })
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    })

    const accessUseCases = {
      listOverview: vi.fn(),
      createTenant: vi.fn(),
      createImporter: vi.fn(),
      upsertMembershipAndScope: vi.fn(),
    }
    const controllers = createAccessControllers({ accessUseCases })
    const request = new Request('http://local.test/api/access/overview', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    })

    const response = await controllers.listOverview({ request })
    expect(response.status).toBe(403)
  })

  it('returns 200 when authenticated platform superadmin requests overview', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user_workos_1',
        },
      },
      error: null,
    })
    maybeSingleMock.mockResolvedValue({
      data: {
        workos_user_id: 'user_workos_1',
        status: 'ACTIVE',
      },
      error: null,
    })

    const expectedOverview = {
      tenants: [],
      roleDefinitions: [],
      users: [],
      memberships: [],
      importers: [],
      membershipImporterAccess: [],
    }
    const accessUseCases = {
      listOverview: vi.fn().mockResolvedValue(expectedOverview),
      createTenant: vi.fn(),
      createImporter: vi.fn(),
      upsertMembershipAndScope: vi.fn(),
    }
    const controllers = createAccessControllers({ accessUseCases })
    const request = new Request('http://local.test/api/access/overview', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    })

    const response = await controllers.listOverview({ request })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expectedOverview)
  })
})
