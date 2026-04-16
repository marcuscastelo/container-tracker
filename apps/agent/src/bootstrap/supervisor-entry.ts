#!/usr/bin/env node

import { launchSupervisorMain } from '@agent/supervisor/supervisor.entry'

// Compatibility wrapper for historical bootstrap path usage.
launchSupervisorMain()
