import { createContainerFacade } from '~/modules/container/application/container.facade'
import { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/container.repository.supabase'

export const containerFacade = createContainerFacade({
  repository: supabaseContainerRepository,
})
