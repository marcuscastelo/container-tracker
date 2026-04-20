import { useLocation, useNavigate } from '@solidjs/router'
import { createSignal, onMount } from 'solid-js'
import { AuthEntryScreen, type AuthEntryScreenState } from '~/modules/auth/ui/AuthEntryScreen'
import {
  extractAuthCallbackSearchFromReturnTo,
  getReturnToFromQuery,
} from '~/shared/auth/auth-return-to'
import {
  getWorkosUser,
  startWorkosSignIn,
  WorkosAuthClientError,
} from '~/shared/auth/workos-auth.client'
import { useTranslation } from '~/shared/localization/i18n'

export default function AuthLoginRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t, keys } = useTranslation()
  const [state, setState] = createSignal<AuthEntryScreenState>('loading')
  const [errorCode, setErrorCode] = createSignal<string | null>(null)

  const returnTo = () => getReturnToFromQuery(location.search)
  const signupHref = () => `/auth/signup?return_to=${encodeURIComponent(returnTo())}`
  const errorMessage = () => {
    const code = errorCode()
    if (code === null) return null
    if (code === 'config_missing') return t(keys.auth.common.errorConfig)
    if (code === 'login_required') return t(keys.auth.common.errorLoginRequired)
    return t(keys.auth.common.errorNetwork)
  }

  onMount(() => {
    const callbackSearch = extractAuthCallbackSearchFromReturnTo(returnTo())
    if (callbackSearch !== null) {
      void navigate(`/auth/callback${callbackSearch}`, { replace: true })
      return
    }

    void getWorkosUser()
      .then((user) => {
        if (user) {
          void navigate(returnTo(), { replace: true })
          return
        }
        setState('ready')
      })
      .catch((error: unknown) => {
        if (error instanceof WorkosAuthClientError) {
          setErrorCode(error.code)
        } else {
          setErrorCode('network_unknown')
        }
        setState('error')
      })
  })

  const handleSignIn = () => {
    setState('loading')
    setErrorCode(null)
    void startWorkosSignIn(returnTo()).catch((error: unknown) => {
      if (error instanceof WorkosAuthClientError) {
        setErrorCode(error.code)
      } else {
        setErrorCode('network_unknown')
      }
      setState('error')
    })
  }

  return (
    <AuthEntryScreen
      title={t(keys.auth.login.title)}
      subtitle={t(keys.auth.login.subtitle)}
      primaryLabel={t(keys.auth.login.primary)}
      secondaryLabel={t(keys.auth.login.secondary)}
      loadingLabel={t(keys.auth.common.loading)}
      secondaryHref={signupHref()}
      state={state()}
      onPrimaryAction={handleSignIn}
      errorMessage={errorMessage()}
    />
  )
}
