import type { Component } from 'solid-js'
import { useTranslation } from '../i18n'

const keys = {
  save: 'buttons.save',
}

export const SaveButton: Component = () => {
  const { t } = useTranslation()
  const label = t(keys.save)
  return <button aria-label={label}>{label}</button>
}
