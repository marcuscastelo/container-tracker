import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.hoisted(() => vi.fn())
const locationState = vi.hoisted(() => ({
  pathname: '/auth/login',
  search: '?return_to=%2Fshipments%2F123',
}))
const authEntryScreenMock = vi.hoisted(() => vi.fn((_props: unknown) => null))
const getWorkosUserMock = vi.hoisted(() => vi.fn(async () => null))
const startWorkosSignInMock = vi.hoisted(() => vi.fn(async () => undefined))
const startWorkosSignUpMock = vi.hoisted(() => vi.fn(async () => undefined))
const getWorkosAccessTokenMock = vi.hoisted(() => vi.fn(async () => 'token'))
const startWorkosSignOutMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('solid-js', async () => {
  const actual = await vi.importActual<typeof import('solid-js')>('solid-js')
  return {
    ...actual,
    onMount: (callback: () => void) => callback(),
  }
})

vi.mock('@solidjs/router', async () => {
  const actual = await vi.importActual<typeof import('@solidjs/router')>('@solidjs/router')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => locationState,
  }
})

vi.mock('~/modules/auth/ui/AuthEntryScreen', () => ({
  AuthEntryScreen: (props: unknown) => {
    return authEntryScreenMock(props)
  },
}))

vi.mock('~/shared/auth/workos-auth.client', () => ({
  getWorkosUser: getWorkosUserMock,
  startWorkosSignIn: startWorkosSignInMock,
  startWorkosSignUp: startWorkosSignUpMock,
  getWorkosAccessToken: getWorkosAccessTokenMock,
  startWorkosSignOut: startWorkosSignOutMock,
  WorkosAuthClientError: class extends Error {
    readonly code: string

    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

function getPrimaryLabel(value: unknown): string {
  if (typeof value !== 'object' || value === null || !('primaryLabel' in value)) {
    throw new Error('missing primaryLabel')
  }
  const propValue = value.primaryLabel
  if (typeof propValue !== 'string') {
    throw new Error('primaryLabel not string')
  }
  return propValue
}

function getSecondaryLabel(value: unknown): string {
  if (typeof value !== 'object' || value === null || !('secondaryLabel' in value)) {
    throw new Error('missing secondaryLabel')
  }
  const propValue = value.secondaryLabel
  if (typeof propValue !== 'string') {
    throw new Error('secondaryLabel not string')
  }
  return propValue
}

function getSecondaryHref(value: unknown): string {
  if (typeof value !== 'object' || value === null || !('secondaryHref' in value)) {
    throw new Error('missing secondaryHref')
  }
  const propValue = value.secondaryHref
  if (typeof propValue !== 'string') {
    throw new Error('secondaryHref not string')
  }
  return propValue
}

function getPrimaryAction(value: unknown): () => void {
  if (typeof value !== 'object' || value === null || !('onPrimaryAction' in value)) {
    throw new Error('missing onPrimaryAction')
  }
  const action = value.onPrimaryAction
  if (typeof action !== 'function') {
    throw new Error('onPrimaryAction is not function')
  }
  return () => {
    action()
  }
}

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    locationState.pathname = '/auth/login'
    locationState.search = '?return_to=%2Fshipments%2F123'
  })

  it('login route renders CTAs and starts sign-in', async () => {
    const module = await import('~/routes/auth/login')
    module.default()

    const call = authEntryScreenMock.mock.calls[0]
    if (!call) {
      throw new Error('AuthEntryScreen not called')
    }
    const props = call[0]
    expect(getPrimaryLabel(props)).toBe('Entrar')
    expect(getSecondaryLabel(props)).toBe('Solicitar abertura de conta')
    expect(getSecondaryHref(props)).toBe('/auth/signup?return_to=%2Fshipments%2F123')

    const onPrimaryAction = getPrimaryAction(props)
    onPrimaryAction()

    expect(startWorkosSignInMock).toHaveBeenCalledWith('/shipments/123')
  })

  it('signup route renders CTAs and does not call workos sign-up', async () => {
    locationState.pathname = '/auth/signup'
    locationState.search = '?return_to=%2Faccess'

    const module = await import('~/routes/auth/signup')
    module.default()

    const call = authEntryScreenMock.mock.calls[0]
    if (!call) {
      throw new Error('AuthEntryScreen not called')
    }
    const props = call[0]
    expect(getPrimaryLabel(props)).toBe('Solicitar abertura de conta')
    expect(getSecondaryLabel(props)).toBe('Já tenho conta')
    expect(getSecondaryHref(props)).toBe('/auth/login?return_to=%2Faccess')

    const onPrimaryAction = getPrimaryAction(props)
    onPrimaryAction()

    expect(startWorkosSignUpMock).not.toHaveBeenCalled()
  })

  it('callback route redirects to resolved return_to', async () => {
    locationState.pathname = '/auth/callback'
    locationState.search =
      '?state=%7B%22returnTo%22%3A%22%2Fshipments%2F123%22%7D&return_to=%2Faccess'

    const module = await import('~/routes/auth/callback')
    module.default()
    await Promise.resolve()

    expect(getWorkosAccessTokenMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/shipments/123', { replace: true })
  })

  it('login route forwards nested callback code to /auth/callback', async () => {
    locationState.pathname = '/auth/login'
    locationState.search =
      '?return_to=%2F%3Fcode%3D01KPMKJF07YTSZDDCG27SPB620%26state%3D%257B%2522returnTo%2522%253A%2522%252F%2522%257D'

    const module = await import('~/routes/auth/login')
    module.default()

    expect(navigateMock).toHaveBeenCalledWith(
      '/auth/callback?code=01KPMKJF07YTSZDDCG27SPB620&state=%7B%22returnTo%22%3A%22%2F%22%7D',
      { replace: true },
    )
  })
})
