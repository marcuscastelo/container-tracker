#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const INPUT = process.argv[2] ?? 'src'
const JSON_OUT = path.join(ROOT, 'dep-graph.json')
const DOT_OUT = path.join(ROOT, 'dep-graph.dot')

/**
 * Ajuste aqui se quiser ficar mais/menos agressivo.
 *
 * Exclui:
 * - node_modules
 * - .output / .dist / dist / .vinxi / coverage
 * - __tests__
 * - arquivos *.test.*, *.spec.*, *.integration.*, *.e2e.*
 * - qualquer .js/.mjs/.cjs
 */
const EXCLUDE_REGEX =
  '(^|/)(node_modules|\\.output|\\.dist|dist|\\.vinxi|coverage|__tests__)(/|$)|\\.(test|spec|integration|e2e)\\.(ts|tsx|js|jsx|mjs|cjs)$|\\.(js|jsx|mjs|cjs)$'

/**
 * true  -> quebra label em múltiplas linhas por "/"
 * false -> label em uma linha só
 */
const MULTILINE_LABELS = true

/**
 * true  -> usa profundidade literal do path:
 *          src = 0
 *          src/modules = 1
 *          src/modules/process = 2
 *          src/modules/process/ui = 3
 *          src/modules/process/ui/file.tsx = 4
 *
 * false -> usa uma profundidade "arquitetural" mais comprimida
 */
const USE_LITERAL_PATH_DEPTH = true

function runDepcruise() {
  const args = [
    'exec',
    'depcruise',
    INPUT,
    '--no-config',
    '--ts-config',
    'tsconfig.json',
    '--output-type',
    'json',
    '--exclude',
    EXCLUDE_REGEX,
  ]

  const result = spawnSync('pnpm', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 100,
  })

  if (result.status !== 0) {
    console.error(result.stdout || '')
    console.error(result.stderr || '')
    process.exit(result.status ?? 1)
  }

  fs.writeFileSync(JSON_OUT, result.stdout, 'utf8')
  return JSON.parse(result.stdout)
}

function normalizePath(value) {
  return String(value || '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
}

function isIncludedPath(filePath) {
  const p = normalizePath(filePath)

  if (!p.startsWith('src/')) return false
  if (!/\.(ts|tsx)$/.test(p)) return false
  if (/\.(test|spec|integration|e2e)\.(ts|tsx)$/.test(p)) return false
  if (/(^|\/)__tests__(\/|$)/.test(p)) return false
  if (/(^|\/)(node_modules|\.output|\.dist|dist|\.vinxi|coverage)(\/|$)/.test(p)) return false

  return true
}

function dotEscape(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')
}

function toNodeId(filePath) {
  return `node:${normalizePath(filePath)}`
}

function toNodeLabel(filePath) {
  const p = normalizePath(filePath)
  return MULTILINE_LABELS ? p.replaceAll('/', '/\n') : p
}

function getLiteralDepth(filePath) {
  const parts = normalizePath(filePath).split('/').filter(Boolean)
  return Math.max(parts.length - 1, 0)
}

function getArchitecturalDepth(filePath) {
  const parts = normalizePath(filePath).split('/').filter(Boolean)

  // Exemplo:
  // src/modules/process/ui/screens/Dashboard.tsx
  // 0   1       2       3  ...
  //
  // Queremos algo menos "espichado" que a profundidade literal.
  if (parts[0] !== 'src') return 0
  if (parts.length === 1) return 0

  const root1 = parts[1]

  if (root1 === 'modules') {
    if (parts.length === 2) return 1 // src/modules
    if (parts.length === 3) return 2 // src/modules/<bc>
    if (parts.length === 4) return 3 // src/modules/<bc>/<folder>
    return 4 // resto flat
  }

  if (root1 === 'capabilities') {
    if (parts.length === 2) return 1 // src/capabilities
    if (parts.length === 3) return 2 // src/capabilities/<capability>
    if (parts.length === 4) return 3 // src/capabilities/<capability>/<folder>
    return 4 // resto flat
  }

  if (root1 === 'routes') {
    if (parts.length === 2) return 1 // src/routes
    if (parts.length === 3) return 2 // src/routes/<folder>
    if (parts.length === 4) return 3 // src/routes/<folder>/<subfolder>
    return 4 // resto flat
  }

  if (root1 === 'shared') {
    if (parts.length === 2) return 1 // src/shared
    if (parts.length === 3) return 2 // src/shared/<folder>
    if (parts.length === 4) return 3 // src/shared/<folder>/<subfolder>
    return 4 // resto flat
  }

  return Math.min(parts.length - 1, 4)
}

function getDepth(filePath) {
  return USE_LITERAL_PATH_DEPTH ? getLiteralDepth(filePath) : getArchitecturalDepth(filePath)
}

function sortPaths(a, b) {
  return a.localeCompare(b, 'en')
}

function collectGraph(data) {
  const modules = Array.isArray(data?.modules) ? data.modules : []

  const nodeSet = new Set()
  const edgeSet = new Set()

  for (const mod of modules) {
    const source = normalizePath(mod?.source)

    if (!isIncludedPath(source)) continue
    nodeSet.add(source)

    const deps = Array.isArray(mod?.dependencies) ? mod.dependencies : []

    for (const dep of deps) {
      const target = normalizePath(dep?.resolved)

      if (!isIncludedPath(target)) continue

      nodeSet.add(target)
      edgeSet.add(`${source} -> ${target}`)
    }
  }

  const nodes = Array.from(nodeSet).sort(sortPaths)
  const edges = Array.from(edgeSet)
    .map((entry) => {
      const [from, to] = entry.split(' -> ')
      return { from, to }
    })
    .sort((a, b) => {
      const left = `${a.from} -> ${a.to}`
      const right = `${b.from} -> ${b.to}`
      return left.localeCompare(right, 'en')
    })

  return { nodes, edges }
}

function buildDot({ nodes, edges }) {
  const ranks = new Map()

  for (const filePath of nodes) {
    const depth = getDepth(filePath)
    const bucket = ranks.get(depth) ?? []
    bucket.push(filePath)
    ranks.set(depth, bucket)
  }

  const sortedDepths = Array.from(ranks.keys()).sort((a, b) => a - b)

  const lines = []
  lines.push('digraph G {')
  lines.push('  graph [')
  lines.push('    rankdir=LR,')
  lines.push('    newrank=true,')
  lines.push('    splines=true,')
  lines.push('    overlap=false,')
  lines.push('    ranksep=1.15,')
  lines.push('    nodesep=0.25,')
  lines.push('    pad=0.2,')
  lines.push('    compound=true')
  lines.push('  ];')
  lines.push('')
  lines.push('  node [')
  lines.push('    shape=box,')
  lines.push('    style="rounded",')
  lines.push('    fontsize=10,')
  lines.push('    margin="0.08,0.04"')
  lines.push('  ];')
  lines.push('')
  lines.push('  edge [')
  lines.push('    arrowsize=0.7,')
  lines.push('    penwidth=1.0')
  lines.push('  ];')
  lines.push('')

  // Âncoras invisíveis para forçar ordem das colunas
  for (const depth of sortedDepths) {
    lines.push(`  "anchor:${depth}" [shape=point, width=0, height=0, style=invis, label=""];`)
  }

  lines.push('')

  for (let i = 0; i < sortedDepths.length - 1; i += 1) {
    const current = sortedDepths[i]
    const next = sortedDepths[i + 1]
    lines.push(`  "anchor:${current}" -> "anchor:${next}" [style=invis, weight=200];`)
  }

  lines.push('')

  // Cada profundidade vira uma "coluna"
  for (const depth of sortedDepths) {
    const group = (ranks.get(depth) ?? []).sort(sortPaths)

    lines.push(`  subgraph "rank:${depth}" {`)
    lines.push('    rank=same;')
    lines.push(`    "anchor:${depth}";`)

    for (const filePath of group) {
      const nodeId = toNodeId(filePath)
      const label = toNodeLabel(filePath)
      const tooltip = filePath

      lines.push(
        `    "${dotEscape(nodeId)}" [label="${dotEscape(label)}", tooltip="${dotEscape(
          tooltip,
        )}"];`,
      )
    }

    lines.push('  }')
    lines.push('')
  }

  // Edges reais sem influenciar rank.
  // O rank é decidido pela profundidade do path, não pelo fluxo de imports.
  for (const edge of edges) {
    lines.push(
      `  "${dotEscape(toNodeId(edge.from))}" -> "${dotEscape(
        toNodeId(edge.to),
      )}" [constraint=false];`,
    )
  }

  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

function main() {
  const depcruiseJson = runDepcruise()
  const graph = collectGraph(depcruiseJson)
  const dot = buildDot(graph)

  fs.writeFileSync(DOT_OUT, dot, 'utf8')

  console.log(`DOT gerado em: ${path.relative(ROOT, DOT_OUT)}`)
  console.log(`JSON bruto salvo em: ${path.relative(ROOT, JSON_OUT)}`)
  console.log(`Nós: ${graph.nodes.length}`)
  console.log(`Arestas: ${graph.edges.length}`)
  console.log(
    `Modo de profundidade: ${USE_LITERAL_PATH_DEPTH ? 'literal path depth' : 'architectural depth'}`,
  )
}

main()
