import { z } from 'zod/v4'

export function toReadableErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)

  const nestedMessage = message.match(/"message"\s*:\s*"([^"]+)"/)
  if (nestedMessage?.[1]) {
    return nestedMessage[1]
  }

  const afterStatus = message.replace(/^.*?:\s*\d{3}\s*/, '')
  if (afterStatus && afterStatus.length > 0 && afterStatus.length < message.length) {
    return afterStatus.trim()
  }

  return message
}

export function readErrorFromJsonBody(body: unknown): string | null {
  const parsed = z
    .object({
      error: z.string().optional(),
    })
    .safeParse(body)

  if (!parsed.success) {
    return null
  }

  const maybeError = parsed.data.error
  if (typeof maybeError === 'string' && maybeError.trim().length > 0) {
    return maybeError
  }

  return null
}
