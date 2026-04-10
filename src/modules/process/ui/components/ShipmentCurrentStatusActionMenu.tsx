import { Clock3, MoreVertical } from 'lucide-solid'
import { createSignal, type JSX, onCleanup, onMount } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'

type ShipmentCurrentStatusActionMenuProps = {
  readonly onOpenTimeTravel: () => void
}

const TRIGGER_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text-muted transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

const ITEM_CLASS =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs-ui font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

export function ShipmentCurrentStatusActionMenu(
  props: ShipmentCurrentStatusActionMenuProps,
): JSX.Element {
  const { t, keys } = useTranslation()
  const [isOpen, setIsOpen] = createSignal(false)
  let menuRef: HTMLDetailsElement | undefined
  let triggerRef: HTMLElement | undefined

  const closeMenu = (shouldRestoreFocus: boolean): void => {
    if (menuRef) {
      menuRef.open = false
    } else {
      setIsOpen(false)
    }

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
      if (!menuRef?.open) return
      const target = event.target
      if (target instanceof Node && menuRef.contains(target)) return
      closeMenu(false)
    }

    const onEscape = (event: KeyboardEvent) => {
      if (!menuRef?.open) return
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeMenu(true)
    }

    const onOtherOpened: EventListener = (event) => {
      if (!menuRef) return
      if (!(event instanceof CustomEvent)) return
      if (event.detail !== menuRef) {
        closeMenu(false)
      }
    }

    const onToggle: EventListener = () => {
      if (!menuRef) return
      setIsOpen(menuRef.open)
      if (menuRef.open) {
        window.dispatchEvent(new CustomEvent('unified-dropdown-opened', { detail: menuRef }))
      }
    }

    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onEscape)
    window.addEventListener('unified-dropdown-opened', onOtherOpened)
    menuRef?.addEventListener('toggle', onToggle)

    onCleanup(() => {
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('keydown', onEscape)
      window.removeEventListener('unified-dropdown-opened', onOtherOpened)
      menuRef?.removeEventListener('toggle', onToggle)
    })
  })

  return (
    <details
      ref={(element) => {
        if (element instanceof HTMLDetailsElement) {
          menuRef = element
          return
        }
        menuRef = undefined
      }}
      class="relative"
    >
      <summary
        ref={(element) => {
          if (element instanceof HTMLElement) {
            triggerRef = element
            return
          }
          triggerRef = undefined
        }}
        aria-haspopup="menu"
        aria-label={t(keys.shipmentView.currentStatus.actions.openMenu)}
        data-state={isOpen() ? 'open' : 'closed'}
        class={TRIGGER_CLASS}
      >
        <MoreVertical class="h-4 w-4" aria-hidden="true" />
        <span class="sr-only">{t(keys.shipmentView.currentStatus.actions.openMenu)}</span>
      </summary>

      <div class="absolute right-0 top-full z-20 mt-1 min-w-52 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
        <button type="button" class={ITEM_CLASS} onClick={handleOpenTimeTravel}>
          <Clock3 class="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
          <span>{t(keys.shipmentView.timeTravel.open)}</span>
        </button>
      </div>
    </details>
  )
}
