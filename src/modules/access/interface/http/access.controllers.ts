import type { AccessUseCases } from '~/modules/access/application/access.usecases'
import {
  AccessOverviewQuerySchema,
  BridgeSessionBodySchema,
  CreateImporterBodySchema,
  CreateTenantBodySchema,
  UpsertMembershipBodySchema,
} from '~/modules/access/interface/http/access.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import { HttpError } from '~/shared/errors/httpErrors'

function getBearerToken(authorization: string | null): string | null {
  if (!authorization) return null
  const [scheme, token] = authorization.trim().split(/\s+/u)
  if (scheme !== 'Bearer' || !token) return null
  return token
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new HttpError('Invalid JSON payload', 400)
  }
}

export function createAccessControllers(deps: { readonly accessUseCases: AccessUseCases }) {
  async function listOverview({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsed = AccessOverviewQuerySchema.safeParse({
        platform_tenant_id: url.searchParams.get('platform_tenant_id') ?? undefined,
      })
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const accessToken = getBearerToken(request.headers.get('authorization'))
      const overview = await deps.accessUseCases.listOverview(
        parsed.data.platform_tenant_id ?? null,
        accessToken,
      )
      return jsonResponse(overview, 200)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function createTenant({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const raw = await parseJsonBody(request)
      const parsed = CreateTenantBodySchema.safeParse(raw)
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const tenant = await deps.accessUseCases.createTenant({
        slug: parsed.data.slug,
        name: parsed.data.name,
        status: parsed.data.status,
      })
      return jsonResponse({ tenant }, 201)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function createImporter({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const raw = await parseJsonBody(request)
      const parsed = CreateImporterBodySchema.safeParse(raw)
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      await deps.accessUseCases.createImporter({
        platformTenantId: parsed.data.platform_tenant_id,
        name: parsed.data.name,
        taxId: parsed.data.tax_id ?? null,
        status: parsed.data.status,
      })
      return jsonResponse({ ok: true }, 201)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function upsertMembership({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const raw = await parseJsonBody(request)
      const parsed = UpsertMembershipBodySchema.safeParse(raw)
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const result = await deps.accessUseCases.upsertMembershipAndScope({
        workosUserId: parsed.data.workos_user_id,
        email: parsed.data.email,
        platformTenantId: parsed.data.platform_tenant_id,
        roleCode: parsed.data.role_code,
        status: parsed.data.status,
        importerIds: parsed.data.importer_ids,
      })

      return jsonResponse(result, 200)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function bridgeSession({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const raw = await parseJsonBody(request)
      const parsed = BridgeSessionBodySchema.safeParse(raw)
      if (!parsed.success) {
        return jsonResponse({ error: parsed.error.message }, 400)
      }

      const result = await deps.accessUseCases.bridgeSession({
        workosUserId: parsed.data.workos_user_id,
        email: parsed.data.email,
        platformTenantId: parsed.data.platform_tenant_id ?? null,
        expiresInSec: parsed.data.expires_in_sec,
      })

      return jsonResponse(
        {
          access_token: result.token.accessToken,
          token_type: 'bearer',
          expires_at: result.token.expiresAt,
          user_id: result.user.id,
        },
        200,
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  return {
    listOverview,
    createTenant,
    createImporter,
    upsertMembership,
    bridgeSession,
  }
}
