// Vitest setup: polyfills and env defaults used during tests

// Simple in-memory localStorage polyfill for Node environment
class LocalStorageMock {
  private store: Record<string, string> = {}
  getItem(key: string) {
    return Object.hasOwn(this.store, key) ? this.store[key] : null
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value)
  }
  removeItem(key: string) {
    delete this.store[key]
  }
  clear() {
    this.store = {}
  }
}

// @ts-expect-error: globalThis typing
globalThis.localStorage = new LocalStorageMock()

// Provide default VITE_* env variables expected by zod checks in tests
process.env.VITE_PUBLIC_SUPABASE_ANON_KEY =
  process.env.VITE_PUBLIC_SUPABASE_ANON_KEY || 'supabase-anon-key'
process.env.VITE_PUBLIC_SUPABASE_URL =
  process.env.VITE_PUBLIC_SUPABASE_URL || 'https://supabase.test'
process.env.VITE_EXTERNAL_API_FOOD_PARAMS = process.env.VITE_EXTERNAL_API_FOOD_PARAMS || '{}'
process.env.VITE_EXTERNAL_API_REFERER =
  process.env.VITE_EXTERNAL_API_REFERER || 'https://example.test'
process.env.VITE_EXTERNAL_API_HOST = process.env.VITE_EXTERNAL_API_HOST || 'api.test'
process.env.VITE_EXTERNAL_API_AUTHORIZATION = process.env.VITE_EXTERNAL_API_AUTHORIZATION || 'token'
process.env.VITE_EXTERNAL_API_FOOD_ENDPOINT = process.env.VITE_EXTERNAL_API_FOOD_ENDPOINT || '/food'
process.env.VITE_EXTERNAL_API_EAN_ENDPOINT = process.env.VITE_EXTERNAL_API_EAN_ENDPOINT || '/ean'
process.env.VITE_EXTERNAL_API_BASE_URL =
  process.env.VITE_EXTERNAL_API_BASE_URL || 'https://external.api'

// Server runtime env defaults used by route/controller bootstrap tests
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-key'
process.env.SYNC_DEFAULT_TENANT_ID =
  process.env.SYNC_DEFAULT_TENANT_ID || '11111111-1111-4111-8111-111111111111'

// Any other globals tests may expect can be polyfilled here as needed
