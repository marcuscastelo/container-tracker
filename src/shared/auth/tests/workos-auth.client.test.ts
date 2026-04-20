import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const signInMock = vi.hoisted(() => vi.fn(async () => undefined))
const signUpMock = vi.hoisted(() => vi.fn(async () => undefined))
const signOutMock = vi.hoisted(() => vi.fn(async () => undefined))
const getAccessTokenMock = vi.hoisted(() => vi.fn(async () => 'token'))
const getUserMock = vi.hoisted(() => vi.fn(() => null))
const createClientMock = vi.hoisted(() =>
  vi.fn(async () => ({
    signIn: signInMock,
    signUp: signUpMock,
    signOut: signOutMock,
    getAccessToken: getAccessTokenMock,
    getUser: getUserMock,
  })),
)

vi.mock('@workos-inc/authkit-js', () => {
  class LoginRequiredError extends Error {}

  return {
    createClient: createClientMock,
    LoginRequiredError,
  }
})

describe('workos auth client wrapper', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('VITE_PUBLIC_WORKOS_CLIENT_ID', 'client_test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sanitizes sign-in returnTo before calling authkit', async () => {
    const module = await import('~/shared/auth/workos-auth.client')
    await module.startWorkosSignIn('https://evil.example')

    expect(signInMock).toHaveBeenCalledTimes(1)
    expect(signInMock).toHaveBeenCalledWith({
      state: {
        returnTo: '/',
      },
    })
  })

  it('sanitizes sign-up returnTo before calling authkit', async () => {
    const module = await import('~/shared/auth/workos-auth.client')
    await module.startWorkosSignUp('/shipments/42')

    expect(signUpMock).toHaveBeenCalledTimes(1)
    expect(signUpMock).toHaveBeenCalledWith({
      state: {
        returnTo: '/shipments/42',
      },
    })
  })
})
