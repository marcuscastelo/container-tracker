import { useLocation, useNavigate } from '@solidjs/router'
import { onMount } from 'solid-js'
import { startWorkosSignIn } from '~/shared/auth/workos-auth.client'

function getReturnToFromQuery(search: string): string | undefined {
  const params = new URLSearchParams(search)
  const returnTo = params.get('return_to')
  return returnTo && returnTo.length > 0 ? returnTo : undefined
}

export default function AuthLoginRoute() {
  const navigate = useNavigate()
  const location = useLocation()

  onMount(() => {
    const returnTo = getReturnToFromQuery(location.search)
    void startWorkosSignIn(returnTo).catch((error: unknown) => {
      console.error('Auth login failed', error)
      void navigate('/', { replace: true })
    })
  })

  return null
}
