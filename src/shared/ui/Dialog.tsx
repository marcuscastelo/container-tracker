import type { JSX } from 'solid-js'
import { createEffect, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly description?: string
  readonly children: JSX.Element
  readonly maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  readonly footer?: JSX.Element
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
}

type HeaderProps = {
  readonly title: string
  readonly description: string | undefined
  readonly closeLabel: string
  readonly onClose: () => void
}

function DialogHeader(props: HeaderProps): JSX.Element {
  return (
    <div class="border-b border-border px-6 py-4">
      <div class="flex items-start justify-between">
        <div>
          <h2 id="dialog-title" class="text-lg-ui font-semibold text-foreground">
            {props.title}
          </h2>
          <Show when={props.description}>
            {(description) => <p class="mt-1 text-md-ui text-text-muted">{description()}</p>}
          </Show>
        </div>
        <button
          type="button"
          onClick={() => props.onClose()}
          class="-m-2 rounded-md p-2 text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          aria-label={props.closeLabel}
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
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
  )
}

export function Dialog(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  // Handle escape key
  createEffect(() => {
    if (!props.open) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        props.onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    // Prevent body scroll when dialog is open
    document.body.style.overflow = 'hidden'

    onCleanup(() => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    })
  })

  const widthClass = () => maxWidthClasses[props.maxWidth ?? 'lg']

  return (
    <Show when={props.open}>
      <Portal>
        <div class="fixed inset-0 z-50 overflow-y-auto">
          <div
            class="fixed inset-0 bg-ring/50 transition-opacity"
            onClick={() => props.onClose()}
            aria-hidden="true"
          />
          <div class="flex min-h-full items-start justify-center p-4 pt-16 sm:pt-24">
            <div
              class={`relative w-full ${widthClass()} transform rounded-lg border border-border bg-popover text-popover-foreground shadow-xl transition-all`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dialog-title"
            >
              <DialogHeader
                title={props.title}
                description={props.description}
                closeLabel={t(keys.dialog.close)}
                onClose={props.onClose}
              />
              <div class="px-6 py-4">{props.children}</div>
              <Show when={props.footer}>
                {(footer) => <div class="border-t border-border px-6 py-4">{footer}</div>}
              </Show>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
