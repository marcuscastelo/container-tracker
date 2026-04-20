#!/usr/bin/env node

import { launchRuntimeMain } from '@agent/runtime/runtime.entry'

// Wrapper entrypoint kept for compatibility with existing runtime launch scripts.
launchRuntimeMain()
