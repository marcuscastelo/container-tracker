import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import { issueSupabaseJwt } from '~/shared/auth/supabase-jwt'

const JwtPayloadSchema = z.object({
  iat: z.number().int(),
  exp: z.number().int(),
  sub: z.string().uuid(),
})

function decodePayload(token: string): {
  readonly iat: number
  readonly exp: number
  readonly sub: string
} {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) {
    throw new Error('invalid token format')
  }
  const payloadPart = parts[1]
  const json = Buffer.from(payloadPart, 'base64url').toString('utf8')
  return JwtPayloadSchema.parse(JSON.parse(json))
}

describe('issueSupabaseJwt', () => {
  it('issues HS256 token with expected claims', () => {
    const issued = issueSupabaseJwt({
      userId: '00000000-0000-4000-8000-000000000123',
      email: 'user@example.com',
      secret: 'test-secret',
      issuer: 'container-tracker/access-bridge',
      expiresInSec: 3600,
    })

    const payload = decodePayload(issued.accessToken)

    expect(payload.sub).toBe('00000000-0000-4000-8000-000000000123')
    expect(payload.exp - payload.iat).toBe(3600)
    expect(issued.expiresAt).toContain('T')
  })

  it('decodes base64 encoded secret before signing', () => {
    const secretBytes = Buffer.from('a-deterministic-secret-for-tests-1234567890', 'utf8')
    const base64Secret = secretBytes.toString('base64')
    const issued = issueSupabaseJwt({
      userId: '00000000-0000-4000-8000-000000000123',
      email: 'user@example.com',
      secret: base64Secret,
      issuer: 'container-tracker/access-bridge',
      expiresInSec: 300,
    })

    const parts = issued.accessToken.split('.')
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      throw new Error('invalid token format')
    }
    const expectedSignature = createHmac('sha256', secretBytes)
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64url')

    expect(parts[2]).toBe(expectedSignature)
  })
})
