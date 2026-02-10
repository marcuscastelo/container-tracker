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

// Helper type for nullable results (e.g., findById that may not find anything)
export type SupabaseNullableResult<T extends {}> =
  | {
      success: true
      data: T | null
      error: null
    }
  | {
      success: false
      data: null
      error: Error
    }
