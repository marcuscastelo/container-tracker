import { describe, expect, it } from 'vitest'
import {
  dropContainerScopedField,
  listContainerScopedEntries,
  retainContainerScopedFields,
  toContainerFieldKey,
} from '~/modules/process/ui/validation/containerFormState.validation'

describe('containerFormState.validation', () => {
  it('drops only the removed container field key', () => {
    const result = dropContainerScopedField(
      {
        [toContainerFieldKey('container-a')]: 'error-a',
        [toContainerFieldKey('container-b')]: 'error-b',
      },
      'container-a',
    )

    expect(result).toEqual({
      [toContainerFieldKey('container-b')]: 'error-b',
    })
  })

  it('retains state only for visible containers', () => {
    const result = retainContainerScopedFields(
      {
        [toContainerFieldKey('container-a')]: true,
        [toContainerFieldKey('container-stale')]: true,
      },
      ['container-a'],
    )

    expect(result).toEqual({
      [toContainerFieldKey('container-a')]: true,
    })
  })

  it('ignores stale errors after remove and re-add with a new container id', () => {
    const staleKey = toContainerFieldKey('removed-id')
    const activeKey = toContainerFieldKey('readded-id')

    const entries = listContainerScopedEntries(
      {
        [staleKey]: { message: 'Container already exists' },
        [activeKey]: { message: 'Container format invalid' },
      },
      ['readded-id'],
    )

    expect(entries).toEqual([[activeKey, { message: 'Container format invalid' }]])
  })
})
