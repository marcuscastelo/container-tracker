import { createClient } from '@supabase/supabase-js'

import { serverEnv } from '~/shared/config/server-env'

/**
 * Server-side Supabase client:
 * - Uses service role key (bypasses RLS where applicable)
 * - Disables auth session persistence (stateless server runtime)
 */
export const supabaseServer = createClient(
  serverEnv.SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
)
