import { build } from 'vite'
import { createAgentControlUiViteConfig } from './vite-shared.mjs'

await build(createAgentControlUiViteConfig())
