import { Clock3, MoreVertical } from 'lucide-solid'
import { createSignal, type JSX, onCleanup, onMount } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import { useMotionOpenState } from '~/shared/ui/motion/useMotionOpenState'

type ShipmentCurrentStatusActionMenuProps = {
  readonly onOpenTimeTravel: () => void
}

const TRIGGER_CLASS =
  'motion-focus-surface motion-interactive inline-flex h-8 w-8 cursor-pointer select-none items-center justify-center rounded-md border border-border bg-surface text-text-muted hover:border-border-strong hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

const ITEM_CLASS =
  'motion-focus-surface motion-interactive flex w-full items-center gap-2 px-3 py-2 text-left text-xs-ui font-medium text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

export function ShipmentCurrentStatusActionMenu(
  props: ShipmentCurrentStatusActionMenuProps,
): JSX.Element {
  const { t, keys } = useTranslation()
  const [rootReady, setRootReady] = createSignal(false)
  const menu = useMotionOpenState()
  let rootRef: HTMLDivElement | undefined
  let triggerRef: HTMLElement | undefined

  const closeMenu = (shouldRestoreFocus: boolean): void => {
    menu.close()

    if (shouldRestoreFocus) {
      triggerRef?.focus()
    }
  }

  const handleOpenTimeTravel = (): void => {
    closeMenu(false)
    props.onOpenTimeTravel()
  }

  onMount(() => {
    const onDocumentClick: EventListener = (event) => {
      if (!menu.isOpen()) return
      const target = event.target
      if (target instanceof Node && rootRef?.contains(target)) return
      closeMenu(false)
    }

    const onEscape = (event: KeyboardEvent) => {
      if (!menu.isOpen()) return
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeMenu(true)
    }

    const onOtherOpened: EventListener = (event) => {
      if (!rootRef) return
      if (!(event instanceof CustomEvent)) return
      if (event.detail !== rootRef) {
        closeMenu(false)
      }
    }

    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onEscape)
    window.addEventListener('unified-dropdown-opened', onOtherOpened)
    setRootReady(true)

    onCleanup(() => {
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('keydown', onEscape)
      window.removeEventListener('unified-dropdown-opened', onOtherOpened)
    })
  })

  return (
    <div
      ref={(element) => {
        if (element instanceof HTMLDivElement) {
          rootRef = element
          return
        }
        rootRef = undefined
      }}
      class="relative"
      data-state={menu.panelState()}
    >
      <button
        type="button"
        ref={(element) => {
          if (element instanceof HTMLElement) {
            triggerRef = element
            return
          }
          triggerRef = undefined
        }}
        aria-haspopup="menu"
        aria-expanded={menu.isOpen()}
        aria-label={t(keys.shipmentView.currentStatus.actions.openMenu)}
        data-state={menu.panelState()}
        class={TRIGGER_CLASS}
        onClick={() => {
          if (menu.isOpen()) {
            closeMenu(false)
            return
          }

          menu.open()
          if (rootReady() && rootRef) {
            window.dispatchEvent(new CustomEvent('unified-dropdown-opened', { detail: rootRef }))
          }
        }}
      >
        <MoreVertical class="h-4 w-4" aria-hidden="true" />
        <span class="sr-only">{t(keys.shipmentView.currentStatus.actions.openMenu)}</span>
      </button>

      <div
        data-state={menu.panelState()}
        class="motion-dropdown-panel absolute right-0 top-full z-20 mt-1 min-w-52 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
      >
        <button type="button" class={ITEM_CLASS} onClick={handleOpenTimeTravel}>
          <Clock3 class="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
          <span>{t(keys.shipmentView.timeTravel.open)}</span>
        </button>
      </div>
    </div>
  )
}
