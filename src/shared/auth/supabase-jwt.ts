import { createHmac } from 'node:crypto'

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function maybeDecodeBase64Secret(secret: string): Buffer | null {
  const normalized = secret.replace(/\s+/gu, '')
  if (normalized.length === 0 || normalized.length % 4 === 1) {
    return null
  }

  const decoded = Buffer.from(normalized, 'base64')
  if (decoded.length === 0) {
    return null
  }

  const normalizedInput = normalized.replace(/=+$/u, '')
  const normalizedDecoded = decoded.toString('base64').replace(/=+$/u, '')
  if (normalizedInput !== normalizedDecoded) {
    return null
  }

  return decoded
}

function signHs256(value: string, secret: string): string {
  const key = maybeDecodeBase64Secret(secret) ?? secret
  return createHmac('sha256', key).update(value).digest('base64url')
}

type SupabaseJwtPayload = {
  readonly sub: string
  readonly role: 'authenticated'
  readonly email: string
  readonly aud: 'authenticated'
  readonly iss: string
  readonly iat: number
  readonly exp: number
}

export type IssuedSupabaseJwt = {
  readonly accessToken: string
  readonly expiresAt: string
}

export function issueSupabaseJwt(command: {
  readonly userId: string
  readonly email: string
  readonly secret: string
  readonly issuer: string
  readonly expiresInSec: number
}): IssuedSupabaseJwt {
  const nowSec = Math.floor(Date.now() / 1000)
  const exp = nowSec + command.expiresInSec

  const payload: SupabaseJwtPayload = {
    sub: command.userId,
    role: 'authenticated',
    email: command.email,
    aud: 'authenticated',
    iss: command.issuer,
    iat: nowSec,
    exp,
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signHs256(`${encodedHeader}.${encodedPayload}`, command.secret)

  return {
    accessToken: `${encodedHeader}.${encodedPayload}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  }
}
