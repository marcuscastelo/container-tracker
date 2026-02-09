import { copyFile, readdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

async function readJson(file) {
  const txt = await readFile(file, 'utf8')
  return JSON.parse(txt)
}

function flatten(obj, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v, key))
    } else {
      out.push(key)
    }
  }
  return out
}

async function findFiles(dir, exts = ['.ts', '.tsx', '.js', '.jsx']) {
  const entries = await readdir(dir, { withFileTypes: true })
  let files = []
  for (const e of entries) {
    const res = path.join(dir, e.name)
    if (e.isDirectory()) files = files.concat(await findFiles(res, exts))
    else if (exts.includes(path.extname(e.name))) files.push(res)
  }
  return files
}

async function main() {
  const localesDir = path.join(process.cwd(), 'src', 'locales')
  let localeFiles = []
  try {
    const all = await readdir(localesDir)
    localeFiles = all.filter((f) => f.endsWith('.json')).map((f) => path.join(localesDir, f))
  } catch (err) {
    console.error('Could not read locales directory:', err.message)
    process.exit(2)
  }

  if (localeFiles.length === 0) {
    console.error('No locale JSON files found in src/locales')
    process.exit(2)
  }

  const locales = {}
  for (const f of localeFiles) {
    try {
      const j = await readJson(f)
      const name = path.basename(f, '.json')
      locales[name] = new Set(flatten(j))
    } catch (err) {
      console.error('Failed parsing', f, err.message)
      process.exit(2)
    }
  }

  const refLocale = locales['en'] ? 'en' : Object.keys(locales)[0]
  const refKeys = locales[refLocale]
  console.log(`Reference locale: ${refLocale} (${refKeys.size} keys)`)

  // scan code for used keys
  const srcDir = path.join(process.cwd(), 'src')
  const files = await findFiles(srcDir)
  const usedKeys = new Set()
  const usedKeyLocations = {}

  // only consider string literals that look like i18n keys (contain a dot)
  // match t('...') but avoid matching other identifiers like alert(...)
  const literalRegex = /\bt\s*\(\s*['"`]{1}([^'"`]+)['"`]{1}/g
  // capture any const object used as keys across the codebase, e.g. `const keys = { ... }`
  const constObjRegex = /const\s+([A-Za-z0-9_]+)\s*=\s*{([\s\S]*?)}\s*;?/gm
  const keyEntryRegex = /([A-Za-z0-9_]+)\s*:\s*['"`]{1}([^'"`]+)['"`]{1}/g

  // Build a global map of key-objects defined anywhere in the source tree.
  // This lets us detect usages where the object is passed as a prop (e.g. props.keys)
  // or referenced via a chain like props.keys.someKey in other files.
  const globalKeyMap = {}
  for (const file of files) {
    const content = await readFile(file, 'utf8')
    let m
    while ((m = constObjRegex.exec(content))) {
      const varName = m[1]
      const body = m[2]
      let e
      while ((e = keyEntryRegex.exec(body))) {
        if (e[2] && e[2].includes('.')) {
          globalKeyMap[varName] = globalKeyMap[varName] || {}
          globalKeyMap[varName][e[1]] = e[2]
        }
      }
    }
  }

  // Additionally, detect local variables that receive `keys` via destructuring from useTranslation(),
  // e.g. `const { t, keys } = useTranslation()` or `const { keys: k } = useTranslation()`.
  // We'll record per-file which local identifiers are the translation-keys object so we can
  // map usages like `t(keys.shipmentView.header)` to the dotted key `shipmentView.header`.
  function findLocalKeysVars(content) {
    const res = new Set()
    // match const { ... } = useTranslation()
    const destructRegex = /const\s*{\s*([^}]+)\s*}\s*=\s*useTranslation\s*\(\s*\)/g
    let d
    while ((d = destructRegex.exec(content))) {
      const inner = d[1]
      const parts = inner.split(',').map((s) => s.trim())
      for (const p of parts) {
        // p can be 'keys' or 'keys: alias' or 't' or 't: tr'
        if (p.startsWith('keys')) {
          const colon = p.indexOf(':')
          if (colon >= 0) {
            const alias = p.slice(colon + 1).trim()
            if (alias) res.add(alias)
          } else {
            res.add('keys')
          }
        }
      }
    }
    return res
  }

  // helper to record a used key
  function markUsed(mapped, file) {
    usedKeys.add(mapped)
    usedKeyLocations[mapped] = usedKeyLocations[mapped] || new Set()
    usedKeyLocations[mapped].add(file)
  }

  // Now scan files for usages. We try multiple strategies:
  // 1) literal t('...') calls
  // 2) t(someChain.prop) where some segment of someChain matches a var in globalKeyMap
  // 3) generic t(...) calls where the argument contains expressions like keys.prop inside
  const tCallRegex = /\bt\s*\(\s*([^)]*?)\s*\)/g
  const chainPropRegex = /([A-Za-z0-9_\.]+)\.([A-Za-z0-9_]+)/g

  for (const file of files) {
    const content = await readFile(file, 'utf8')

    // detect local key-var names coming from useTranslation() in this file
    const localKeysVars = findLocalKeysVars(content)

    let m
    while ((m = literalRegex.exec(content))) {
      const cand = m[1].trim()
      // only accept candidates that look like i18n keys (e.g. contain a dot)
      if (cand.includes('.')) {
        markUsed(cand, file)
      }
    }

    // match any t(...) calls and search inside for chain.prop occurrences
    while ((m = tCallRegex.exec(content))) {
      const arg = m[1]
      let inner
      while ((inner = chainPropRegex.exec(arg))) {
        const varChain = inner[1]
        const prop = inner[2]
        // split chain and try to find any segment that maps to a global key object
        const segments = varChain.split('.')
        let matched = false
        for (const seg of segments) {
          if (seg in globalKeyMap && prop in globalKeyMap[seg]) {
            markUsed(globalKeyMap[seg][prop], file)
            matched = true
            break
          }
        }
        if (matched) continue

        // if this chain references a local keys var (from useTranslation),
        // e.g. `keys.shipmentView` or `k.shipmentView`, map to dotted key
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]
          if (localKeysVars.has(seg)) {
            const remaining = segments.slice(i + 1)
            // combined dotted key is remaining + prop
            const mapped = [...remaining, prop].filter(Boolean).join('.')
            if (mapped) {
              markUsed(mapped, file)
            }
            break
          }
        }
      }
    }

    // also handle direct usages like props.keys.shipmentHeader outside of t(...) by
    // scanning the whole file for chain.prop patterns and mapping any that we can
    let ch
    while ((ch = chainPropRegex.exec(content))) {
      const varChain = ch[1]
      const prop = ch[2]
      const segments = varChain.split('.')
      let handled = false
      for (const seg of segments) {
        if (seg in globalKeyMap && prop in globalKeyMap[seg]) {
          markUsed(globalKeyMap[seg][prop], file)
          handled = true
          break
        }
      }
      if (handled) continue

      // Map direct chains that start from a local keys var (from useTranslation)
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        if (localKeysVars.has(seg)) {
          const remaining = segments.slice(i + 1)
          const mapped = [...remaining, prop].filter(Boolean).join('.')
          if (mapped) markUsed(mapped, file)
          break
        }
      }
    }
  }

  // report missing keys per locale
  let totalMissing = 0
  for (const [loc, keysSet] of Object.entries(locales)) {
    if (loc === refLocale) continue
    const missing = [...refKeys].filter((k) => !keysSet.has(k))
    if (missing.length) {
      console.error(`Locale '${loc}' is missing ${missing.length} keys compared to ${refLocale}:`)
      for (const k of missing) console.error('  -', k)
      totalMissing += missing.length
    } else {
      console.log(`Locale '${loc}': OK`)
    }
  }

  // unused keys warnings (present in locale but not used anywhere)
  const unused = {}
  for (const [loc, keysSet] of Object.entries(locales)) {
    const unusedKeys = [...keysSet].filter((k) => !usedKeys.has(k))
    unused[loc] = unusedKeys
    if (unusedKeys.length) {
      console.warn(`Locale '${loc}' has ${unusedKeys.length} keys that appear unused:`)
      for (const k of unusedKeys.slice(0, 50)) console.warn('  -', k)
      if (unusedKeys.length > 50) console.warn(`  ...and ${unusedKeys.length - 50} more`)
    }
  }

  // option: remove unused keys in-place from locale JSON files
  if (process.argv.includes('--remove-unused')) {
    console.log('--remove-unused passed: removing unused keys from locale files')

    function removeKeyAndPrune(root, segments) {
      // build stack of { parent, key }
      const stack = []
      let node = root
      for (const seg of segments) {
        stack.push({ parent: node, key: seg })
        if (node && typeof node === 'object' && seg in node) {
          node = node[seg]
        } else {
          // path doesn't exist, nothing to remove
          return
        }
      }

      // delete the leaf
      const last = stack.pop()
      delete last.parent[last.key]

      // prune empty parents
      while (stack.length > 0) {
        const top = stack.pop()
        const maybe = top.parent[top.key]
        if (maybe && typeof maybe === 'object' && Object.keys(maybe).length === 0) {
          delete top.parent[top.key]
        } else {
          break
        }
      }
    }

    for (const f of localeFiles) {
      try {
        const txt = await readFile(f, 'utf8')
        const j = JSON.parse(txt)
        const name = path.basename(f, '.json')
        const toRemove = unused[name] || []
        if (!toRemove.length) continue

        // backup original file
        await copyFile(f, `${f}.bak`)

        for (const key of toRemove) {
          const segs = key.split('.')
          removeKeyAndPrune(j, segs)
        }

        // write back formatted JSON
        await writeFile(f, JSON.stringify(j, null, 2) + '\n', 'utf8')
        console.log(`Wrote ${f} (removed ${toRemove.length} keys). Backup at ${f}.bak`)
      } catch (err) {
        console.error('Failed to update', f, err.message)
      }
    }
  }

  // keys used in code but not present in reference
  const usedButMissing = [...usedKeys].filter((k) => !refKeys.has(k))
  if (usedButMissing.length) {
    console.warn(
      `There are ${usedButMissing.length} keys used in code but not present in reference locale (${refLocale}):`,
    )
    for (const k of usedButMissing.slice(0, 100)) {
      console.warn('  -', k)
      const locs = usedKeyLocations[k]
      if (locs && locs.size) {
        for (const l of Array.from(locs).slice(0, 5)) console.warn('      ->', l)
      }
    }
  }

  console.log('Summary:')
  console.log('  reference locale:', refLocale)
  console.log('  total files scanned:', files.length)
  console.log('  total usedKeys detected:', usedKeys.size)
  console.log('  total missing keys:', totalMissing)

  if (totalMissing > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
