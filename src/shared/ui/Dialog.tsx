import type { JSX } from 'solid-js'
import { createEffect, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'

type Props = {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly description?: string
  readonly children: JSX.Element
  readonly maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

export function Dialog(props: Props): JSX.Element {
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
          {/* Backdrop */}
          <div
            class="fixed inset-0 bg-slate-900/50 transition-opacity"
            onClick={props.onClose}
            aria-hidden="true"
          />

          {/* Dialog positioning */}
          <div class="flex min-h-full items-start justify-center p-4 pt-16 sm:pt-24">
            {/* Dialog panel */}
            <div
              class={`relative w-full ${widthClass()} transform rounded-lg bg-white shadow-xl transition-all`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dialog-title"
            >
              {/* Header */}
              <div class="border-b border-slate-200 px-6 py-4">
                <div class="flex items-start justify-between">
                  <div>
                    <h2 id="dialog-title" class="text-lg font-semibold text-slate-900">
                      {props.title}
                    </h2>
                    <Show when={props.description}>
                      <p class="mt-1 text-sm text-slate-500">{props.description}</p>
                    </Show>
                  </div>
                  <button
                    type="button"
                    onClick={props.onClose}
                    class="-m-2 rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-500"
                    aria-label="Close"
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

              {/* Content */}
              <div class="px-6 py-4">{props.children}</div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
