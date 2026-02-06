// T is non-nullable object type representing the expected data shape from Supabase
export type SupabaseResult<T extends {}> =
  | {
      success: true
      data: T
      error: null
    }
  | {
      success: false
      data: null
      error: Error
    }
