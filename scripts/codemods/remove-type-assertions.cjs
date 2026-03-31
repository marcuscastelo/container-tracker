const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      walk(full)
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      stripFile(full)
    }
  }
}

function stripFile(file) {
  let src = fs.readFileSync(file, 'utf8')
  const original = src

  // Remove ` as Type` assertions (simple heuristic)
  src = src.replace(/\s+as\s+[A-Za-z0-9_[\]<>|'"\s:|&?]+/g, '')

  // Also remove triple-cast patterns like `as unknown as Type` leaving the expression before first as
  src = src.replace(/\s+as\s+unknown\s+as\s+[A-Za-z0-9_[\]<>|'"\s:|&?]+/g, '')

  if (src !== original) {
    fs.writeFileSync(file, src, 'utf8')
    console.log('Stripped assertions in', path.relative(root, file))
  }
}

walk(path.join(root, 'src'))
console.log('Done')
