import { createClient, LoginRequiredError, type User } from '@workos-inc/authkit-js'

type AuthKitClient = Awaited<ReturnType<typeof createClient>>

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
  return {
    clientId: getEnvString(import.meta.env.VITE_PUBLIC_WORKOS_CLIENT_ID),
    apiHostname: getEnvString(import.meta.env.VITE_PUBLIC_WORKOS_API_HOSTNAME),
    redirectUri: getEnvString(import.meta.env.VITE_PUBLIC_WORKOS_REDIRECT_URI),
  }
}

export function isWorkosAuthConfigured(): boolean {
  const config = getWorkosConfig()
  return config.clientId !== null
}

async function getAuthKitClient(): Promise<AuthKitClient> {
  const config = getWorkosConfig()
  if (!config.clientId) {
    throw new Error('Missing VITE_PUBLIC_WORKOS_CLIENT_ID for AuthKit client setup')
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
  const client = await getAuthKitClient()
  return client.getAccessToken()
}

export async function getWorkosUser(): Promise<User | null> {
  const client = await getAuthKitClient()
  return client.getUser()
}

export async function startWorkosSignIn(returnTo?: string): Promise<void> {
  const client = await getAuthKitClient()
  await client.signIn({
    state: {
      returnTo: returnTo ?? '/',
    },
  })
}

export async function startWorkosSignOut(returnTo?: string): Promise<void> {
  const client = await getAuthKitClient()
  await client.signOut({
    returnTo: returnTo ?? '/',
  })
}

export async function ensureWorkosAuthenticated(returnTo?: string): Promise<void> {
  const client = await getAuthKitClient()
  try {
    await client.getAccessToken()
  } catch (error) {
    if (error instanceof LoginRequiredError) {
      await client.signIn({
        state: {
          returnTo: returnTo ?? '/',
        },
      })
      return
    }
    throw error
  }
}
