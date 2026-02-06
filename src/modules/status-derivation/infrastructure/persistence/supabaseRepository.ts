import type { DerivedContainerState } from '../../domain/DerivedContainerState'

// TODO: Use SupabaseResult
export class DerivedStatesRepository {
  supabase: any
  tableName = 'derived_container_states'

  constructor(supabaseClient?: any) {
    this.supabase = supabaseClient ?? null
  }

  async upsert(state: DerivedContainerState) {
    if (!this.supabase) return Promise.resolve()
    return this.supabase.from(this.tableName).upsert(state)
  }

  async findByContainer(containerNumber: string): Promise<DerivedContainerState | null> {
    if (!this.supabase) return Promise.resolve(null)
    const { data } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('container_number', containerNumber)
      .limit(1)
    return (data && data[0]) ?? null
  }
}
