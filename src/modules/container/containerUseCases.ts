import { createContainerUseCases } from '~/modules/container/application/containerUseCases'
import { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/supabaseContainerRepository'

export const containerUseCases = createContainerUseCases({
  containerRepository: supabaseContainerRepository,
})
