#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'public', '.output'].includes(e.name)) continue
      walk(p)
    } else if (e.isFile()) {
      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) {
        processFile(p)
      }
    }
  }
}

function normalizeImportTarget(importTarget, fileDir) {
  const resolved = path.resolve(fileDir, importTarget)
  let rel = path.relative(ROOT, resolved).replace(/\\/g, '/')
  for (const ex of exts) {
    if (rel.endsWith(ex)) {
      rel = rel.slice(0, -ex.length)
      break
    }
  }
  if (rel.startsWith('..')) return null
  return '~/' + rel
}

function processFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8')
  let changed = false
  const fileDir = path.dirname(filePath)

  const patterns = [
    /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,
    /(require\(\s*['"])(\.\.?\/[^'"]+)(['"]\s*\))/g,
    /(import\s+['"])(\.\.?\/[^'"]+)(['"])/g, // side-effect imports: import '~/scripts/styles.css'
    /(import\(\s*['"])(\.\.?\/[^'"]+)(['"]\s*\))/g, // dynamic import('...')
  ]

  let out = src
  for (const pat of patterns) {
    out = out.replace(pat, (match, p1, target, p3) => {
      if (!target.startsWith('./') && !target.startsWith('../')) return match
      const normalized = normalizeImportTarget(target, fileDir)
      if (!normalized) return match
      changed = true
      return p1 + normalized + p3
    })
  }

  if (changed) {
    fs.writeFileSync(filePath + '.bak', src, 'utf8')
    fs.writeFileSync(filePath, out, 'utf8')
    console.log('Updated:', filePath)
  }
}

walk(ROOT)
console.log('Done')
