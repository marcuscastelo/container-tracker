import type { JSX } from 'solid-js'

type StackProps = {
  readonly children: JSX.Element
  readonly class?: string
  readonly gap?: 'xs' | 'sm' | 'md' | 'lg'
}

const gapClassBySize: Record<NonNullable<StackProps['gap']>, string> = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
}

export function Stack(props: StackProps): JSX.Element {
  return (
    <div class={`flex flex-col ${gapClassBySize[props.gap ?? 'md']} ${props.class ?? ''}`.trim()}>
      {props.children}
    </div>
  )
}
