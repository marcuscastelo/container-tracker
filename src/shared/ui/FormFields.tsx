import type { JSX } from 'solid-js'
import { For, Show, splitProps } from 'solid-js'

type InputProps = {
  readonly label: string
  readonly name: string
  readonly value: string
  readonly onInput: (value: string) => void
  readonly onBlur?: () => void
  readonly onPaste?: (event: ClipboardEvent) => void
  readonly placeholder?: string
  readonly helperText?: string
  readonly error?: string
  readonly required?: boolean
  readonly disabled?: boolean
  readonly type?: 'text' | 'number'
}

export function FormInput(props: InputProps): JSX.Element {
  const [local, _rest] = splitProps(props, [
    'label',
    'name',
    'value',
    'onInput',
    'onBlur',
    'onPaste',
    'placeholder',
    'helperText',
    'error',
    'required',
    'disabled',
    'type',
  ])

  const hasError = () => Boolean(local.error)

  return (
    <div class="space-y-1.5">
      <label for={local.name} class="block text-sm-ui font-medium text-control-foreground">
        {local.label}
        <Show when={local.required}>
          <span class="ml-1 text-tone-danger-strong" aria-hidden="true">
            *
          </span>
        </Show>
      </label>
      <input
        type={local.type ?? 'text'}
        id={local.name}
        name={local.name}
        value={local.value}
        onInput={(e) => local.onInput(e.currentTarget.value)}
        onBlur={() => local.onBlur?.()}
        onPaste={(event) => local.onPaste?.(event)}
        placeholder={local.placeholder}
        disabled={local.disabled}
        required={local.required}
        class={`motion-focus-surface block w-full rounded-md border border-control-border bg-control-bg px-3 py-2 text-sm-ui text-control-popover-foreground shadow-sm placeholder:text-control-placeholder focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:bg-control-bg-hover disabled:text-control-foreground ${
          hasError()
            ? 'border-tone-danger-border focus:border-tone-danger-strong focus:ring-tone-danger-strong/40'
            : 'focus:border-control-selected-border'
        }`}
        aria-invalid={hasError()}
        aria-describedby={local.helperText || local.error ? `${local.name}-description` : undefined}
      />
      <Show when={local.helperText && !hasError()}>
        <p id={`${local.name}-description`} class="text-xs-ui text-text-muted">
          {local.helperText}
        </p>
      </Show>
      <Show when={hasError()}>
        <p id={`${local.name}-description`} class="text-xs-ui text-tone-danger-fg" role="alert">
          {local.error}
        </p>
      </Show>
    </div>
  )
}

type SelectOption = {
  readonly value: string
  readonly label: string
}

type SelectProps = {
  readonly label: string
  readonly name: string
  readonly value: string
  readonly onInput: (value: string) => void
  readonly options: readonly SelectOption[]
  readonly placeholder?: string
  readonly helperText?: string
  readonly required?: boolean
  readonly disabled?: boolean
}

export function FormSelect(props: SelectProps): JSX.Element {
  return (
    <div class="space-y-1.5">
      <label for={props.name} class="block text-sm-ui font-medium text-control-foreground">
        {props.label}
        <Show when={props.required}>
          <span class="ml-1 text-tone-danger-strong" aria-hidden="true">
            *
          </span>
        </Show>
      </label>
      <select
        id={props.name}
        name={props.name}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        disabled={props.disabled}
        required={props.required}
        class="motion-focus-surface block w-full rounded-md border border-control-border bg-control-bg px-3 py-2 text-sm-ui text-control-popover-foreground shadow-sm focus:bg-surface focus:border-control-selected-border focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:bg-control-bg-hover disabled:text-control-foreground"
      >
        <Show when={props.placeholder}>
          {/* Placeholder option is hidden from the dropdown list so it can act as an
              initial non-selectable prompt but won't appear among the real choices.
              Keep value empty so native `required` still treats it as invalid. */}
          <option value="" hidden disabled>
            {props.placeholder}
          </option>
        </Show>
        <For each={props.options}>
          {(option) => <option value={option.value}>{option.label}</option>}
        </For>
      </select>
      <Show when={props.helperText}>
        <p class="text-xs-ui text-text-muted">{props.helperText}</p>
      </Show>
    </div>
  )
}
