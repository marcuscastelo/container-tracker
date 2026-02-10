import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewProcess } from '~/modules/process/domain/process'
import { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'

// Type for the mocked supabase chain
type MockSupabaseChain = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
}

// Mock the supabase client
vi.mock('~/shared/supabase/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

// Mock the process mappers
vi.mock('~/modules/process/infrastructure/persistence/processMapper', () => ({
  processMappers: {
    rowToProcess: vi.fn((row) => ({
      id: row.id,
      reference: row.reference,
      origin: row.origin,
      destination: row.destination,
      carrier: row.carrier,
      bill_of_lading: row.bill_of_lading,
      booking_number: row.booking_number,
      source: row.source,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    })),
  },
}))

import { supabase } from '~/shared/supabase/supabase'

describe('supabaseProcessRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchById', () => {
    it('should return SupabaseResult with process data on success', async () => {
      const mockProcessRow = {
        id: 'test-id-123',
        reference: 'REF-001',
        origin: { unlocode: 'CNSHG' },
        destination: { unlocode: 'USLAX' },
        carrier: 'maersk',
        bill_of_lading: 'BL-001',
        booking_number: 'BK-001',
        source: 'manual',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const mockSupabaseChain: MockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProcessRow,
          error: null,
        }),
        insert: vi.fn().mockReturnThis(),
      }

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain)

      const result = await supabaseProcessRepository.fetchById('test-id-123')

      expect(result.success).toBe(true)
      expect(result.error).toBeNull()
      expect(result.data).toEqual(
        expect.objectContaining({
          id: 'test-id-123',
          reference: 'REF-001',
        }),
      )
      expect(supabase.from).toHaveBeenCalledWith('processes')
    })

    it('should return SupabaseResult with null data when process not found (PGRST116)', async () => {
      const mockSupabaseChain: MockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        }),
        insert: vi.fn().mockReturnThis(),
      }

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain)

      const result = await supabaseProcessRepository.fetchById('non-existent-id')

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
      expect(result.error).toBeNull()
    })

    it('should return SupabaseResult with error on database error', async () => {
      const mockSupabaseChain: MockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST500', message: 'Database connection failed' },
        }),
        insert: vi.fn().mockReturnThis(),
      }

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain)

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await supabaseProcessRepository.fetchById('test-id')

      expect(result.success).toBe(false)
      expect(result.data).toBeNull()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toContain('Failed to fetch process test-id')
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('create', () => {
    it('should return SupabaseResult with created process on success', async () => {
      const newProcess: NewProcess = {
        reference: 'REF-002',
        origin: { unlocode: 'USLAX' },
        destination: { unlocode: 'CNSHG' },
        carrier: 'msc',
        bill_of_lading: null,
        booking_number: null,
        source: 'manual',
      }

      const mockProcessRow = {
        id: 'created-id-456',
        reference: 'REF-002',
        origin: { unlocode: 'USLAX' },
        destination: { unlocode: 'CNSHG' },
        carrier: 'msc',
        bill_of_lading: null,
        booking_number: null,
        source: 'manual',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      }

      const mockSupabaseChain: MockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProcessRow,
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
      }

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain)

      const result = await supabaseProcessRepository.create(newProcess)

      expect(result.success).toBe(true)
      expect(result.error).toBeNull()
      expect(result.data).toEqual(
        expect.objectContaining({
          id: 'created-id-456',
          reference: 'REF-002',
        }),
      )
      expect(supabase.from).toHaveBeenCalledWith('processes')
      expect(mockSupabaseChain.insert).toHaveBeenCalled()
    })

    it('should return SupabaseResult with error on database insert error', async () => {
      const newProcess: NewProcess = {
        reference: 'REF-003',
        origin: { unlocode: 'CNSHG' },
        destination: { unlocode: 'USLAX' },
        carrier: 'maersk',
        bill_of_lading: null,
        booking_number: null,
        source: 'manual',
      }

      const mockSupabaseChain: MockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Duplicate key violation' },
        }),
        eq: vi.fn().mockReturnThis(),
      }

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain)

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await supabaseProcessRepository.create(newProcess)

      expect(result.success).toBe(false)
      expect(result.data).toBeNull()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toContain('Failed to create process')
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should return SupabaseResult with error when no data is returned', async () => {
      const newProcess: NewProcess = {
        reference: 'REF-004',
        origin: { unlocode: 'CNSHG' },
        destination: { unlocode: 'USLAX' },
        carrier: 'maersk',
        bill_of_lading: null,
        booking_number: null,
        source: 'manual',
      }

      const mockSupabaseChain: MockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
      }

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain)

      const result = await supabaseProcessRepository.create(newProcess)

      expect(result.success).toBe(false)
      expect(result.data).toBeNull()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toContain('no data returned')
    })
  })
})
