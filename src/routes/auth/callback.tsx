import { useLocation, useNavigate } from '@solidjs/router'
import { onMount } from 'solid-js'
import { getWorkosAccessToken } from '~/shared/auth/workos-auth.client'

function resolveReturnToFromState(search: string): string {
  const params = new URLSearchParams(search)
  const stateParam = params.get('state')
  if (!stateParam) return '/'

  try {
    const parsed: unknown = JSON.parse(stateParam)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'returnTo' in parsed &&
      typeof parsed.returnTo === 'string' &&
      parsed.returnTo.length > 0
    ) {
      return parsed.returnTo
    }
  } catch (_error) {}

  return '/'
}

export default function AuthCallbackRoute() {
  const navigate = useNavigate()
  const location = useLocation()

  onMount(() => {
    const returnTo = resolveReturnToFromState(location.search)
    void getWorkosAccessToken()
      .then(() => navigate(returnTo, { replace: true }))
      .catch((error: unknown) => {
        console.error('Auth callback failed', error)
        void navigate('/', { replace: true })
      })
  })

  return null
}
