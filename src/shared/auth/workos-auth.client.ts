import { createClient, LoginRequiredError, type User } from '@workos-inc/authkit-js'
import { sanitizeReturnTo } from '~/shared/auth/auth-return-to'

type AuthKitClient = Awaited<ReturnType<typeof createClient>>

export type WorkosAuthErrorCode = 'login_required' | 'config_missing' | 'network_unknown'

export class WorkosAuthClientError extends Error {
  readonly code: WorkosAuthErrorCode

  constructor(code: WorkosAuthErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

let authKitClientPromise: Promise<AuthKitClient> | null = null

function getEnvString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function getWorkosConfig(): {
  readonly clientId: string | null
  readonly apiHostname: string | null
  readonly redirectUri: string | null
} {
  const envRedirectUri = getEnvString(import.meta.env.VITE_PUBLIC_WORKOS_REDIRECT_URI)
  const fallbackRedirectUri =
    typeof globalThis.location !== 'undefined'
      ? `${globalThis.location.origin}/auth/callback`
      : null

  return {
    clientId: getEnvString(import.meta.env.VITE_PUBLIC_WORKOS_CLIENT_ID),
    apiHostname: getEnvString(import.meta.env.VITE_PUBLIC_WORKOS_API_HOSTNAME),
    redirectUri: envRedirectUri ?? fallbackRedirectUri,
  }
}

function toWorkosAuthClientError(error: unknown): WorkosAuthClientError {
  if (error instanceof WorkosAuthClientError) return error

  if (error instanceof LoginRequiredError) {
    return new WorkosAuthClientError('login_required', error.message)
  }

  if (error instanceof Error && error.message.includes('VITE_PUBLIC_WORKOS_CLIENT_ID')) {
    return new WorkosAuthClientError('config_missing', error.message)
  }

  if (error instanceof Error) {
    return new WorkosAuthClientError('network_unknown', error.message)
  }

  return new WorkosAuthClientError('network_unknown', 'Unknown WorkOS authentication error')
}

export function isWorkosAuthConfigured(): boolean {
  const config = getWorkosConfig()
  return config.clientId !== null
}

async function getAuthKitClient(): Promise<AuthKitClient> {
  const config = getWorkosConfig()
  if (!config.clientId) {
    throw new WorkosAuthClientError(
      'config_missing',
      'Missing VITE_PUBLIC_WORKOS_CLIENT_ID for AuthKit client setup',
    )
  }

  if (!authKitClientPromise) {
    const options: { apiHostname?: string; redirectUri?: string } = {}
    if (config.apiHostname) {
      options.apiHostname = config.apiHostname
    }
    if (config.redirectUri) {
      options.redirectUri = config.redirectUri
    }
    authKitClientPromise = createClient(config.clientId, options)
  }

  return authKitClientPromise
}

export async function getWorkosAccessToken(): Promise<string> {
  try {
    const client = await getAuthKitClient()
    return await client.getAccessToken()
  } catch (error) {
    throw toWorkosAuthClientError(error)
  }
}

export async function getWorkosUser(): Promise<User | null> {
  try {
    const client = await getAuthKitClient()
    return client.getUser()
  } catch (error) {
    const normalizedError = toWorkosAuthClientError(error)
    if (normalizedError.code === 'config_missing') {
      return null
    }
    throw normalizedError
  }
}

export async function startWorkosSignIn(returnTo?: string): Promise<void> {
  try {
    const client = await getAuthKitClient()
    await client.signIn({
      state: {
        returnTo: sanitizeReturnTo(returnTo),
      },
    })
  } catch (error) {
    throw toWorkosAuthClientError(error)
  }
}

export async function startWorkosSignUp(returnTo?: string): Promise<void> {
  try {
    const client = await getAuthKitClient()
    await client.signUp({
      state: {
        returnTo: sanitizeReturnTo(returnTo),
      },
    })
  } catch (error) {
    throw toWorkosAuthClientError(error)
  }
}

export async function startWorkosSignOut(returnTo?: string): Promise<void> {
  try {
    const client = await getAuthKitClient()
    await client.signOut({
      returnTo: sanitizeReturnTo(returnTo),
    })
  } catch (error) {
    throw toWorkosAuthClientError(error)
  }
}

export async function ensureWorkosAuthenticated(returnTo?: string): Promise<void> {
  try {
    const client = await getAuthKitClient()
    await client.getAccessToken()
  } catch (error) {
    const normalizedError = toWorkosAuthClientError(error)
    if (normalizedError.code === 'login_required') {
      await startWorkosSignIn(returnTo)
      return
    }
    throw normalizedError
  }
}
