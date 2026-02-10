import { A, useLocation } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'

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
      try {
        const u = new URL(existing.link, window.location.origin)
        if (u.pathname === current) return true
      } catch {
        // ignore
      }
    }
    // compare processId by checking if pathname includes it (handles /shipments/:id)
    if (existing.processId && current.includes(existing.processId)) return true
    return false
  }

  if (!props.message && !props.existing) return <div />

  const same = isCurrentPath(props.existing)

  const extractContainerFromMessage = (msg?: string) => {
    if (!msg) return ''
    const m = msg.match(/Container\s+([A-Za-z0-9]+)/i)
    return m ? m[1] : ''
  }

  const container = props.existing?.containerNumber ?? extractContainerFromMessage(props.message)

  const message = same
    ? t(keys.createProcess.action.existingProcessSame, { container })
    : container
      ? t(keys.createProcess.action.existingProcessError, { container })
      : (props.message ?? t(keys.createProcess.action.existingProcessError, { container: '' }))

  return (
    <div class="relative mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <div class="flex items-start justify-between">
        <div class="pr-8">{message}</div>

        {/* Close X that acknowledges the error for SPA parents */}
        <div class="ml-4 shrink-0">
          <button
            type="button"
            aria-label={t(keys.createProcess.action.dismiss) ?? 'Dismiss'}
            class="rounded-md p-1 text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200"
            onClick={() => {
              try {
                props.onAcknowledge?.()
              } catch {
                /* ignore */
              }
            }}
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>{t(keys.createProcess.action.dismiss) ?? 'Dismiss'}</title>
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
        when={!same && Boolean(props.existing && (props.existing.processId || props.existing.link))}
      >
        <div class="mt-2">
          <A
            href={props.existing?.link ?? `/shipments/${props.existing?.processId ?? ''}`}
            class="font-medium text-slate-900 hover:underline"
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
