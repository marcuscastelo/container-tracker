import {
  readStateJsonFile,
  writeStateJsonFile,
} from '@agent/state/infrastructure/json-state.file-store'
import { z } from 'zod/v4'

const supervisorControlSchema = z.object({
  drain_requested: z.boolean(),
  reason: z.enum(['update', 'restart', 'manual']).nullable(),
  requested_at: z.string().datetime({ offset: true }).nullable(),
})

export type SupervisorControl = z.infer<typeof supervisorControlSchema>

export function writeSupervisorControl(filePath: string, value: SupervisorControl): void {
  writeStateJsonFile({
    filePath,
    schema: supervisorControlSchema,
    value,
  })
}

export function readSupervisorControl(filePath: string): SupervisorControl | null {
  return readStateJsonFile({
    filePath,
    schema: supervisorControlSchema,
  })
}

export function clearSupervisorControl(filePath: string): void {
  writeSupervisorControl(filePath, {
    drain_requested: false,
    reason: null,
    requested_at: null,
  })
}
