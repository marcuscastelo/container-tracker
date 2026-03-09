import { bootstrapUpdateManifestControllers } from '~/modules/agent/interface/http/update-manifest.controllers.bootstrap'

export const runtime = 'nodejs'

const updateManifestControllers = bootstrapUpdateManifestControllers()

export const GET = updateManifestControllers.getUpdateManifest
