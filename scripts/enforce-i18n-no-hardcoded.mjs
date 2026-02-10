#!/usr/bin/env node

/**
 * enforce-i18n-no-hardcoded.mjs
 *
 * CI enforcement script that detects hardcoded user-facing strings in TSX/JSX
 * files that should be using the i18n system instead.
 *
 * Heuristics:
 *   - Conservative in SCOPE: only scans `.tsx` files under `src/` (the JSX layer).
 *     Does NOT scan `.ts` files (application/domain/infrastructure layers), because
 *     those layers have legitimate uses of English strings (enum labels, domain values,
 *     error messages for logging, normalizer maps, etc.).
 *   - Aggressive in DETECTION: within TSX files, it flags any hardcoded English or
 *     Portuguese text in user-facing regions (JSX text content, `title=`, `aria-label=`,
 *     `placeholder=`, SVG `<title>`, `window.confirm()`, `window.alert()`).
 *
 * Allowlisted patterns:
 *   - `{t(keys.xxx)}` / `{t(keys.xxx) ?? ...}` expressions (correct i18n usage)
 *   - Brand names: Maersk, MSC, CMA CGM (proper nouns)
 *   - CSS/Tailwind classes, HTML boolean attributes, `data-*`, `role=`, `type=`,
 *     `viewBox=`, `d=`, `stroke*=`, `fill=`, `xmlns=`, etc.
 *   - Single characters, numbers, punctuation (em-dashes, arrows, etc.)
 *   - `console.log/warn/error/debug` arguments
 *   - Comments and imports
 *   - `// i18n-enforce-ignore` inline suppression
 *
 * Exit code:
 *   0  → no violations found
 *   1  → violations found (CI should fail)
 *   2  → script error
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const SRC_DIR = path.join(process.cwd(), 'src')
const EXTENSIONS = ['.tsx']

/**
 * Brand names that are proper nouns and should NOT be i18n'd.
 * Case-insensitive comparison.
 */
const BRAND_ALLOWLIST = new Set([
  'maersk',
  'msc',
  'cma cgm',
  'solid',
  'solidjs',
  'solidjs.com',
  'supabase',
  'container tracker',
])

/**
 * Single-word technical tokens that appear in JSX text content and are safe.
 */
const TOKEN_ALLOWLIST = new Set([
  'i', // info button label
  'x', // close button label
  'ok',
  'n/a',
])

/**
 * Inline comment to suppress a specific line:
 *   {/* i18n-enforce-ignore *​/}
 *   // i18n-enforce-ignore
 */
const SUPPRESS_COMMENT = 'i18n-enforce-ignore'

// ─────────────────────────────────────────────────────────────────────────────
// File discovery
// ─────────────────────────────────────────────────────────────────────────────

async function findFiles(dir, exts) {
  const entries = await readdir(dir, { withFileTypes: true })
  let files = []
  for (const e of entries) {
    const fullPath = path.join(dir, e.name)
    if (e.isDirectory()) {
      files = files.concat(await findFiles(fullPath, exts))
    } else if (exts.includes(path.extname(e.name))) {
      files.push(fullPath)
    }
  }
  return files
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection Rules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the string looks like it contains user-facing natural language text.
 * This is the core heuristic — intentionally aggressive.
 */
function looksLikeUserFacingText(str) {
  const trimmed = str.trim()

  // Empty or whitespace-only
  if (!trimmed) return false

  // Single character (punctuation, letter used as icon label like "i")
  if (trimmed.length <= 1) return false

  // Pure punctuation / symbols / numbers / emoji / arrows / dashes
  // Allow: —, →, ←, ↑, ↓, •, ·, ×, +, -, numbers, whitespace, emoji
  if (
    /^[\s\d\p{Emoji_Presentation}\p{So}\p{Pd}\p{Po}\p{Ps}\p{Pe}\p{Pi}\p{Pf}+×·•→←↑↓…—–''""]+$/u.test(
      trimmed,
    )
  )
    return false

  // Looks like a CSS class list (space-separated lowercase-with-dashes tokens)
  if (/^[a-z0-9\-/.:[\]()@! ]+$/.test(trimmed) && !trimmed.includes(' ')) return false

  // Looks like a code expression (contains JS operators like &&, ||, ===, !==, ?, .)
  // This catches false positives from comparison operators inside JSX expressions
  // that get mismatched by the > < regex as tag boundaries
  if (/&&|\|\||===?|!==?|=>|\.\w+\(/.test(trimmed)) return false

  // Check brand allowlist
  if (BRAND_ALLOWLIST.has(trimmed.toLowerCase())) return false

  // Check token allowlist
  if (TOKEN_ALLOWLIST.has(trimmed.toLowerCase())) return false

  // Must contain at least one letter (rules out pure numbers, symbols)
  if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) return false

  // Must contain at least 2 consecutive word characters to look like a word
  if (!/[a-zA-ZÀ-ÿ]{2,}/.test(trimmed)) return false

  return true
}

/**
 * Check if a line is suppressed via inline comment.
 */
function isSuppressed(line) {
  return line.includes(SUPPRESS_COMMENT)
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule: JSX text content between tags
//
// Detects: >Some English Text</tag>
// Ignores: >{t(keys.xxx)}</tag>, >{someVariable}</tag>, expressions
// ─────────────────────────────────────────────────────────────────────────────

function checkJsxTextContent(lines, violations) {
  // Strategy: find text nodes between > and < that are not inside expressions.
  // We look for patterns like:  >Some text<  or  >Some text\n on next line
  // This regex captures text after a closing > that is not immediately a {
  //
  // Multi-line: we also accumulate text across lines between > and <

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isSuppressed(line)) continue

    // Skip lines that are comments
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue

    // Skip import lines
    if (/^\s*import\s/.test(line)) continue

    // Skip console.* lines
    if (/\bconsole\.(log|warn|error|debug|info|trace)\b/.test(line)) continue

    // Match: >TEXT< where TEXT is not empty and not an expression
    // The regex handles: <tag>TEXT</tag>, <tag>TEXT</tag>, <Component>TEXT</Component>
    const textBetweenTagsRegex = />([^<{}\n]+)</g
    for (
      let match = textBetweenTagsRegex.exec(line);
      match;
      match = textBetweenTagsRegex.exec(line)
    ) {
      const text = match[1]
      if (!looksLikeUserFacingText(text)) continue

      // Check if this is inside a <title> SVG element — handled separately
      // Skip — we have a dedicated rule for <title>
      if (/<title>/i.test(line.slice(0, match.index))) continue

      violations.push({
        line: i + 1,
        rule: 'jsx-text-content',
        text: text.trim(),
        raw: line.trim(),
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule: Hardcoded string in title=, aria-label=, placeholder= attributes
//
// Detects: title="Some text", aria-label="Some text", placeholder="Some text"
// Ignores: title={t(keys.xxx)}, title={someVar}, title="true"
// ─────────────────────────────────────────────────────────────────────────────

function checkHardcodedAttributes(lines, violations) {
  const attrRegex = /\b(title|aria-label|placeholder)\s*=\s*"([^"]*)"/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isSuppressed(line)) continue
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue

    for (let match = attrRegex.exec(line); match; match = attrRegex.exec(line)) {
      const attrName = match[1]
      const value = match[2]

      if (!looksLikeUserFacingText(value)) continue

      violations.push({
        line: i + 1,
        rule: `hardcoded-${attrName}`,
        text: value,
        raw: line.trim(),
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule: SVG <title> with hardcoded text
//
// Detects: <title>Some text</title>
// Ignores: <title>{t(keys.xxx)}</title>
// ─────────────────────────────────────────────────────────────────────────────

function checkSvgTitle(lines, violations) {
  const titleRegex = /<title>([^<{]+)<\/title>/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isSuppressed(line)) continue
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue

    for (let match = titleRegex.exec(line); match; match = titleRegex.exec(line)) {
      const text = match[1]
      if (!looksLikeUserFacingText(text)) continue

      violations.push({
        line: i + 1,
        rule: 'svg-title-hardcoded',
        text: text.trim(),
        raw: line.trim(),
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule: Hardcoded fallback in ?? or || with user-facing text
//
// Detects: ?? 'Some text', ?? "Some text", || 'Some text'
// Context: these are fallback strings that should be i18n keys when in JSX
// We limit this to patterns that look like they produce user-facing output
// ─────────────────────────────────────────────────────────────────────────────

function checkHardcodedFallbacks(lines, violations) {
  // Match: ?? 'text' or ?? "text" or || 'text' or || "text"
  const fallbackRegex = /(\?\?|\|\|)\s*(['"])([^'"]{2,})\2/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isSuppressed(line)) continue
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue
    if (/^\s*import\s/.test(line)) continue

    // Skip console.* lines
    if (/\bconsole\.(log|warn|error|debug|info|trace)\b/.test(line)) continue

    // Skip lines that are clearly error construction (new Error, throw)
    if (/\b(new\s+Error|throw)\b/.test(line)) continue

    for (let match = fallbackRegex.exec(line); match; match = fallbackRegex.exec(line)) {
      const text = match[3]
      if (!looksLikeUserFacingText(text)) continue

      // Additional context: is this in a JSX-producing context?
      // Check if the line contains JSX-like patterns: title=, aria-label=,
      // return, <tag, {expression}, or attribute assignment
      const isJsxContext =
        /\btitle\s*=/.test(line) ||
        /\baria-label\s*=/.test(line) ||
        /\bplaceholder\s*=/.test(line) ||
        /<title>/.test(line) ||
        />\s*\{/.test(line) ||
        /\{[^}]*$/.test(line) // unclosed expression

      if (!isJsxContext) continue

      violations.push({
        line: i + 1,
        rule: 'hardcoded-fallback',
        text: text.trim(),
        raw: line.trim(),
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule: window.confirm() / window.alert() with hardcoded strings
//
// Detects: window.confirm('text'), confirm('text'), alert('text'), alert(`text`)
// These are always user-facing and should use i18n.
// ─────────────────────────────────────────────────────────────────────────────

function checkWindowDialogs(lines, violations) {
  const dialogRegex = /\b(window\.)?(confirm|alert)\s*\(\s*(['"`])/g

  // Also handle multi-line case: confirm(\n  'text')
  // We join pairs of lines to catch strings that start on the next line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isSuppressed(line)) continue
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue

    // Check single-line match
    for (let match = dialogRegex.exec(line); match; match = dialogRegex.exec(line)) {
      const funcName = match[2]
      const quote = match[3]
      const afterQuote = line.slice(match.index + match[0].length)
      let text
      if (quote === '`') {
        const endIdx = afterQuote.indexOf('`')
        text = endIdx >= 0 ? afterQuote.slice(0, endIdx) : afterQuote
      } else {
        const endIdx = afterQuote.indexOf(quote)
        text = endIdx >= 0 ? afterQuote.slice(0, endIdx) : afterQuote
      }

      violations.push({
        line: i + 1,
        rule: `hardcoded-${funcName}`,
        text: text.trim().slice(0, 80) + (text.length > 80 ? '…' : ''),
        raw: line.trim(),
      })
    }

    // Check multi-line case: confirm/alert call on this line, string on next line
    const multiLineOpener = /\b(window\.)?(confirm|alert)\s*\(\s*$/
    const openerMatch = multiLineOpener.exec(line)
    if (openerMatch && i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      if (isSuppressed(nextLine)) continue
      const strMatch = nextLine.match(/^\s*(['"`])(.+?)\1/)
      if (strMatch) {
        const funcName = openerMatch[2]
        const text = strMatch[2]
        violations.push({
          line: i + 2, // report on the line with the actual string
          rule: `hardcoded-${funcName}`,
          text: text.trim().slice(0, 80) + (text.length > 80 ? '…' : ''),
          raw: nextLine.trim(),
        })
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule: sr-only spans with hardcoded text
//
// Detects: <span class="sr-only">Some text</span>
// These are screen-reader-only and must be i18n'd.
// ─────────────────────────────────────────────────────────────────────────────

function checkSrOnlyText(lines, violations) {
  const srOnlyRegex = /class="[^"]*\bsr-only\b[^"]*"[^>]*>([^<{]+)</g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isSuppressed(line)) continue
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue

    for (let match = srOnlyRegex.exec(line); match; match = srOnlyRegex.exec(line)) {
      const text = match[1]
      if (!looksLikeUserFacingText(text)) continue

      violations.push({
        line: i + 1,
        rule: 'sr-only-hardcoded',
        text: text.trim(),
        raw: line.trim(),
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const files = await findFiles(SRC_DIR, EXTENSIONS)

  if (files.length === 0) {
    console.error('No TSX files found under src/')
    process.exit(2)
  }

  let totalViolations = 0
  const allViolations = []

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8')
    const lines = content.split('\n')
    const violations = []

    checkJsxTextContent(lines, violations)
    checkHardcodedAttributes(lines, violations)
    checkSvgTitle(lines, violations)
    checkHardcodedFallbacks(lines, violations)
    checkWindowDialogs(lines, violations)
    checkSrOnlyText(lines, violations)

    if (violations.length > 0) {
      const relPath = path.relative(process.cwd(), filePath)
      for (const v of violations) {
        allViolations.push({ file: relPath, ...v })
      }
      totalViolations += violations.length
    }
  }

  if (totalViolations === 0) {
    console.log(`✅ No hardcoded user-facing strings found in ${files.length} TSX files.`)
    process.exit(0)
  }

  // Group violations by file
  const byFile = new Map()
  for (const v of allViolations) {
    if (!byFile.has(v.file)) byFile.set(v.file, [])
    byFile.get(v.file).push(v)
  }

  console.error(`\n❌ Found ${totalViolations} hardcoded user-facing string(s) in TSX files:\n`)

  for (const [file, violations] of byFile.entries()) {
    console.error(`  ${file}:`)
    for (const v of violations) {
      console.error(`    L${v.line} [${v.rule}] "${v.text}"`)
    }
    console.error('')
  }

  console.error('Fix: replace hardcoded strings with t(keys.xxx) from useTranslation().')
  console.error('Suppress false positives with an inline comment: // i18n-enforce-ignore')
  console.error(`  or: {/* i18n-enforce-ignore */}`)

  process.exit(1)
}

main().catch((err) => {
  console.error('enforce-i18n-no-hardcoded: script error', err)
  process.exit(2)
})
