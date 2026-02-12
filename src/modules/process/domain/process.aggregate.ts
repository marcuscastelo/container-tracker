// import type { ContainerEntity } from '~/modules/container/domain/container.entity'
// import { validateReference } from './process.validation'

// export type ProcessAggregate = {
//   readonly id: ProcessId
//   readonly reference: ProcessReference
//   readonly origin: string
//   readonly destination: string
//   readonly carrier: string
//   readonly createdAt: Date
//   readonly updatedAt: Date
//   readonly containers: readonly ContainerEntity[]
//   readonly __type: 'ProcessAggregate'
// }

// type CreateProcessProps = {
//   id: string
//   reference: string
//   origin: string
//   destination: string
//   carrier: string
//   createdAt: Date
//   updatedAt: Date
//   containers?: ContainerEntity[]
// }

// export function createProcessAggregate(props: CreateProcessProps): ProcessAggregate {
//   validateReference(props.reference)

//   return {
//     id: toProcessId(props.id),
//     reference: toProcessReference(props.reference),
//     origin: props.origin,
//     destination: props.destination,
//     carrier: props.carrier,
//     createdAt: props.createdAt,
//     updatedAt: props.updatedAt,
//     containers: props.containers ?? [],
//     __type: 'ProcessAggregate',
//   }
// }

// export function addContainer(
//   process: ProcessAggregate,
//   container: ContainerEntity,
// ): ProcessAggregate {
//   const alreadyExists = process.containers.some(
//     (c) => c.containerNumber === container.containerNumber,
//   )

//   if (alreadyExists) {
//     throw new Error(`Container ${container.containerNumber} already in process`)
//   }

//   return {
//     ...process,
//     containers: [...process.containers, container],
//   }
// }

// export function removeContainer(process: ProcessAggregate, containerId: string): ProcessAggregate {
//   if (process.containers.length <= 1) {
//     throw new Error('Cannot remove last container from process')
//   }

//   return {
//     ...process,
//     containers: process.containers.filter((c) => c.id !== containerId),
//   }
// }
