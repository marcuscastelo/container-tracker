import { A } from '@solidjs/router'
import { useTranslation } from '~/i18n'

const keys = {
  notFound: 'notfound.title',
  learn: 'notfound.learn',
  home: 'nav.home',
  aboutPage: 'about.page',
}

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <main class="text-center mx-auto text-gray-700 p-4">
      <h1 class="max-6-xs text-6xl text-sky-700 font-thin uppercase my-16">{t(keys.notFound)}</h1>
      <p class="mt-8">
        {t(keys.learn)}{' '}
        <a href="https://solidjs.com" target="_blank" class="text-sky-600 hover:underline">
          solidjs.com
        </a>
      </p>
      <p class="my-4">
        <A href="/" class="text-sky-600 hover:underline">
          {t(keys.home)}
        </A>
        {' - '}
        <A href="/about" class="text-sky-600 hover:underline">
          {t(keys.aboutPage)}
        </A>
      </p>
    </main>
  )
}
