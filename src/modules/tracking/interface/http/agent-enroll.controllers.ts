import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import {
  AgentEnrollRequestSchema,
  type AgentEnrollResponse,
  AgentEnrollResponseSchema,
} from '~/modules/tracking/interface/http/agent-enroll.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

type InstallerTokenRecord = {
  readonly tenantId: string
  readonly tokenHash: string
  readonly revokedAt: string | null
  readonly expiresAt: string | null
}

type EnrolledAgentRecord = {
  readonly id: string
  readonly tenantId: string
  readonly machineFingerprint: string
  readonly hostname: string
  readonly os: string
  readonly agentVersion: string
  readonly agentToken: string
  readonly intervalSec: number
  readonly limit: number
  readonly supabaseUrl: string | null
  readonly supabaseAnonKey: string | null
  readonly maerskEnabled: boolean
  readonly maerskHeadless: boolean
  readonly maerskTimeoutMs: number
  readonly maerskUserDataDir: string | null
}

type ExistingAgentRecord = EnrolledAgentRecord & {
  readonly revokedAt: string | null
}

type EnrollmentAuditEventType =
  | 'ENROLL_ATTEMPT'
  | 'ENROLL_SUCCESS'
  | 'ENROLL_FAILURE'
  | 'ENROLL_RATE_LIMITED'

type AgentEnrollAuditEvent = {
  readonly eventType: EnrollmentAuditEventType
  readonly statusCode: number
  readonly tenantId: string | null
  readonly machineFingerprint: string | null
  readonly hostname: string | null
  readonly ipAddress: string
  readonly reason: string | null
}

type AgentEnrollUnauthorizedReason =
  | 'missing_authorization_header'
  | 'invalid_authorization_scheme'
  | 'missing_bearer_token'
  | 'installer_token_not_found'
  | 'installer_token_hash_mismatch'
  | 'installer_token_revoked'
  | 'installer_token_expired'

export type AgentEnrollControllersDeps = {
  readonly findInstallerTokenByHash: (command: {
    readonly tokenHash: string
  }) => Promise<InstallerTokenRecord | null>
  readonly findAgentByFingerprint: (command: {
    readonly tenantId: string
    readonly machineFingerprint: string
  }) => Promise<ExistingAgentRecord | null>
  readonly createAgent: (command: {
    readonly tenantId: string
    readonly machineFingerprint: string
    readonly hostname: string
    readonly os: string
    readonly agentVersion: string
    readonly agentToken: string
  }) => Promise<EnrolledAgentRecord>
  readonly updateAgentEnrollmentMetadata: (command: {
    readonly agentId: string
    readonly tenantId: string
    readonly machineFingerprint: string
    readonly hostname: string
    readonly os: string
    readonly agentVersion: string
  }) => Promise<EnrolledAgentRecord>
  readonly reactivateRevokedAgentWithRotatedToken: (command: {
    readonly agentId: string
    readonly tenantId: string
    readonly machineFingerprint: string
    readonly hostname: string
    readonly os: string
    readonly agentVersion: string
    readonly agentToken: string
  }) => Promise<EnrolledAgentRecord>
  readonly emitAuditEvent: (event: AgentEnrollAuditEvent) => Promise<void>
  readonly recordAgentActivity: (command: {
    readonly agentId: string
    readonly tenantId: string
    readonly type: 'ENROLLED'
    readonly message: string
    readonly severity: 'success'
    readonly metadata: Record<string, unknown>
    readonly occurredAt?: string
  }) => Promise<void>
  readonly isRateLimited: (command: { readonly ipAddress: string }) => boolean
  readonly generateAgentToken?: () => string
}

type AgentAuthSuccess = {
  readonly ok: true
  readonly tenantId: string
}

type AgentAuthFailure = {
  readonly ok: false
  readonly reason: AgentEnrollUnauthorizedReason
}

type AgentAuthResult = AgentAuthSuccess | AgentAuthFailure

function parseBearerToken(
  authorization: string | null,
): { readonly ok: true; readonly token: string } | AgentAuthFailure {
  if (!authorization) {
    return { ok: false, reason: 'missing_authorization_header' }
  }

  const [scheme, token] = authorization.trim().split(/\s+/u)
  if (scheme !== 'Bearer') {
    return { ok: false, reason: 'invalid_authorization_scheme' }
  }

  if (!token || token.length === 0) {
    return { ok: false, reason: 'missing_bearer_token' }
  }

  return { ok: true, token }
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function isValidSha256Hex(hash: string): boolean {
  return /^[0-9a-f]{64}$/u.test(hash)
}

function safeEqualSha256Hash(left: string, right: string): boolean {
  if (!isValidSha256Hex(left) || !isValidSha256Hex(right)) return false

  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')
  if (leftBuffer.length !== rightBuffer.length) return false

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const expirationDate = new Date(expiresAt)
  if (Number.isNaN(expirationDate.getTime())) {
    return true
  }
  return expirationDate.getTime() <= Date.now()
}

function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0]?.trim()
    if (firstIp && firstIp.length > 0) return firstIp
  }

  const xRealIp = request.headers.get('x-real-ip')?.trim()
  if (xRealIp && xRealIp.length > 0) return xRealIp

  const cfConnectingIp = request.headers.get('cf-connecting-ip')?.trim()
  if (cfConnectingIp && cfConnectingIp.length > 0) return cfConnectingIp

  return 'unknown'
}

function toAgentEnrollResponse(record: EnrolledAgentRecord): AgentEnrollResponse {
  return {
    agentToken: record.agentToken,
    tenantId: record.tenantId,
    intervalSec: record.intervalSec,
    limit: record.limit,
    supabaseUrl: record.supabaseUrl ?? undefined,
    supabaseAnonKey: record.supabaseAnonKey ?? undefined,
    providers: {
      maerskEnabled: record.maerskEnabled,
      maerskHeadless: record.maerskHeadless,
      maerskTimeoutMs: record.maerskTimeoutMs,
      maerskUserDataDir: record.maerskUserDataDir ?? undefined,
    },
  }
}

function createDefaultAgentTokenGenerator(): () => string {
  return () => randomBytes(32).toString('hex')
}

async function emitAuditEventSafely(
  deps: AgentEnrollControllersDeps,
  event: AgentEnrollAuditEvent,
): Promise<void> {
  try {
    await deps.emitAuditEvent(event)
  } catch (error) {
    console.error('[agent-enroll] failed to emit audit event', {
      eventType: event.eventType,
      statusCode: event.statusCode,
      tenantId: event.tenantId,
      machineFingerprint: event.machineFingerprint,
      hostname: event.hostname,
      ipAddress: event.ipAddress,
      reason: event.reason,
      error,
    })
  }
}

async function recordAgentActivitySafely(
  deps: AgentEnrollControllersDeps,
  command: Parameters<AgentEnrollControllersDeps['recordAgentActivity']>[0],
): Promise<void> {
  try {
    await deps.recordAgentActivity(command)
  } catch (error) {
    console.error('[agent-enroll] failed to persist enrollment activity', {
      agentId: command.agentId,
      tenantId: command.tenantId,
      error,
    })
  }
}

async function ensureInstallerAuth(
  deps: AgentEnrollControllersDeps,
  authorization: string | null,
): Promise<AgentAuthResult> {
  const bearerTokenResult = parseBearerToken(authorization)
  if (!bearerTokenResult.ok) {
    return bearerTokenResult
  }

  const tokenHash = sha256Hex(bearerTokenResult.token)
  const tokenRecord = await deps.findInstallerTokenByHash({ tokenHash })
  if (!tokenRecord) {
    return {
      ok: false,
      reason: 'installer_token_not_found',
    }
  }

  if (!safeEqualSha256Hash(tokenRecord.tokenHash, tokenHash)) {
    return {
      ok: false,
      reason: 'installer_token_hash_mismatch',
    }
  }

  if (tokenRecord.revokedAt !== null) {
    return {
      ok: false,
      reason: 'installer_token_revoked',
    }
  }

  if (isExpired(tokenRecord.expiresAt)) {
    return {
      ok: false,
      reason: 'installer_token_expired',
    }
  }

  return {
    ok: true,
    tenantId: tokenRecord.tenantId,
  }
}

export function createAgentEnrollControllers(deps: AgentEnrollControllersDeps) {
  const generateAgentToken = deps.generateAgentToken ?? createDefaultAgentTokenGenerator()

  async function enroll({ request }: { request: Request }): Promise<Response> {
    const ipAddress = getClientIp(request)
    const authorization = request.headers.get('authorization')
    const rawBody: unknown = await request.json().catch(() => ({}))
    const parsedBody = AgentEnrollRequestSchema.safeParse(rawBody)

    if (!parsedBody.success) {
      await emitAuditEventSafely(deps, {
        eventType: 'ENROLL_FAILURE',
        statusCode: 400,
        tenantId: null,
        machineFingerprint: null,
        hostname: null,
        ipAddress,
        reason: 'invalid_payload',
      })
      return jsonResponse({ error: `Invalid request: ${parsedBody.error.message}` }, 400)
    }

    const requestBody = parsedBody.data

    if (deps.isRateLimited({ ipAddress })) {
      await emitAuditEventSafely(deps, {
        eventType: 'ENROLL_RATE_LIMITED',
        statusCode: 429,
        tenantId: null,
        machineFingerprint: requestBody.machineFingerprint,
        hostname: requestBody.hostname,
        ipAddress,
        reason: 'rate_limited',
      })
      return jsonResponse({ error: 'Too Many Requests' }, 429)
    }

    try {
      const installerAuth = await ensureInstallerAuth(deps, authorization)
      if (!installerAuth.ok) {
        await emitAuditEventSafely(deps, {
          eventType: 'ENROLL_FAILURE',
          statusCode: 401,
          tenantId: null,
          machineFingerprint: requestBody.machineFingerprint,
          hostname: requestBody.hostname,
          ipAddress,
          reason: installerAuth.reason,
        })
        return jsonResponse({ error: 'Unauthorized', reason: installerAuth.reason }, 401)
      }

      await emitAuditEventSafely(deps, {
        eventType: 'ENROLL_ATTEMPT',
        statusCode: 0,
        tenantId: installerAuth.tenantId,
        machineFingerprint: requestBody.machineFingerprint,
        hostname: requestBody.hostname,
        ipAddress,
        reason: null,
      })

      const existingAgent = await deps.findAgentByFingerprint({
        tenantId: installerAuth.tenantId,
        machineFingerprint: requestBody.machineFingerprint,
      })

      let enrolledAgent: EnrolledAgentRecord
      if (!existingAgent) {
        enrolledAgent = await deps.createAgent({
          tenantId: installerAuth.tenantId,
          machineFingerprint: requestBody.machineFingerprint,
          hostname: requestBody.hostname,
          os: requestBody.os,
          agentVersion: requestBody.agentVersion,
          agentToken: generateAgentToken(),
        })
      } else if (existingAgent.revokedAt === null) {
        enrolledAgent = await deps.updateAgentEnrollmentMetadata({
          agentId: existingAgent.id,
          tenantId: installerAuth.tenantId,
          machineFingerprint: requestBody.machineFingerprint,
          hostname: requestBody.hostname,
          os: requestBody.os,
          agentVersion: requestBody.agentVersion,
        })
      } else {
        enrolledAgent = await deps.reactivateRevokedAgentWithRotatedToken({
          agentId: existingAgent.id,
          tenantId: installerAuth.tenantId,
          machineFingerprint: requestBody.machineFingerprint,
          hostname: requestBody.hostname,
          os: requestBody.os,
          agentVersion: requestBody.agentVersion,
          agentToken: generateAgentToken(),
        })
      }

      const response = toAgentEnrollResponse(enrolledAgent)
      await recordAgentActivitySafely(deps, {
        agentId: enrolledAgent.id,
        tenantId: installerAuth.tenantId,
        type: 'ENROLLED',
        message: `Agent enrolled (${requestBody.hostname})`,
        severity: 'success',
        metadata: {
          hostname: requestBody.hostname,
          machineFingerprint: requestBody.machineFingerprint,
          os: requestBody.os,
          agentVersion: requestBody.agentVersion,
        },
      })
      await emitAuditEventSafely(deps, {
        eventType: 'ENROLL_SUCCESS',
        statusCode: 200,
        tenantId: installerAuth.tenantId,
        machineFingerprint: requestBody.machineFingerprint,
        hostname: requestBody.hostname,
        ipAddress,
        reason: null,
      })

      return jsonResponse(response, 200, AgentEnrollResponseSchema)
    } catch (error) {
      await emitAuditEventSafely(deps, {
        eventType: 'ENROLL_FAILURE',
        statusCode: 500,
        tenantId: null,
        machineFingerprint: requestBody.machineFingerprint,
        hostname: requestBody.hostname,
        ipAddress,
        reason: 'internal_error',
      })
      return mapErrorToResponse(error)
    }
  }

  return {
    enroll,
  }
}

export type AgentEnrollControllers = ReturnType<typeof createAgentEnrollControllers>
