import { describe, expect, it, vi } from 'vitest'
import { createContainerEntity } from '~/modules/container/domain/container.entity'
import { toCarrierCode } from '~/modules/container/domain/identity/carrier-code.vo'
import { toContainerId } from '~/modules/container/domain/identity/container-id.vo'
import { toContainerNumber } from '~/modules/container/domain/identity/container-number.vo'
import { toProcessId } from '~/modules/container/domain/identity/process-id.vo'
import { createContainerControllers } from '~/modules/container/interface/http/container.controllers'
import { CheckContainersResponseSchema } from '~/modules/container/interface/http/container.schemas'

describe('container controllers', () => {
  it('returns conflicts for existing container numbers', async () => {
    const controllers = createContainerControllers({
      containerUseCases: {
        findByNumbers: vi.fn(async () => ({
          containers: [
            createContainerEntity({
              id: toContainerId('container-1'),
              processId: toProcessId('process-1'),
              carrierCode: toCarrierCode('MAERSK'),
              containerNumber: toContainerNumber('MRKU1234567'),
              createdAt: new Date('2026-01-01T10:00:00.000Z'),
            }),
          ],
        })),
      },
    })

    const request = new Request('http://localhost/api/containers/check', {
      method: 'POST',
      body: JSON.stringify({ containers: ['mrku1234567'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await controllers.checkContainers({ request })
    const body = CheckContainersResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.conflicts).toHaveLength(1)
    expect(body.conflicts[0]?.containerNumber).toBe('MRKU1234567')
    expect(body.conflicts[0]?.processId).toBe('process-1')
    expect(body.conflicts[0]?.containerId).toBe('container-1')
    expect(body.conflicts[0]?.link).toBe('/shipments/process-1')
  })

  it('returns empty conflicts when no container exists', async () => {
    const controllers = createContainerControllers({
      containerUseCases: {
        findByNumbers: vi.fn(async () => ({ containers: [] })),
      },
    })

    const request = new Request('http://localhost/api/containers/check', {
      method: 'POST',
      body: JSON.stringify({ containers: ['MSCU7654321'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await controllers.checkContainers({ request })
    const body = CheckContainersResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.conflicts).toEqual([])
  })
})
