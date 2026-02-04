import { A } from '@solidjs/router'
import { Counter } from '~/components/Counter'
import { useTranslation } from '../i18n'

const keys = {
  title: 'about.title',
  learnLinkText: 'about.learnLinkText',
  home: 'nav.home',
  aboutPage: 'about.page',
}

export default function About() {
  const { t } = useTranslation()
  return (
    <main class="text-center mx-auto text-gray-700 p-4">
      <h1 class="max-6-xs text-6xl text-sky-700 font-thin uppercase my-16">{t(keys.title)}</h1>
      <Counter />
      <p class="mt-8">
        {t(keys.learnLinkText)}{' '}
        <a href="https://solidjs.com" target="_blank" class="text-sky-600 hover:underline">
          solidjs.com
        </a>
      </p>
      <p class="my-4">
        <A href="/" class="text-sky-600 hover:underline">
          {t(keys.home)}
        </A>
        {' - '}
        <span>{t(keys.aboutPage)}</span>
      </p>
    </main>
  )
}
