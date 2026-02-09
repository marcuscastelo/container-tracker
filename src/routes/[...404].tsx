import { A } from '@solidjs/router'
import { useTranslation } from '~/shared/localization/i18n'

export default function NotFound() {
  const { t, keys } = useTranslation()
  return (
    <main class="text-center mx-auto text-gray-700 p-4">
      <h1 class="max-6-xs text-6xl text-sky-700 font-thin uppercase my-16">{t(keys.notfound.title)}</h1>
      <p class="mt-8">
        {t(keys.notfound.learn)}{' '}
        <a href="https://solidjs.com" target="_blank" class="text-sky-600 hover:underline">
          solidjs.com
        </a>
      </p>
      <p class="my-4">
        <A href="/" class="text-sky-600 hover:underline">
          {t(keys.nav.home)}
        </A>
        {' - '}
        <A href="/about" class="text-sky-600 hover:underline">
          {t(keys.about.page)}
        </A>
      </p>
    </main>
  )
}
