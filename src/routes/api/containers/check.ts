/**
 * Container check API route - thin adapter to container HTTP controllers.
 *
 * POST /api/containers/check
 */

import { bootstrapContainerControllers } from '~/modules/container/interface/http/container.controllers.bootstrap'

const { checkContainers } = bootstrapContainerControllers()

export const POST = checkContainers
