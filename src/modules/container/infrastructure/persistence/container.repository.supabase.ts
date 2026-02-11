import type { ContainerRepository } from '~/modules/container/application/container.repository'
import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import { containerMappers } from '~/modules/container/infrastructure/persistence/container.persistence.mappers'
import { InfrastructureError } from '~/shared/errors/httpErrors'
import type { Database } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'

const TABLE_NAME: keyof Database['public']['Tables'] = 'containers'

export const supabaseContainerRepository: ContainerRepository = {
  async findByNumber(containerNumber: string): Promise<ContainerEntity | null> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('container_number', containerNumber)
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new InfrastructureError(`Failed to fetch container ${containerNumber}`, error)
    }

    if (!data) return null

    return containerMappers.fromRow(data)
  },

  async insert(record): Promise<ContainerEntity> {
    const row = containerMappers.toInsert(record)

    const { data, error } = await supabase.from(TABLE_NAME).insert(row).select().single()

    if (error || !data) {
      throw new InfrastructureError(`Failed to insert container ${record.containerNumber}`, error)
    }

    return containerMappers.fromRow(data)
  },

  async insertMany(records): Promise<ContainerEntity[]> {
    if (records.length === 0) return []

    const rows = records.map(containerMappers.toInsert)

    const { data, error } = await supabase.from(TABLE_NAME).insert(rows).select()

    if (error || !data) {
      throw new InfrastructureError(`Failed to insert multiple containers`, error)
    }

    return data.map(containerMappers.fromRow)
  },

  async existsMany(containerNumbers: string[]): Promise<Map<string, boolean>> {
    if (containerNumbers.length === 0) {
      return new Map()
    }

    const normalized = containerNumbers.map((n) => n.toUpperCase().trim())

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('container_number')
      .in('container_number', normalized)

    if (error || !data) {
      throw new InfrastructureError(`Failed to check container existence`, error)
    }

    const existingSet = new Set(data.map((row) => row.container_number.toUpperCase().trim()))

    return new Map(normalized.map((num) => [num, existingSet.has(num)]))
  },

  async findByNumbers(containerNumbers: string[]): Promise<ContainerEntity[]> {
    if (containerNumbers.length === 0) return []

    const normalized = containerNumbers.map((n) => n.toUpperCase().trim())

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .in('container_number', normalized)

    if (error || !data) {
      throw new InfrastructureError(`Failed to find containers by numbers`, error)
    }

    return data.map(containerMappers.fromRow)
  },

  async delete(containerId: string): Promise<void> {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('id', containerId)

    if (error) {
      throw new InfrastructureError(`Failed to delete container ${containerId}`, error)
    }
  },
}
