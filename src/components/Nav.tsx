import { useLocation } from '@solidjs/router'
import { useTranslation } from '../i18n'

const keys = {
  home: 'nav.home',
  about: 'nav.about',
}

export function Nav() {
  const { t } = useTranslation()
  const location = useLocation()
  const active = (path: string) =>
    path === location.pathname ? 'border-sky-600' : 'border-transparent hover:border-sky-600'
  return (
    <nav class="bg-sky-800">
      <ul class="container flex items-center p-3 text-gray-200">
        <li class={`border-b-2 ${active('/')} mx-1.5 sm:mx-6`}>
          <a href="/">{t(keys.home)}</a>
        </li>
        <li class={`border-b-2 ${active('/about')} mx-1.5 sm:mx-6`}>
          <a href="/about">{t(keys.about)}</a>
        </li>
      </ul>
    </nav>
  )
}
