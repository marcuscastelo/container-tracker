// T is the expected data shape from Supabase (use unknown when shape is not important)
export type SupabaseResult<T = unknown> =
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
