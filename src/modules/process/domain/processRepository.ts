import type {
  Process,
  ProcessContainer,
  ProcessWithContainers,
} from '~/src/modules/process/domain/process'

/**
 * Process Repository Interface
 *
 * Handles persistence of Process and ProcessContainer entities.
 * All operations are transactional - if container creation fails, process creation is rolled back.
 */
export type ProcessRepository = {
  /**
   * Fetch all processes (without containers)
   */
  fetchAll: () => Promise<readonly Process[]>

  /**
   * Fetch all processes with their containers
   */
  fetchAllWithContainers: () => Promise<readonly ProcessWithContainers[]>

  /**
   * Fetch a single process by ID
   */
  fetchById: (processId: string) => Promise<Process | null>

  /**
   * Fetch a process with its containers by ID
   */
  fetchByIdWithContainers: (processId: string) => Promise<ProcessWithContainers | null>

  /**
   * Fetch containers for a specific process
   */
  fetchContainersByProcessId: (processId: string) => Promise<readonly ProcessContainer[]>

  /**
   * Check if a container number already exists in the system
   */
  containerExists: (containerNumber: string) => Promise<boolean>

  /**
   * Create a new process with its containers (transactional)
   * Returns the created process with containers
   */
  create: (
    process: Omit<Process, 'id' | 'created_at' | 'updated_at'>,
    containers: readonly Omit<
      ProcessContainer,
      'id' | 'process_id' | 'created_at' | 'updated_at'
    >[],
  ) => Promise<ProcessWithContainers>

  /**
   * Add a container to an existing process
   */
  addContainer: (
    processId: string,
    container: Omit<ProcessContainer, 'id' | 'process_id' | 'created_at' | 'updated_at'>,
  ) => Promise<ProcessContainer>

  /**
   * Update a process (metadata only, not containers)
   */
  update: (
    processId: string,
    updates: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>>,
  ) => Promise<Process>

  /**
   * Delete a process and all its containers (cascade)
   */
  delete: (processId: string) => Promise<void>

  /**
   * Remove a container from a process
   * Note: Cannot remove the last container
   */
  removeContainer: (containerId: string) => Promise<void>
}
