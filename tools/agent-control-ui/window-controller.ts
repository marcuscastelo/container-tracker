import {
  createWindowLifecycleController as canonicalCreateWindowLifecycleController,
  setupSingleInstance as canonicalSetupSingleInstance,
} from '@tools/agent/electron/main/window-controller'

export const createWindowLifecycleController = canonicalCreateWindowLifecycleController
export const setupSingleInstance = canonicalSetupSingleInstance
