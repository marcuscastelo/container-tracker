#!/usr/bin/env node

import { launchRuntimeMain } from '@agent/runtime/runtime.entry'

// Compatibility wrapper for historical bootstrap path usage.
launchRuntimeMain()
