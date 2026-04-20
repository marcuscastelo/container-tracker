import { createClient } from '@supabase/supabase-js'
import { serverEnv } from '~/shared/config/server-env'
import { HttpError } from '~/shared/errors/httpErrors'
import type { Database } from '~/shared/supabase/database.types'

export function createSupabaseRequestAuthClient(accessToken: string) {
  if (!serverEnv.SUPABASE_ANON_KEY) {
    throw new HttpError('Missing SUPABASE_ANON_KEY for request auth validation', 500)
  }

  return createClient<Database>(serverEnv.SUPABASE_URL, serverEnv.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
  })
}
