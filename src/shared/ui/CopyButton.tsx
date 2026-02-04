import type { JSX } from 'solid-js'
import { createSignal, onCleanup, Show } from 'solid-js'

type Props = {
  text: string
  title?: string
  class?: string
}

// small copy helper with fallback
async function copyToClipboard(text: string): Promise<void> {
  if (!text) return
  try {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // ignore and try fallback
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'absolute'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    const selection = document.getSelection()
    const range = document.createRange()
    range.selectNodeContents(ta)
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
    ta.select()
    document.execCommand('copy')
    if (selection) selection.removeAllRanges()
    document.body.removeChild(ta)
  } catch {
    // give up silently
  }
}

export function CopyButton(props: Props): JSX.Element {
  const [copied, setCopied] = createSignal(false)
  let timer: number | undefined

  onCleanup(() => {
    if (timer) window.clearTimeout(timer)
  })

  const handleClick = async (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await copyToClipboard(props.text)
      setCopied(true)
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      title={props.title ?? 'Copy'}
      class={`relative inline-flex h-6 w-6 items-center justify-center rounded overflow-hidden transition-colors ${
        copied()
          ? 'bg-emerald-600 text-white'
          : 'bg-white/0 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      } ${props.class ?? ''}`}
      onClick={handleClick}
    >
      <Show
        when={copied()}
        fallback={
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M8 7h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M16 3H6a2 2 0 0 0-2 2v10"
            />
          </svg>
        }
      >
        <>
          <span class="copy-button-ripple" aria-hidden="true" />
          <svg class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M20 6L9 17l-5-5"
            />
          </svg>
        </>
      </Show>
    </button>
  )
}
