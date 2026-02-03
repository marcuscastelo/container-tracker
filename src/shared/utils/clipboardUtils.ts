import { type z } from 'zod/v4'

import { jsonParseWithStack } from '~/shared/utils/jsonParseWithStack'
import { logging } from '~/shared/utils/logging'

export function deserializeClipboard<T extends z.ZodType<unknown>>(
  clipboard: string,
  allowedSchema: T,
): z.infer<T> | null {
  let parsed: unknown
  try {
    parsed = jsonParseWithStack(clipboard)
    if (typeof parsed !== 'object' || parsed === null) {
      logging.error('Clipboard deserializeClipboard - JSON is not an object:', {
        clipboard,
        parsed,
      })
      return null
    }
  } catch (error) {
    logging.error(`Clipboard deserializeClipboard - Invalid JSON`, error, {
      clipboard,
    })
    return null
  }
  const result = allowedSchema.safeParse(parsed)
  if (!result.success) {
    logging.error(
      'Clipboard deserializeClipboard - Invalid data:',
      result.error,
      { clipboard, parsed },
    )
    return null
  }
  return result.data
}
