export function parseDate(input: unknown): Date | null {
  if (input == null || input === '') return null
  if (input instanceof Date) return input
  if (typeof input === 'number') {
    const d = new Date(input)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof input === 'string') {
    // MS /Date(1765887180000)/
    const msMatch = input.match(/\/Date\((-?\d+)\)\//)
    if (msMatch) {
      const ms = Number(msMatch[1])
      const d = new Date(ms)
      return Number.isNaN(d.getTime()) ? null : d
    }
    // ISO
    const iso = new Date(input)
    if (!Number.isNaN(iso.getTime())) return iso
    // dd/mm/yyyy
    const dm = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (dm) {
      const day = Number(dm[1])
      const month = Number(dm[2]) - 1
      const year = Number(dm[3])
      const d = new Date(Date.UTC(year, month, day))
      return Number.isNaN(d.getTime()) ? null : d
    }
  }
  return null
}
