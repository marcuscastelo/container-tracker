import type { JSX } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useTranslation } from '~/shared/localization/i18n'
import {
  clearMotionTimeout,
  scheduleMotionFrame,
  scheduleMotionTimeout,
} from '~/shared/ui/motion/motion.utils'

type Props = {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly description?: string
  readonly children: JSX.Element
  readonly maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
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
          class="-m-2 rounded-md p-2 text-text-muted motion-focus-surface motion-interactive hover:bg-surface-muted hover:text-foreground"
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
  const [isRendered, setIsRendered] = createSignal(false)
  const [visualState, setVisualState] = createSignal<'open' | 'closed'>('closed')
  let closeTimeoutId: number | null = null

  createEffect(() => {
    if (props.open) {
      clearMotionTimeout(closeTimeoutId)
      setIsRendered(true)
      if (typeof window === 'undefined') {
        setVisualState('open')
        return
      }

      scheduleMotionFrame(() => {
        setVisualState('open')
      })
      return
    }

    if (!isRendered()) {
      setVisualState('closed')
      return
    }

    setVisualState('closed')
    closeTimeoutId = scheduleMotionTimeout(() => {
      setIsRendered(false)
      closeTimeoutId = null
    }, 'slow')
  })

  createEffect(() => {
    if (!isRendered()) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        props.onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    onCleanup(() => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    })
  })

  onCleanup(() => {
    clearMotionTimeout(closeTimeoutId)
  })

  const widthClass = () => maxWidthClasses[props.maxWidth ?? 'lg']

  return (
    <Show when={props.open || isRendered()}>
      <Portal>
        <div class="fixed inset-0 z-50 overflow-y-auto">
          <div
            data-state={props.open && !isRendered() ? 'open' : visualState()}
            class="motion-dialog-overlay fixed inset-0 bg-ring/50"
            onClick={() => props.onClose()}
            aria-hidden="true"
          />
          <div class="flex min-h-full items-start justify-center p-4 pt-16 sm:pt-24">
            <div
              data-state={props.open && !isRendered() ? 'open' : visualState()}
              class={`motion-dialog-panel relative w-full ${widthClass()} rounded-lg border border-border bg-popover text-popover-foreground shadow-xl`}
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
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
