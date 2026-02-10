import { createClient } from '@supabase/supabase-js'
import { z } from 'zod/v4'

import { env } from '~/shared/config/env'
import type { Database } from '~/shared/supabase/database.types'
import { parseWithStack } from '~/shared/utils/parseWithStack'

const supabaseUrl = parseWithStack(z.string(), env.VITE_PUBLIC_SUPABASE_URL)

const supabaseAnonKey = parseWithStack(z.string(), env.VITE_PUBLIC_SUPABASE_ANON_KEY)

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
    // In server / prerender environments localStorage is not available.
    // Provide a no-op storage implementation when running outside the
    // browser to avoid ReferenceError during build/prerender.
    storage: ((): Storage => {
      if (typeof window !== 'undefined') return localStorage

      // Minimal Storage-like no-op implementation used during SSR/prerender.
      const noopStorage: Storage = {
        length: 0,
        clear(): void {
          /* no-op */
        },
        getItem(_key: string): string | null {
          return null
        },
        key(_index: number): string | null {
          return null
        },
        removeItem(_key: string): void {
          /* no-op */
        },
        setItem(_key: string, _value: string): void {
          /* no-op */
        },
      }

      return noopStorage
    })(),
  },
})

export type RealtimeEvent<T = unknown> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  old?: T
  new?: T
}

export function registerSubapabaseRealtimeCallback<T>(
  table: string,
  validator: z.ZodType<T>,
  callback: (payload: RealtimeEvent<T>) => void,
): void {
  const handleCallback = (payload: unknown) => {
    console.debug(`SUPABASE_REALTIME - ${table} -> payload=`, payload)
    const result = z
      .object({
        eventType: z.enum(['INSERT', 'UPDATE', 'DELETE']),
        old: z.unknown().optional(),
        new: z.unknown().optional(),
      })
      .safeParse(payload)

    if (!result.success) {
      console.error('SUPABASE_REALTIME - Invalid payload structure', result.error)
      return
    }
    const payloadData = result.data

    const eventType = payloadData.eventType

    const oldRecord = payloadData.old !== null ? validator.safeParse(payloadData.old) : null

    const newRecord = payloadData.new !== null ? validator.safeParse(payloadData.new) : null

    callback({
      eventType,
      old: oldRecord?.success ? oldRecord.data : undefined,
      new: newRecord?.success ? newRecord.data : undefined,
    })
  }

  supabase
    .channel(table)
    .on('postgres_changes', { event: '*', schema: 'public', table }, handleCallback)
    .subscribe()
}
