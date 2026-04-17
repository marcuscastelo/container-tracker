import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const vitestCliPath = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url))

const child = spawn(process.execPath, [vitestCliPath, 'run', '--silent'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''

child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')

child.stdout.on('data', (chunk) => {
  stdout += chunk
})

child.stderr.on('data', (chunk) => {
  stderr += chunk
})

child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})

child.on('close', (code, signal) => {
  const output = [stdout, stderr].filter(Boolean).join('\n')
  const summary = summarizeWithContext(output, {
    contextLineCount: 5,
    pattern: /Test Files|Tests |failed|passed|Duration/,
  })

  if (summary.trim().length > 0) {
    process.stdout.write(summary)
  }

  if (signal) {
    console.error(`Vitest exited via signal ${signal}.`)
    process.exitCode = 1
    return
  }

  process.exitCode = code ?? 1
})

function summarizeWithContext(output, options) {
  const lines = output.split(/\r?\n/)
  const selectedIndexes = new Set()

  for (const [index, line] of lines.entries()) {
    if (!options.pattern.test(line)) {
      continue
    }

    const start = Math.max(0, index - options.contextLineCount)
    const end = Math.min(lines.length - 1, index + options.contextLineCount)

    for (let selectedIndex = start; selectedIndex <= end; selectedIndex += 1) {
      selectedIndexes.add(selectedIndex)
    }
  }

  return [...selectedIndexes]
    .sort((left, right) => left - right)
    .map((index) => lines[index])
    .join('\n')
}
