import type { JSX } from 'solid-js'

type InlineProps = {
  readonly children: JSX.Element
  readonly class?: string
  readonly gap?: 'xs' | 'sm' | 'md' | 'lg'
  readonly align?: 'start' | 'center' | 'end'
  readonly justify?: 'start' | 'between' | 'end'
}

const gapClassBySize: Record<NonNullable<InlineProps['gap']>, string> = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
}

const alignClassByValue: Record<NonNullable<InlineProps['align']>, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
}

const justifyClassByValue: Record<NonNullable<InlineProps['justify']>, string> = {
  start: 'justify-start',
  between: 'justify-between',
  end: 'justify-end',
}

export function Inline(props: InlineProps): JSX.Element {
  return (
    <div
      class={`flex ${gapClassBySize[props.gap ?? 'sm']} ${alignClassByValue[props.align ?? 'center']} ${justifyClassByValue[props.justify ?? 'start']} ${props.class ?? ''}`.trim()}
    >
      {props.children}
    </div>
  )
}
