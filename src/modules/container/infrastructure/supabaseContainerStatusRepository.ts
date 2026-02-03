import { supabase } from '~/shared/supabase/supabase'
import { type ContainerStatus } from '../domain/containerStatus'
import { type ContainerStatusRepository } from '../domain/containerStatusRepository'

const TABLE_NAME = 'container-status'

/**
 * Supabase-backed implementation of ContainerStatusRepository.
 * Uses the `container-status` table with columns:
 * - container_id: string (primary key)
 * - status: JSONB
 */
export const supabaseContainerStatusRepository: ContainerStatusRepository = {
    async fetchAll(): Promise<readonly ContainerStatus[]> {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')

        if (error) {
            console.error('supabaseContainerStatusRepository.fetchAll error:', error)
            throw new Error(`Failed to fetch container statuses: ${error.message}`)
        }

        // Parse and validate each row. Avoid depending on Zod at runtime to prevent
        // potential incompatible zod internals errors in different environments.
        return data.map((row) => {
            try {
                const cid = row?.container_id ? String(row.container_id) : String(row?.ContainerNumber ?? row?.Container ?? 'unknown')
                const status = row?.status ?? row?.Status ?? row ?? {}

                // Basic runtime shape checks
                if (typeof cid !== 'string' || cid.length === 0) {
                    console.warn('supabaseContainerStatusRepository.fetchAll: invalid container_id, falling back', row)
                }

                if (status == null) {
                    return { container_id: cid, carrier: String(row?.carrier ?? 'UNKNOWN'), status: {} }
                }

                return { container_id: cid, carrier: String(row?.carrier ?? 'UNKNOWN'), status: status as Record<string, unknown> }
            } catch (e) {
                console.warn('supabaseContainerStatusRepository.fetchAll: failed to normalize row', row, String(e))
                return {
                    container_id: String(row?.container_id ?? 'unknown'),
                    carrier: String(row?.carrier ?? 'UNKNOWN'),
                    status: (row?.status as Record<string, unknown>) ?? {}
                }
            }
        })
    },

    async fetchById(containerId: string): Promise<ContainerStatus | null> {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('container_id', containerId)
            .single()

        if (error) {
            // PGRST116 = no rows found, which is not an error for us
            if (error.code === 'PGRST116') {
                return null
            }
            console.error(
                'supabaseContainerStatusRepository.fetchById error:',
                error,
            )
            throw new Error(
                `Failed to fetch container status for ${containerId}: ${error.message}`,
            )
        }

        if (!data) return null

        try {
            const cid = data?.container_id ? String(data.container_id) : String(data?.ContainerNumber ?? data?.Container ?? containerId)
            const status = data?.status ?? data ?? {}
            return { container_id: cid, status: status as Record<string, unknown> }
        } catch (e) {
            console.warn('supabaseContainerStatusRepository.fetchById: failed to normalize data', data, String(e))
            return null
        }
    },

    async upsert(containerStatus: ContainerStatus): Promise<ContainerStatus> {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .upsert(
                {
                    container_id: containerStatus.container_id,
                    status: containerStatus.status,
                },
                {
                    onConflict: 'container_id',
                },
            )
            .select()
            .single()

        if (error) {
            console.error('supabaseContainerStatusRepository.upsert error:', error)
            throw new Error(
                `Failed to upsert container status for ${containerStatus.container_id}: ${error.message}`,
            )
        }

        if (!data) {
            throw new Error(
                `Upsert returned no data for ${containerStatus.container_id}`,
            )
        }

        return {
            container_id: data.container_id,
            status: data.status as Record<string, unknown>,
        }
    },

    async delete(containerId: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('container_id', containerId)

        if (error) {
            console.error('supabaseContainerStatusRepository.delete error:', error)
            throw new Error(
                `Failed to delete container status for ${containerId}: ${error.message}`,
            )
        }
    },
}
