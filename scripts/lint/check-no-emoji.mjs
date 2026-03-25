/**
 * check-no-emoji — Detects emoji/symbol characters used as visual elements in source code.
 *
 * Scans `src/**\/*.{ts,tsx}` for emoji and decorative Unicode symbols that should be
 * replaced by SVG icons (lucide-solid or custom SVGs in shared/ui/icons).
 *
 * Usage:
 *   node scripts/lint/check-no-emoji.mjs
 *   pnpm run check:no-emoji
 *
 * Exit code 1 when violations are found.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Emoji / symbol detection regex
// ---------------------------------------------------------------------------

// Covers:
// - Emoticons, Dingbats, Misc Symbols, Supplemental Symbols
// - Transport/Map symbols, enclosed alphanumerics supplement
// - Variation selectors (FE00–FE0F), ZWJ (200D), combining enclosing keycap (20E3)
// - Tags block (E0020–E007F)
// - Common decorative Unicode symbols used as visual icons
//
// Pure comment lines are skipped by the scanner (see isCommentLine), so arrows
// used inside comments/JSDoc are not flagged. Arrows or decorative symbols that
// appear in code (including JSX or string literals) will be detected by this
// script and should be replaced with an appropriate SVG icon when used as a
// visual element.
const EMOJI_PATTERN = new RegExp(
  [
    // Standard emoji blocks
    '[\\u{1F300}-\\u{1F9FF}]', // Misc Symbols & Pictographs, Emoticons, etc.
    '[\\u{2600}-\\u{26FF}]', // Misc Symbols (☀ ⚠ ⛔ etc.)
    '[\\u{2700}-\\u{27BF}]', // Dingbats (✂ ✈ ✉ ✓ ✗ etc.)
    '[\\u{FE00}-\\u{FE0F}]', // Variation Selectors
    '[\\u{1F000}-\\u{1FFFF}]', // Mahjong, Playing Cards, Enclosed Supp, etc.
    '\\u{200D}', // Zero Width Joiner
    '\\u{20E3}', // Combining Enclosing Keycap
    '[\\u{E0020}-\\u{E007F}]', // Tags

    // Decorative Unicode symbols commonly used as pseudo-icons
    '[\\u{2460}-\\u{24FF}]', // Enclosed Alphanumerics (①②③ etc.)
    '[●○◉◎◆◇◐■□▲△▼▽►◄▸◂]',
    '[★☆✦✧✩✪✫✬✭✮✯]',
    '[♠♣♥♦♤♧♡♢]',
    '[☐☑☒]',
    '[✓✔✕✖✗✘]',
    '[⏳⏱⏰]', // Hourglass, timers
    '[↑↓↵]', // Arrows used as visual UI (sort, keyboard hints)
  ].join('|'),
  'gu',
)

// ---------------------------------------------------------------------------
// Allowlist — paths or patterns that are exempt from the check
// ---------------------------------------------------------------------------

/** Exact file paths (relative to repo root) that may contain emoji. */
const ALLOWED_PATHS = new Set([
  // Add exceptions here with a comment explaining why.
  // Example: 'src/shared/ui/icons/emoji-fixture.ts'
])

/**
 * Line-level allowlist: if a line contains this comment, it is skipped.
 * Use sparingly and always with explanation:
 *   // emoji-ok: external payload fixture
 */
const INLINE_SUPPRESS = '// emoji-ok'

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

const EXTENSIONS = new Set(['.ts', '.tsx'])

async function findFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  let files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files = files.concat(await findFiles(full))
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full)
    }
  }
  return files
}

// ---------------------------------------------------------------------------
// Comment detection (skip lines that are pure comments)
// ---------------------------------------------------------------------------

function isCommentLine(line) {
  const trimmed = line.trimStart()
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*/')
  )
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

async function scanFile(filePath, repoRoot) {
  const relative = path.relative(repoRoot, filePath)
  if (ALLOWED_PATHS.has(relative)) return []

  const content = await readFile(filePath, 'utf8')
  const lines = content.split('\n')
  const violations = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip inline suppressions
    if (line.includes(INLINE_SUPPRESS)) continue

    // Skip pure comment lines — arrows in JSDoc/comments are not visual UI
    if (isCommentLine(line)) continue

    const matches = [...line.matchAll(EMOJI_PATTERN)]
    if (matches.length > 0) {
      const chars = matches.map((m) => m[0])
      violations.push({
        file: relative,
        line: i + 1,
        chars,
        snippet: line.trimStart().slice(0, 120),
      })
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const repoRoot = process.cwd()
const srcDir = path.join(repoRoot, 'src')

const files = await findFiles(srcDir)
const allViolations = []

for (const file of files) {
  const v = await scanFile(file, repoRoot)
  allViolations.push(...v)
}

if (allViolations.length > 0) {
  console.error(
    `\n\x1b[31m✖ check:no-emoji — found ${allViolations.length} emoji/symbol violation(s):\x1b[0m\n`,
  )
  for (const v of allViolations) {
    const charDisplay = v.chars
      .map((c) => `"${c}" (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`)
      .join(', ')
    console.error(`  \x1b[36m${v.file}:${v.line}\x1b[0m`)
    console.error(`    ${v.snippet}`)
    console.error(`    Found: ${charDisplay}`)
    console.error(
      `    \x1b[33m→ Replace with a lucide-solid icon or SVG in shared/ui/icons/\x1b[0m`,
    )
    console.error()
  }
  console.error(
    `\x1b[2mTo suppress a specific line, add ${INLINE_SUPPRESS}: <reason> at end of line.\x1b[0m\n`,
  )
  process.exit(1)
} else {
  console.log('\x1b[32m✔ check:no-emoji — no emoji/symbol violations found.\x1b[0m')
}
