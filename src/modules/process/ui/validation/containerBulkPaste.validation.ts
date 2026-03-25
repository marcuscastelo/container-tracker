const INVISIBLE_CHARACTERS_REGEX = /[\u200B-\u200D\u2060\uFEFF]/g
const MARKDOWN_BULLET_PREFIX_REGEX = /^\s*[-*•]\s+/gm
const WRAPPER_CHARACTERS_REGEX = /[[\]"'`“”‘’]/g
const CONTAINER_SPLIT_REGEX = /[\s,;\n\t]+/

export const MAX_CONTAINERS_PER_PASTE = 100

type ParsedContainerBulkPaste =
  | { readonly type: 'none' }
  | { readonly type: 'single'; readonly value: string }
  | { readonly type: 'multiple'; readonly values: readonly string[] }
  | {
      readonly type: 'limit-exceeded'
      readonly detectedCount: number
      readonly maxAllowed: number
    }

type MergeBulkPastedContainersInput = {
  readonly existingContainerNumbers: readonly string[]
  readonly targetIndex: number
  readonly pastedValues: readonly string[]
}

type MergeBulkPastedContainersResult = {
  readonly nextContainerNumbers: readonly string[]
  readonly appliedValues: readonly string[]
}

function normalizeContainerToken(value: string): string {
  return value.toUpperCase().trim()
}

function stripPasteNoise(rawInput: string): string {
  return rawInput
    .replace(INVISIBLE_CHARACTERS_REGEX, '')
    .replace(MARKDOWN_BULLET_PREFIX_REGEX, '')
    .replace(WRAPPER_CHARACTERS_REGEX, '')
}

function toNormalizedContainerTokens(rawInput: string): readonly string[] {
  const normalizedText = stripPasteNoise(rawInput)
  return normalizedText
    .split(CONTAINER_SPLIT_REGEX)
    .map((token) => normalizeContainerToken(token))
    .filter((token) => token.length > 0)
}

function dedupeTokens(tokens: readonly string[]): readonly string[] {
  const seen = new Set<string>()
  const uniqueTokens: string[] = []

  for (const token of tokens) {
    if (seen.has(token)) continue
    seen.add(token)
    uniqueTokens.push(token)
  }

  return uniqueTokens
}

export function parseContainerBulkPaste(
  rawInput: string,
  maxAllowed = MAX_CONTAINERS_PER_PASTE,
): ParsedContainerBulkPaste {
  const normalizedTokens = toNormalizedContainerTokens(rawInput)
  const uniqueTokens = dedupeTokens(normalizedTokens)

  if (uniqueTokens.length === 0) {
    return { type: 'none' }
  }

  if (uniqueTokens.length > maxAllowed) {
    return {
      type: 'limit-exceeded',
      detectedCount: uniqueTokens.length,
      maxAllowed,
    }
  }

  if (normalizedTokens.length === 1) {
    return {
      type: 'single',
      value: uniqueTokens[0] ?? '',
    }
  }

  return {
    type: 'multiple',
    values: uniqueTokens,
  }
}

export function mergeBulkPastedContainers(
  input: MergeBulkPastedContainersInput,
): MergeBulkPastedContainersResult {
  const current = [...input.existingContainerNumbers]
  if (input.targetIndex < 0 || input.targetIndex >= current.length) {
    return { nextContainerNumbers: current, appliedValues: [] }
  }

  const existingWithoutTarget = new Set(
    current
      .filter((_, index) => index !== input.targetIndex)
      .map((value) => normalizeContainerToken(value))
      .filter((value) => value.length > 0),
  )

  const seen = new Set<string>()
  const valuesToApply: string[] = []

  for (const value of input.pastedValues) {
    const normalized = normalizeContainerToken(value)
    if (normalized.length === 0) continue
    if (seen.has(normalized)) continue
    if (existingWithoutTarget.has(normalized)) continue

    seen.add(normalized)
    valuesToApply.push(normalized)
  }

  if (valuesToApply.length === 0) {
    return { nextContainerNumbers: current, appliedValues: [] }
  }

  const [firstValue, ...valuesAfterTarget] = valuesToApply
  if (firstValue === undefined) {
    return { nextContainerNumbers: current, appliedValues: [] }
  }

  const nextWithTargetReplaced = current.map((value, index) =>
    index === input.targetIndex ? firstValue : value,
  )

  return {
    nextContainerNumbers: [
      ...nextWithTargetReplaced.slice(0, input.targetIndex + 1),
      ...valuesAfterTarget,
      ...nextWithTargetReplaced.slice(input.targetIndex + 1),
    ],
    appliedValues: valuesToApply,
  }
}
