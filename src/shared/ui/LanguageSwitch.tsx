import { Globe } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import { FlagIcon } from '~/shared/ui/icons/FlagIcons'

type LanguageOptionProps = {
  readonly language: string
  readonly onSelect: (language: string) => void
}

function LanguageOption(props: LanguageOptionProps): JSX.Element {
  return (
    <li>
      <button
        type="button"
        class="flex w-full items-center gap-2 px-3 py-2 text-sm-ui text-slate-700 hover:bg-slate-50"
        onClick={() => props.onSelect(props.language)}
      >
        <FlagIcon locale={props.language} class="w-4 h-4 shrink-0" aria-hidden="true" />
        <span class="truncate">{props.language}</span>
      </button>
    </li>
  )
}

export function LanguageSwitch(): JSX.Element {
  const { t, keys, setLocale, availableLocales } = useTranslation()
  const [open, setOpen] = createSignal(false)
  const handleSelect = (lng: string) => {
    setLocale(lng).catch(() => {
      /* ignore */
    })
    setOpen(false)
  }

  return (
    <div class="relative">
      <button
        type="button"
        onClick={() => setOpen(!open())}
        class="dashboard-btn-outline px-2.5"
        aria-haspopup="listbox"
        aria-expanded={open()}
      >
        <Globe class="w-4 h-4 shrink-0" aria-hidden="true" />
        <span class="sr-only">{t(keys.languageSwitch.label)}</span>
      </button>

      <Show when={open()}>
        <ul
          class="absolute right-0 z-20 mt-2 w-36 rounded-md border border-border bg-surface shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <For each={availableLocales}>
            {(lng) => <LanguageOption language={lng} onSelect={handleSelect} />}
          </For>
        </ul>
      </Show>
    </div>
  )
}

// prefer named export only
