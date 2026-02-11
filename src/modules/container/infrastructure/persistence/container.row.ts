import type { Database } from '~/shared/supabase/database.types'

export type ContainerRow = Database['public']['Tables']['containers']['Row']
export type ContainerInsert = Database['public']['Tables']['containers']['Insert']
export type ContainerUpdate = Database['public']['Tables']['containers']['Update']
