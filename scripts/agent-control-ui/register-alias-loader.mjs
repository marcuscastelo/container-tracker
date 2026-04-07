import { register } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const aliasLoaderUrl = pathToFileURL(
  path.join(repoRoot, 'dist', 'agent-control-ui', 'tools', 'agent', 'runtime', 'alias-loader.js'),
).href
const repoRootUrl = pathToFileURL(path.join(repoRoot, '.'))

register(aliasLoaderUrl, repoRootUrl)
