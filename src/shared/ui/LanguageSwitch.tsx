import { Globe } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { BRANDING } from '~/shared/config/branding'
import { useTranslation } from '~/shared/localization/i18n'

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
        <Globe class="w-4 h-4 shrink-0 text-slate-500" />
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
        class="inline-flex items-center gap-1 rounded bg-[color:var(--brand-color-primary)] px-2 py-1 text-sm-ui font-medium text-slate-300 hover:bg-[color:var(--brand-color-primary-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--brand-color-primary-offset)]"
        style={{
          '--brand-color-primary': BRANDING.colorPrimary,
          '--brand-color-primary-hover': '#383b6e',
          '--brand-color-primary-offset': BRANDING.colorPrimary,
        }}
        aria-haspopup="listbox"
        aria-expanded={open()}
      >
        <Globe class="w-4 h-4 shrink-0" aria-hidden="true" />
        <span class="sr-only">{t(keys.languageSwitch.label)}</span>
      </button>

      <Show when={open()}>
        <ul
          class="absolute right-0 mt-2 w-36 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
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
