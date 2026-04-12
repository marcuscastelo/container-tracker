import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it } from 'vitest'
import { FormInput, FormSelect } from '~/shared/ui/FormFields'

describe('FormInput', () => {
  it('renders helper text, required marker, and descriptive attributes', () => {
    const html = renderToString(() =>
      createComponent(FormInput, {
        label: 'Container',
        name: 'containerNumber',
        value: 'MSCU1234567',
        onInput: () => undefined,
        onBlur: () => undefined,
        onPaste: () => undefined,
        placeholder: 'Enter container',
        helperText: 'Use the exact carrier number',
        required: true,
      }),
    )

    expect(html).toContain('Container')
    expect(html).toContain('for="containerNumber"')
    expect(html).toContain('placeholder="Enter container"')
    expect(html).toContain('Use the exact carrier number')
    expect(html).toContain('aria-invalid="false"')
    expect(html).toContain('aria-describedby="containerNumber-description"')
    expect(html).toContain('motion-focus-surface')
    expect(html).toContain('text-tone-danger-strong')
    expect(html).not.toContain('role="alert"')
  })

  it('renders the error branch and disables the field when requested', () => {
    const html = renderToString(() =>
      createComponent(FormInput, {
        label: 'Weight',
        name: 'weight',
        value: 'abc',
        type: 'number',
        onInput: () => undefined,
        error: 'Invalid number',
        helperText: 'Ignored while error is visible',
        disabled: true,
      }),
    )

    expect(html).toContain('type="number"')
    expect(html).toMatch(/<input[^>]*\sdisabled(?=\s|>)/)
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Invalid number')
    expect(html).toContain('border-tone-danger-border')
    expect(html).toContain('motion-focus-surface')
    expect(html).not.toContain('Ignored while error is visible')
  })
})

describe('FormSelect', () => {
  it('renders placeholder, helper text, and options', () => {
    const html = renderToString(() =>
      createComponent(FormSelect, {
        label: 'Carrier',
        name: 'carrier',
        value: '',
        onInput: () => undefined,
        placeholder: 'Choose carrier',
        helperText: 'Select the source carrier',
        required: true,
        options: [
          { value: 'maersk', label: 'Maersk' },
          { value: 'msc', label: 'MSC' },
        ],
      }),
    )

    expect(html).toContain('Carrier')
    expect(html).toContain('for="carrier"')
    expect(html).toContain('Choose carrier')
    expect(html).toContain('Select the source carrier')
    expect(html).toContain('value="maersk"')
    expect(html).toContain('Maersk')
    expect(html).toContain('value="msc"')
    expect(html).toContain('MSC')
    expect(html).toMatch(/<select[^>]*\srequired(?=\s|>)/)
    expect(html).toContain('motion-focus-surface')
  })

  it('omits placeholder and helper text when they are not provided', () => {
    const html = renderToString(() =>
      createComponent(FormSelect, {
        label: 'Transport mode',
        name: 'mode',
        value: 'sea',
        onInput: () => undefined,
        options: [{ value: 'sea', label: 'Sea' }],
      }),
    )

    expect(html).toContain('Transport mode')
    expect(html).toContain('Sea')
    expect(html).not.toContain('Choose carrier')
    expect(html).not.toContain('text-xs-ui text-text-muted')
    expect(html).not.toMatch(/<select[^>]*\srequired(?=\s|>)/)
  })
})
