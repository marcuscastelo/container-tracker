import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import { issueSupabaseJwt } from '~/shared/auth/supabase-jwt'

const JwtPayloadSchema = z.object({
  exp: z.number().int(),
  sub: z.string().uuid(),
})

function decodePayload(token: string): { readonly exp: number; readonly sub: string } {
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
    expect(payload.exp).toBeGreaterThan(0)
    expect(issued.expiresAt).toContain('T')
  })
})
