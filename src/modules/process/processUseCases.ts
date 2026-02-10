import { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/supabaseContainerRepository'
import { createProcessUseCases } from '~/modules/process/application/processUseCases'
import { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'

export const processUseCases = createProcessUseCases({
  processRepository: supabaseProcessRepository,
  containerRepository: supabaseContainerRepository,
})
