#!/usr/bin/env node

import process from 'node:process'
import { resolveAgentPathLayout } from '@agent/runtime-paths'
import { runUpdaterMain } from '@agent/updater/updater.entry'

function ensureDotenvPath(): void {
  const currentDotenvPath = process.env.DOTENV_PATH?.trim()
  if (currentDotenvPath && currentDotenvPath.length > 0) {
    return
  }

  process.env.DOTENV_PATH = resolveAgentPathLayout().configPath
}

ensureDotenvPath()
void runUpdaterMain()
