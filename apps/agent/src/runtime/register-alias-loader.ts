import { register } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const currentDir = path.dirname(import.meta.filename)
const aliasLoaderUrl = pathToFileURL(path.join(currentDir, 'alias-loader.js')).href
const runtimeRootUrl = pathToFileURL(path.join(currentDir, '../../../..'))

register(aliasLoaderUrl, runtimeRootUrl)
