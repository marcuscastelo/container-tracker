import type { Database } from '~/shared/supabase/database.types'

export type ProcessRow = Database['public']['Tables']['processes']['Row']
export type ProcessInsertRow = Database['public']['Tables']['processes']['Insert']
export type ProcessUpdateRow = Database['public']['Tables']['processes']['Update']
