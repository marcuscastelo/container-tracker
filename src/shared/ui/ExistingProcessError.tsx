import { A, useLocation } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import { toInternalAppPathname } from '~/shared/ui/navigation/app-navigation'

type ExistingInfo = {
  processId?: string
  containerId?: string
  containerNumber?: string
  link?: string
}

type Props = {
  message?: string
  existing?: ExistingInfo | null
  onAcknowledge?: () => void
}

export function ExistingProcessError(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const loc = useLocation()

  // helper: check if current path matches the provided link or processId
  const isCurrentPath = (existing?: ExistingInfo | null) => {
    if (!existing) return false
    const current = loc.pathname || ''
    // compare explicit link first
    if (existing.link) {
      const linkPathname = toInternalAppPathname(existing.link)
      if (linkPathname === current) return true
    }
    // compare processId by checking if pathname includes it (handles /shipments/:id)
    if (existing.processId && current.includes(existing.processId)) return true
    return false
  }

  const same = createMemo(() => isCurrentPath(props.existing))

  const extractContainerFromMessage = (msg?: string) => {
    if (!msg) return ''
    const m = msg.match(/Container\s+([A-Za-z0-9]+)/i)
    return m ? m[1] : ''
  }

  const container = createMemo(
    () => props.existing?.containerNumber ?? extractContainerFromMessage(props.message),
  )

  const message = createMemo(() => {
    if (same()) {
      return t(keys.createProcess.action.existingProcessSame, { container: container() })
    } else if (container()) {
      return t(keys.createProcess.action.existingProcessError, { container: container() })
    } else {
      return props.message ?? t(keys.createProcess.action.existingProcessError, { container: '' })
    }
  })

  return (
    <div class="relative mb-4 rounded-lg border border-tone-danger-border bg-tone-danger-bg px-4 py-3 text-md-ui text-tone-danger-fg">
      <div class="flex items-start justify-between">
        <div class="pr-8">{message()}</div>

        {/* Close X that acknowledges the error for SPA parents */}
        <div class="ml-4 shrink-0">
          <button
            type="button"
            aria-label={t(keys.createProcess.action.dismiss)}
            class="rounded-md p-1 text-tone-danger-fg hover:bg-tone-danger-border/40 focus:outline-none focus:ring-2 focus:ring-tone-danger-strong/40"
            onClick={() => {
              try {
                props.onAcknowledge?.()
              } catch {
                /* ignore */
              }
            }}
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>{t(keys.createProcess.action.dismiss)}</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <Show
        when={
          !same() && Boolean(props.existing && (props.existing.processId || props.existing.link))
        }
      >
        <div class="mt-2">
          <A
            href={props.existing?.link ?? `/shipments/${props.existing?.processId ?? ''}`}
            class="font-medium text-foreground hover:underline"
            onClick={() => {
              try {
                props.onAcknowledge?.()
              } catch {
                /* ignore */
              }
            }}
          >
            {t(keys.createProcess.action.existingProcessLink)}
          </A>
        </div>
      </Show>
    </div>
  )
}
