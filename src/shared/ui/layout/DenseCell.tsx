import type { JSX } from 'solid-js'

type DenseCellProps = {
  readonly children: JSX.Element
  readonly class?: string
  readonly align?: 'left' | 'center' | 'right'
}

const alignClassByValue: Record<NonNullable<DenseCellProps['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export function DenseCell(props: DenseCellProps): JSX.Element {
  return (
    <div
      class={`px-3 py-2 text-sm ${alignClassByValue[props.align ?? 'left']} ${props.class ?? ''}`.trim()}
    >
      {props.children}
    </div>
  )
}
