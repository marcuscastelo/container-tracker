import { useNavigate } from '@solidjs/router'
import { onMount } from 'solid-js'
import { startWorkosSignOut } from '~/shared/auth/workos-auth.client'

export default function AuthLogoutRoute() {
  const navigate = useNavigate()

  onMount(() => {
    void startWorkosSignOut('/')
      .then(() => navigate('/', { replace: true }))
      .catch((error: unknown) => {
        console.error('Auth logout failed', error)
        void navigate('/', { replace: true })
      })
  })

  return null
}
