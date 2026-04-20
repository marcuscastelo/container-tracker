import type { JSX } from 'solid-js'
import { createMemo, createSignal, Match, onCleanup, onMount, Switch } from 'solid-js'
import { ChevronDownIcon } from '~/modules/process/ui/components/unified/Icons'
import { ImporterOptionsList } from '~/modules/process/ui/components/unified/ImporterOptionsList'
import type {
  DashboardImporterFilterOption,
  DashboardImporterFilterValue,
} from '~/modules/process/ui/viewmodels/dashboard-filter.service'
import { useMotionOpenState } from '~/shared/ui/motion/useMotionOpenState'

export function ImporterChipDropdown(props: {
  readonly label: string
  readonly allLabel: string
  readonly emptyLabel: string
  readonly searchPlaceholder: string
  readonly noMatchesLabel: string
  readonly testId: string
  readonly options: readonly DashboardImporterFilterOption[]
  readonly selectedImporterId: string | null
  readonly selectedImporterName: string | null
  readonly onSelect: (importer: DashboardImporterFilterValue | null) => void
}): JSX.Element {
  const [searchValue, setSearchValue] = createSignal('')
  const normalizedSelectedImporterName = createMemo(() =>
    toNormalizedNonBlankString(props.selectedImporterName),
  )

  const selectedOption = createMemo(() => {
    const selectedImporterId = props.selectedImporterId
    if (selectedImporterId !== null) {
      return props.options.find((option) => option.importerId === selectedImporterId) ?? null
    }
    const selectedImporterName = normalizedSelectedImporterName()
    if (selectedImporterName === null) return null
    return (
      props.options.find((option) => {
        if (option.importerId !== null) return false
        return toNormalizedNonBlankString(option.importerName) === selectedImporterName
      }) ?? null
    )
  })

  const hasSelection = () => selectedOption() !== null

  const chipLabel = () => {
    if (props.options.length === 0) return props.label
    return selectedOption() ? `${props.label}: ${selectedOption()?.label}` : props.label
  }

  const filteredOptions = createMemo(() => {
    const normalizedSearchValue = toNormalizedNonBlankString(searchValue())
    if (normalizedSearchValue === null) return props.options
    return props.options.filter((option) => {
      const normalizedLabel = option.label.toLocaleLowerCase('pt-BR')
      if (normalizedLabel.includes(normalizedSearchValue)) return true
      if (option.importerId === null) return false
      return option.importerId.toLocaleLowerCase('pt-BR').includes(normalizedSearchValue)
    })
  })

  const isOptionSelected = (option: DashboardImporterFilterOption): boolean => {
    const selected = selectedOption()
    if (selected === null) return false
    return (
      selected.importerId === option.importerId && selected.importerName === option.importerName
    )
  }

  const handleOptionSelect = (option: DashboardImporterFilterOption): void => {
    props.onSelect({
      importerId: option.importerId,
      importerName: option.importerName,
    })
    setSearchValue('')
    dropdown.close()
  }

  const dropdown = useMotionOpenState()
  let rootRef: HTMLDivElement | undefined

  onMount(() => {
    const onDocClick: EventListener = (ev) => {
      if (!dropdown.isOpen()) return
      const target = ev.target
      if (target instanceof Node && rootRef?.contains(target)) return
      dropdown.close()
    }

    const onOtherOpened: EventListener = (ev) => {
      if (!rootRef) return
      if (!(ev instanceof CustomEvent)) return
      if (ev.detail !== rootRef) {
        dropdown.close()
      }
    }

    document.addEventListener('click', onDocClick)
    window.addEventListener('unified-dropdown-opened', onOtherOpened)

    onCleanup(() => {
      document.removeEventListener('click', onDocClick)
      window.removeEventListener('unified-dropdown-opened', onOtherOpened)
    })
  })

  return (
    <div
      ref={(el) => {
        if (el instanceof HTMLDivElement) rootRef = el
        else rootRef = undefined
      }}
      class="group relative"
      data-testid={props.testId}
      data-state={dropdown.panelState()}
    >
      <button
        type="button"
        aria-expanded={dropdown.isOpen()}
        class={`motion-focus-surface motion-interactive inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-md-ui select-none ${
          hasSelection()
            ? 'border-control-selected-border bg-control-selected-bg text-control-selected-foreground'
            : 'border-control-border bg-control-bg text-control-foreground hover:border-control-border-hover hover:bg-control-bg-hover hover:text-control-foreground-strong'
        }`}
        onClick={() => {
          if (dropdown.isOpen()) {
            dropdown.close()
            return
          }

          dropdown.open()
          if (rootRef) {
            window.dispatchEvent(new CustomEvent('unified-dropdown-opened', { detail: rootRef }))
          }
        }}
      >
        <span class="truncate">{chipLabel()}</span>
        <ChevronDownIcon />
      </button>

      <div
        data-state={dropdown.panelState()}
        class="motion-dropdown-panel absolute left-0 top-full z-20 mt-1 min-w-60 overflow-hidden rounded-md border border-control-border bg-control-popover shadow-lg"
      >
        <div class="border-b border-control-border px-2 py-2">
          <input
            type="search"
            class="motion-focus-surface w-full rounded border border-control-border bg-control-bg px-2 py-1.5 text-md-ui text-control-popover-foreground outline-none placeholder:text-control-placeholder focus:border-control-selected-border focus-visible:ring-2 focus-visible:ring-ring/40"
            placeholder={props.searchPlaceholder}
            value={searchValue()}
            onInput={(event) => setSearchValue(event.currentTarget.value)}
          />
        </div>
        <Switch>
          <Match when={props.options.length === 0}>
            <p class="px-3 py-2 text-md-ui text-text-muted">{props.emptyLabel}</p>
          </Match>
          <Match when={filteredOptions().length === 0}>
            <p class="px-3 py-2 text-md-ui text-text-muted">{props.noMatchesLabel}</p>
          </Match>
          <Match when={true}>
            <ImporterOptionsList
              options={filteredOptions()}
              isSelected={isOptionSelected}
              onSelect={handleOptionSelect}
            />
          </Match>
        </Switch>
      </div>
    </div>
  )
}

function toOptionalNonBlankString(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toNormalizedNonBlankString(value: string | null | undefined): string | null {
  const nonBlankValue = toOptionalNonBlankString(value)
  if (nonBlankValue === null) return null
  return nonBlankValue.toLocaleLowerCase('pt-BR')
}
