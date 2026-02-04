import { createSignal } from 'solid-js'
import { useTranslation } from '../i18n'

const keys = {
  clicks: 'counter.clicks',
}

export function Counter() {
  const [count, setCount] = createSignal(0)
  const { t } = useTranslation()
  return (
    <button
      class="w-50 rounded-full bg-gray-100 border-2 border-gray-300 focus:border-gray-400 active:border-gray-400 px-8 py-4"
      onClick={() => setCount(count() + 1)}
    >
      {t(keys.clicks, { count: count() })}
    </button>
  )
}
