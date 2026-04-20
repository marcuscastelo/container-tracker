import { useLocation, useNavigate } from '@solidjs/router'
import { createSignal, onMount } from 'solid-js'
import { AuthEntryScreen, type AuthEntryScreenState } from '~/modules/auth/ui/AuthEntryScreen'
import { getReturnToFromQuery } from '~/shared/auth/auth-return-to'
import { getWorkosUser, WorkosAuthClientError } from '~/shared/auth/workos-auth.client'
import { useTranslation } from '~/shared/localization/i18n'

export default function AuthSignupRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t, keys } = useTranslation()
  const [state, setState] = createSignal<AuthEntryScreenState>('loading')
  const [errorCode, setErrorCode] = createSignal<string | null>(null)

  const returnTo = () => getReturnToFromQuery(location.search)
  const loginHref = () => `/auth/login?return_to=${encodeURIComponent(returnTo())}`
  const errorMessage = () => {
    const code = errorCode()
    if (code === null) return null
    if (code === 'request_not_implemented') return t(keys.auth.common.requestNotImplemented)
    if (code === 'config_missing') return t(keys.auth.common.errorConfig)
    if (code === 'login_required') return t(keys.auth.common.errorLoginRequired)
    return t(keys.auth.common.errorNetwork)
  }

  onMount(() => {
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

  const handleSignUp = () => {
    setErrorCode('request_not_implemented')
    setState('error')
  }

  return (
    <AuthEntryScreen
      title={t(keys.auth.signup.title)}
      subtitle={t(keys.auth.signup.subtitle)}
      primaryLabel={t(keys.auth.signup.primary)}
      secondaryLabel={t(keys.auth.signup.secondary)}
      loadingLabel={t(keys.auth.common.loading)}
      secondaryHref={loginHref()}
      state={state()}
      onPrimaryAction={handleSignUp}
      errorMessage={errorMessage()}
    />
  )
}
