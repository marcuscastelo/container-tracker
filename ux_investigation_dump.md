

# Search: sync occurrences

Command executed:
```bash
rg -n "sync" src
```

Output:
```

src/entry-client.tsx:70:              .then(async (res) => {
src/locales/pt-PT.json:31:      "sync": "Sincronizar",
src/locales/pt-PT.json:32:      "syncing": "A sincronizar...",
src/locales/pt-PT.json:33:      "syncFailed": "A última sincronização falhou"
src/locales/pt-PT.json:112:        "sync": "Sync"
src/locales/pt-PT.json:140:      "sync": {
src/locales/pt-PT.json:142:        "syncing": "A sincronizar processo",
src/locales/pt-PT.json:146:        "lastSyncAt": "{{state}} · Último sync: {{timestamp}}"
src/locales/pt-PT.json:330:    "sync": {
src/locales/pt-PT.json:333:      "syncing": "a sincronizar…",
src/capabilities/dashboard/interface/http/dashboard.controllers.ts:49:  async function getOperationalSummary(): Promise<Response> {
src/locales/pt-BR.json:31:      "sync": "Sincronizar",
src/locales/pt-BR.json:32:      "syncing": "Sincronizando...",
src/locales/pt-BR.json:33:      "syncFailed": "A última sincronização falhou"
src/locales/pt-BR.json:112:        "sync": "Sync"
src/locales/pt-BR.json:140:      "sync": {
src/locales/pt-BR.json:142:        "syncing": "Sincronizando processo",
src/locales/pt-BR.json:146:        "lastSyncAt": "{{state}} · Último sync: {{timestamp}}"
src/locales/pt-BR.json:330:    "sync": {
src/locales/pt-BR.json:333:      "syncing": "sincronizando…",
src/capabilities/dashboard/application/dashboard.operational-summary.readmodel.ts:444:  return async function execute(): Promise<DashboardOperationalSummaryReadModel> {
src/locales/en-US.json:20:      "sync": "Sync",
src/locales/en-US.json:21:      "syncing": "Syncing...",
src/locales/en-US.json:22:      "syncFailed": "Last sync failed"
src/locales/en-US.json:101:        "sync": "Sync"
src/locales/en-US.json:129:      "sync": {
src/locales/en-US.json:131:        "syncing": "Syncing process",
src/locales/en-US.json:134:        "unknown": "No previous sync",
src/locales/en-US.json:135:        "lastSyncAt": "{{state}} · Last sync: {{timestamp}}"
src/locales/en-US.json:313:    "refreshSyncing": "syncing...",
src/locales/en-US.json:317:    "refreshSyncTimeout": "Refresh sync is still pending after {{total}} retries. Try again shortly.",
src/locales/en-US.json:319:    "sync": {
src/locales/en-US.json:322:      "syncing": "syncing…",
src/locales/en-US.json:327:      "never": "never synced"
src/capabilities/search/tests/search.boundary.test.ts:8:async function listSourceFiles(directory: string): Promise<readonly string[]> {
src/capabilities/search/tests/search.boundary.test.ts:11:    entries.map(async (entry) => {
src/capabilities/search/tests/search.boundary.test.ts:57:  it('forbids imports from modules/*/domain within src/capabilities/search/**', async () => {
src/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.ts:7:  it('returns operational summary including process exceptions in backend order', async () => {
src/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.ts:52:    const getOperationalSummaryReadModel = vi.fn(async () => summary)
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.test.ts:62:  it('composes process status/eta/alerts and keeps processes without alerts visible', async () => {
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.test.ts:88:    const listProcessesWithContainers = vi.fn(async () => ({ processes }))
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.test.ts:90:      async (): Promise<ReadonlyMap<string, TrackingOperationalSummary>> =>
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.test.ts:106:    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:64:  it('aggregates global active-alert totals by severity and category from deterministic fixtures', async () => {
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:88:    const listProcessesWithContainers = vi.fn(async () => ({ processes }))
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:90:      async (): Promise<ReadonlyMap<string, TrackingOperationalSummary>> =>
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:147:    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:175:  it('exposes global indicator keys and computes totals from active alerts only', async () => {
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:189:    const listProcessesWithContainers = vi.fn(async () => ({ processes }))
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:191:      async (): Promise<ReadonlyMap<string, TrackingOperationalSummary>> =>
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:214:    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:260:  it('builds consolidated active-alert panel with mixed types and generated_at descending order', async () => {
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:284:    const listProcessesWithContainers = vi.fn(async () => ({ processes }))
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:286:      async (): Promise<ReadonlyMap<string, TrackingOperationalSummary>> =>
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:324:    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:398:  it('orders process rows by dominant severity and keeps processes without alerts visible', async () => {
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:449:    const listProcessesWithContainers = vi.fn(async () => ({ processes }))
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:451:      async (): Promise<ReadonlyMap<string, TrackingOperationalSummary>> =>
src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts:507:    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))
src/shared/localization/translationTypes.ts:8:// This avoids hard-coded depth limits and keeps typing in sync with the reference locale.
src/capabilities/search/ui/fetchSearch.ts:8:export async function fetchSearchResults(query: string) {
src/shared/localization/i18n.ts:201:    setLocale: async (lng: string) => {
src/capabilities/search/ui/SearchOverlay.tsx:99:      debounceTimer = setTimeout(async () => {
src/shared/utils/clipboard.ts:2:export async function copyToClipboard(text: string): Promise<void> {
src/capabilities/search/infrastructure/persistence/supabaseSearchRepository.ts:161:  async search(query: string, limit: number): Promise<readonly SearchResultItemProjection[]> {
src/shared/api-schemas/processes.schemas.ts:42:  /** Last process sync status derived from sync_requests */
src/shared/api-schemas/processes.schemas.ts:43:  last_sync_status: ProcessLastSyncStatusSchema.optional(),
src/shared/api-schemas/processes.schemas.ts:44:  /** Timestamp of latest known process sync activity */
src/shared/api-schemas/processes.schemas.ts:45:  last_sync_at: z.string().nullish(),
src/shared/api-schemas/processes.schemas.ts:152:  /** Container-level operational sync metadata */
src/shared/api-schemas/processes.schemas.ts:163:  syncedProcesses: z.number().int().nonnegative(),
src/shared/api-schemas/processes.schemas.ts:164:  syncedContainers: z.number().int().nonnegative(),
src/shared/api-schemas/processes.schemas.ts:170:  syncedContainers: z.number().int().nonnegative(),
src/shared/utils/tests/clipboard.test.ts:13:  it('uses navigator.clipboard.writeText when available', async () => {
src/shared/utils/tests/clipboard.test.ts:22:  it('falls back gracefully when clipboard API is not available', async () => {
src/modules/tracking/interface/http/tracking.controllers.ts:35:  async function listAlerts({ request }: { request: Request }): Promise<Response> {
src/modules/tracking/interface/http/tracking.controllers.ts:58:  async function handleAlertAction({ request }: { request: Request }): Promise<Response> {
src/modules/tracking/interface/http/tracking.controllers.ts:90:  async function getSnapshotsForContainer({
src/modules/tracking/interface/http/tracking.controllers.ts:112:  async function getLatestSnapshot({
src/capabilities/search/interface/http/search.controllers.ts:17:  async function search({ request }: { request: Request }): Promise<Response> {
src/shared/api/sync-requests.realtime.client.ts:7:} from '~/shared/supabase/sync-requests.realtime'
src/shared/api/sync-requests.realtime.client.ts:12:  readonly syncRequestIds: readonly string[]
src/shared/api/sync-requests.realtime.client.ts:18:    syncRequestIds: command.syncRequestIds,
src/modules/tracking/interface/http/refresh.controllers.ts:17:  readonly syncRequestId: string
src/modules/tracking/interface/http/refresh.controllers.ts:27:    readonly syncRequestIds: readonly string[]
src/modules/tracking/interface/http/refresh.controllers.ts:49:      syncRequestId: result.syncRequestId,
src/modules/tracking/interface/http/refresh.controllers.ts:59:  async function refresh({ request }: { request: Request }): Promise<Response> {
src/modules/tracking/interface/http/refresh.controllers.ts:76:  async function status({ request }: { request: Request }): Promise<Response> {
src/modules/tracking/interface/http/refresh.controllers.ts:80:        sync_request_id: url.searchParams.getAll('sync_request_id'),
src/modules/tracking/interface/http/refresh.controllers.ts:92:        syncRequestIds: parsedQuery.data.sync_request_id,
src/shared/api/typedFetch.ts:15:export async function typedFetch<T extends z.ZodTypeAny>(
src/capabilities/search/application/tests/search.usecase.test.ts:19:    async (_query: string, _limit: number): Promise<readonly ProcessSearchProjection[]> =>
src/capabilities/search/application/tests/search.usecase.test.ts:23:    async (_query: string, _limit: number): Promise<readonly ContainerSearchProjection[]> =>
src/capabilities/search/application/tests/search.usecase.test.ts:27:    async (_query: string, _limit: number): Promise<readonly TrackingSearchProjection[]> =>
src/capabilities/search/application/tests/search.usecase.test.ts:31:    async (_query: string, _limit: number): Promise<readonly TrackingSearchProjection[]> =>
src/capabilities/search/application/tests/search.usecase.test.ts:54:  it('returns empty results for empty query and does not call BC search use cases', async () => {
src/capabilities/search/application/tests/search.usecase.test.ts:68:  it('returns empty results for one or two characters and does not call BC search use cases', async () => {
src/capabilities/search/application/tests/search.usecase.test.ts:84:  it('normalizes query with trim + lowercase before calling BC search use cases', async () => {
src/capabilities/search/application/tests/search.usecase.test.ts:101:  it('consolidates multi-BC matches by processId and removes duplicates', async () => {
src/capabilities/search/application/tests/search.usecase.test.ts:170:  it('selects tracking fields deterministically when multiple tracking rows exist for one process', async () => {
src/capabilities/search/application/tests/search.usecase.test.ts:209:  it('applies ranking priority by match strength levels', async () => {
src/capabilities/search/application/tests/search.usecase.test.ts:262:  it('uses deterministic tie-breaker by processReference then processId', async () => {
src/capabilities/search/application/tests/search.usecase.test.ts:295:  it('applies fixed limit of 30 items after consolidation', async () => {
src/shared/api/typedRoute.ts:3:export async function parseBody<T extends z.ZodTypeAny>(
src/shared/supabase/database.types.ts:300:      sync_requests: {
src/shared/supabase/database.types.ts:312:          status: Database['public']['Enums']['sync_request_status']
src/shared/supabase/database.types.ts:327:          status?: Database['public']['Enums']['sync_request_status']
src/shared/supabase/database.types.ts:342:          status?: Database['public']['Enums']['sync_request_status']
src/shared/supabase/database.types.ts:478:      enqueue_sync_request: {
src/shared/supabase/database.types.ts:489:          status: Database['public']['Enums']['sync_request_status']
src/shared/supabase/database.types.ts:492:      lease_sync_requests: {
src/shared/supabase/database.types.ts:510:          status: Database['public']['Enums']['sync_request_status']
src/shared/supabase/database.types.ts:516:          to: 'sync_requests'
src/shared/supabase/database.types.ts:523:      sync_request_status: 'PENDING' | 'LEASED' | 'DONE' | 'FAILED'
src/shared/supabase/database.types.ts:649:      sync_request_status: ['PENDING', 'LEASED', 'DONE', 'FAILED'],
src/capabilities/search/interface/http/tests/search.controllers.test.ts:30:    vi.fn(async () => {
src/capabilities/search/interface/http/tests/search.controllers.test.ts:35:    vi.fn(async () => {
src/capabilities/search/interface/http/tests/search.controllers.test.ts:40:    vi.fn(async () => {
src/capabilities/search/interface/http/tests/search.controllers.test.ts:45:    vi.fn(async () => {
src/capabilities/search/interface/http/tests/search.controllers.test.ts:133:  it('returns 200 with empty list for empty or short queries without calling BC searches', async () => {
src/capabilities/search/interface/http/tests/search.controllers.test.ts:155:  it('caps endpoint response at 30 and removes duplicated processId across BC matches', async () => {
src/capabilities/search/interface/http/tests/search.controllers.test.ts:205:      searchByText: vi.fn(async () => processMatches),
src/capabilities/search/interface/http/tests/search.controllers.test.ts:206:      searchByNumber: vi.fn(async () => containerMatches),
src/capabilities/search/interface/http/tests/search.controllers.test.ts:207:      searchByVesselName: vi.fn(async () => vesselMatches),
src/capabilities/search/interface/http/tests/search.controllers.test.ts:208:      searchByDerivedStatusText: vi.fn(async () => statusMatches),
src/capabilities/search/interface/http/tests/search.controllers.test.ts:226:  it('keeps exact container lookup returning the owning process as top result', async () => {
src/capabilities/search/interface/http/tests/search.controllers.test.ts:229:      searchByText: vi.fn(async () => [
src/capabilities/search/interface/http/tests/search.controllers.test.ts:245:      searchByNumber: vi.fn(async () => [
src/capabilities/search/interface/http/tests/search.controllers.test.ts:255:      searchByVesselName: vi.fn(async () => []),
src/capabilities/search/interface/http/tests/search.controllers.test.ts:256:      searchByDerivedStatusText: vi.fn(async () => []),
src/capabilities/search/interface/http/tests/search.controllers.test.ts:269:  it('returns one consolidated process row per processId for ambiguous queries', async () => {
src/capabilities/search/interface/http/tests/search.controllers.test.ts:271:      searchByText: vi.fn(async () => [
src/capabilities/search/interface/http/tests/search.controllers.test.ts:287:      searchByNumber: vi.fn(async () => [
src/capabilities/search/interface/http/tests/search.controllers.test.ts:293:      searchByVesselName: vi.fn(async () => [
src/capabilities/search/interface/http/tests/search.controllers.test.ts:307:      searchByDerivedStatusText: vi.fn(async () => [
src/capabilities/search/interface/http/tests/search.controllers.test.ts:331:  it('responds below 300ms for a typical fixture query with a 30-result cap', async () => {
src/capabilities/search/interface/http/tests/search.controllers.test.ts:334:      searchByText: vi.fn(async () => fixture.processMatches),
src/capabilities/search/interface/http/tests/search.controllers.test.ts:335:      searchByNumber: vi.fn(async () => fixture.containerMatches),
src/capabilities/search/interface/http/tests/search.controllers.test.ts:336:      searchByVesselName: vi.fn(async () => fixture.vesselMatches),
src/capabilities/search/interface/http/tests/search.controllers.test.ts:337:      searchByDerivedStatusText: vi.fn(async () => fixture.statusMatches),
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:46:      async enqueueSyncRequest(command) {
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:47:        const result = await supabaseServer.rpc('enqueue_sync_request', {
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:56:          operation: 'enqueue_sync_request',
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:57:          table: 'sync_requests',
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:74:    async getSyncRequestStatuses({ syncRequestIds }) {
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:75:      const uniqueSyncRequestIds = Array.from(new Set(syncRequestIds))
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:78:        .from('sync_requests')
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:84:        operation: 'get_sync_request_statuses',
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:85:        table: 'sync_requests',
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:91:      const requests = syncRequestIds.map((syncRequestId) => {
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:92:        const row = byId.get(syncRequestId)
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:95:            syncRequestId,
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:97:            lastError: 'sync_request_not_found',
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:104:          syncRequestId: row.id,
src/capabilities/search/application/search.usecase.ts:259:  return async function search(command: SearchCommand): Promise<readonly SearchResultItem[]> {
src/modules/tracking/interface/http/agent-sync.schemas.ts:13:  sync_request_id: z.string().uuid(),
src/modules/tracking/interface/http/agent-sync.schemas.ts:34:  sync_request_id: z.string().uuid(),
src/capabilities/search/application/search.usecases.ts:30:  async function search(command: SearchQueryCommand): Promise<SearchResult> {
src/shared/supabase/sync-requests.realtime.ts:48:  readonly table: 'sync_requests'
src/shared/supabase/sync-requests.realtime.ts:100:  return `sync_requests:${scope}:${key}:${randomSuffix}`
src/shared/supabase/sync-requests.realtime.ts:167:          table: 'sync_requests',
src/shared/supabase/sync-requests.realtime.ts:207:  readonly syncRequestIds: readonly string[]
src/shared/supabase/sync-requests.realtime.ts:211:  const parsedSyncRequestIds = SyncRequestIdListSchema.parse(command.syncRequestIds)
src/shared/supabase/sync-requests.realtime.ts:216:    filters: uniqueSyncRequestIds.map((syncRequestId) => ({
src/shared/supabase/sync-requests.realtime.ts:218:      key: `id=eq.${syncRequestId}`,
src/shared/supabase/sync-requests.realtime.ts:255:      // sync_requests rows that share the same ref_value for other ref_types.
src/shared/supabase/tests/sync-requests.realtime.test.ts:7:} from '~/shared/supabase/sync-requests.realtime'
src/shared/supabase/tests/sync-requests.realtime.test.ts:47:            readonly table: 'sync_requests'
src/shared/supabase/tests/sync-requests.realtime.test.ts:65:    async removeChannel(channel) {
src/shared/supabase/tests/sync-requests.realtime.test.ts:99:describe('sync-requests realtime', () => {
src/shared/supabase/tests/sync-requests.realtime.test.ts:106:      syncRequestIds: [
src/shared/supabase/tests/sync-requests.realtime.test.ts:206:  it('propagates channel status and unsubscribes from all channels', async () => {
src/shared/supabase/tests/sync-requests.realtime.test.ts:224:              readonly table: 'sync_requests'
src/shared/supabase/tests/sync-requests.realtime.test.ts:241:      async removeChannel(channel) {
src/shared/supabase/tests/sync-requests.realtime.test.ts:253:      syncRequestIds: [
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:7:  it('returns 202 queued when sync request is created', async () => {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:8:    const refreshRestUseCase = vi.fn(async () => ({
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:11:      syncRequestId: 'ac8c52bf-0e1d-49db-9441-5586f86f0e31',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:18:      getSyncRequestStatuses: vi.fn(async () => ({ allTerminal: true, requests: [] })),
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:33:    expect(body.syncRequestId).toBe('ac8c52bf-0e1d-49db-9441-5586f86f0e31')
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:43:  it('returns 202 queued when sync request is deduped', async () => {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:44:    const refreshRestUseCase = vi.fn(async () => ({
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:47:      syncRequestId: 'f0787fe1-7767-44ca-8f3b-5966d1571318',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:54:      getSyncRequestStatuses: vi.fn(async () => ({ allTerminal: true, requests: [] })),
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:70:  it('returns 404 when container does not exist', async () => {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:72:      refreshRestUseCase: vi.fn(async () => ({
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:76:      getSyncRequestStatuses: vi.fn(async () => ({ allTerminal: true, requests: [] })),
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:92:  it('returns 400 for invalid refresh payload', async () => {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:95:      getSyncRequestStatuses: vi.fn(async () => ({ allTerminal: true, requests: [] })),
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:111:  it('returns 400 for invalid refresh status query', async () => {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:114:      getSyncRequestStatuses: vi.fn(async () => ({ allTerminal: true, requests: [] })),
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:123:    expect(body.error).toContain('sync_request_id')
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:126:  it('returns status with allTerminal=false when requests are still open', async () => {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:127:    const getSyncRequestStatuses = vi.fn(async () => ({
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:131:          syncRequestId: 'e567dadb-b3ad-4f10-9f3f-d37f8f3163fc',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:146:      'http://localhost/api/refresh/status?sync_request_id=e567dadb-b3ad-4f10-9f3f-d37f8f3163fc',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:156:      syncRequestIds: ['e567dadb-b3ad-4f10-9f3f-d37f8f3163fc'],
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:160:  it('returns status with allTerminal=true when all requests are terminal', async () => {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:163:      getSyncRequestStatuses: vi.fn(async () => ({
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:167:            syncRequestId: '377b29fd-97b6-4f9c-ad6e-66de6a66b565',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:174:            syncRequestId: '2999c8fb-1db8-4a48-bce2-b8fcf9f8908f',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:185:      'http://localhost/api/refresh/status?sync_request_id=377b29fd-97b6-4f9c-ad6e-66de6a66b565&sync_request_id=2999c8fb-1db8-4a48-bce2-b8fcf9f8908f',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:197:  it('returns NOT_FOUND statuses when sync request does not exist', async () => {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:200:      getSyncRequestStatuses: vi.fn(async () => ({
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:204:            syncRequestId: 'ec4536a8-9650-43d8-b68d-930f8a8bfe50',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:206:            lastError: 'sync_request_not_found',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:215:      'http://localhost/api/refresh/status?sync_request_id=ec4536a8-9650-43d8-b68d-930f8a8bfe50',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:224:    expect(body.requests[0]?.lastError).toBe('sync_request_not_found')
src/shared/ui/CopyButton.tsx:21:  const handleClick = async (e: MouseEvent) => {
src/modules/tracking/interface/http/agent-enroll.controllers.bootstrap.ts:119:    async findInstallerTokenByHash({ tokenHash }) {
src/modules/tracking/interface/http/agent-enroll.controllers.bootstrap.ts:142:    async findAgentByFingerprint({ tenantId, machineFingerprint }) {
src/modules/tracking/interface/http/agent-enroll.controllers.bootstrap.ts:163:    async createAgent({ tenantId, machineFingerprint, hostname, os, agentVersion, agentToken }) {
src/modules/tracking/interface/http/agent-enroll.controllers.bootstrap.ts:197:    async updateAgentEnrollmentMetadata({
src/modules/tracking/interface/http/agent-enroll.controllers.bootstrap.ts:238:    async emitAuditEvent(event) {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:6:} from '~/modules/tracking/interface/http/agent-sync.controllers'
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:12:} from '~/modules/tracking/interface/http/agent-sync.schemas'
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:39:    leaseSyncRequests: vi.fn(async () => []),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:40:    findLeasedSyncRequest: vi.fn(async () => createSyncRequestRow()),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:41:    markSyncRequestDone: vi.fn(async () => true),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:42:    markSyncRequestFailed: vi.fn(async () => true),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:43:    findContainersByNumber: vi.fn(async () => [
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:50:    saveAndProcess: vi.fn(async () => ({ snapshotId: SNAPSHOT_ID })),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:51:    authenticateAgentToken: vi.fn(async () => ({ tenantId: TENANT_ID })),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:57:describe('agent sync controllers', () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:58:  it('returns 401 when authorization token is invalid', async () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:60:      authenticateAgentToken: vi.fn(async () => null),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:70:  it('accepts authorization header with extra bearer whitespace', async () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:91:  it('returns 400 for invalid tenant_id query', async () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:103:  it('returns 403 when token tenant does not match query tenant_id', async () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:105:      authenticateAgentToken: vi.fn(async () => ({
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:125:  it('leases and returns targets', async () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:127:      leaseSyncRequests: vi.fn(async () => [createSyncRequestRow()]),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:145:    expect(body.targets[0]?.sync_request_id).toBe(SYNC_REQUEST_ID)
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:155:  it('ingests snapshot and marks sync request as DONE', async () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:173:        sync_request_id: SYNC_REQUEST_ID,
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:184:      syncRequestId: SYNC_REQUEST_ID,
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:189:  it('returns 403 when token tenant does not match ingest payload tenant_id', async () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:191:      authenticateAgentToken: vi.fn(async () => ({
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:210:        sync_request_id: SYNC_REQUEST_ID,
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:219:  it('marks sync request as FAILED when container is not found', async () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:221:      findContainersByNumber: vi.fn(async () => []),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:222:      markSyncRequestFailed: vi.fn(async () => true),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:239:        sync_request_id: SYNC_REQUEST_ID,
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:251:  it('marks sync request as FAILED when container is ambiguous', async () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:253:      findContainersByNumber: vi.fn(async () => [
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:257:      markSyncRequestFailed: vi.fn(async () => true),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:274:        sync_request_id: SYNC_REQUEST_ID,
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:286:  it('returns lease_conflict when request is no longer leased', async () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:288:      findLeasedSyncRequest: vi.fn(async () => null),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:305:        sync_request_id: SYNC_REQUEST_ID,
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:316:  it('returns lease_conflict with snapshot_id when DONE update loses lease', async () => {
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:318:      markSyncRequestDone: vi.fn(async () => false),
src/modules/tracking/interface/http/tests/agent-sync.controllers.test.ts:335:        sync_request_id: SYNC_REQUEST_ID,
src/routes/api/processes/sync.ts:5:export const POST = processControllers.syncAllProcesses
src/modules/tracking/application/tracking.usecases.ts:21:} from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
src/modules/tracking/application/tracking.usecases.ts:63:    syncMetadataRepository: deps.syncMetadataRepository,
src/modules/tracking/application/tracking.usecases.ts:72:    async fetchAndProcess(
src/modules/tracking/application/tracking.usecases.ts:94:    async saveAndProcess(
src/modules/tracking/application/tracking.usecases.ts:115:    async getContainerSummary(
src/modules/tracking/application/tracking.usecases.ts:137:    async getContainersSummary(
src/modules/tracking/application/tracking.usecases.ts:145:     * List operational sync metadata for containers.
src/modules/tracking/application/tracking.usecases.ts:149:    async getContainersSyncMetadata(
src/modules/tracking/application/tracking.usecases.ts:158:    async searchByVesselName(
src/modules/tracking/application/tracking.usecases.ts:168:    async searchByDerivedStatusText(
src/modules/tracking/application/tracking.usecases.ts:178:    async acknowledgeAlert(alertId: string): Promise<void> {
src/modules/tracking/application/tracking.usecases.ts:185:    async unacknowledgeAlert(alertId: string): Promise<void> {
src/modules/tracking/application/tracking.usecases.ts:192:    async getSnapshotsForContainer(containerId: string): Promise<readonly Snapshot[]> {
src/modules/tracking/application/tracking.usecases.ts:199:    async getLatestSnapshot(containerId: string): Promise<Snapshot | null> {
src/modules/tracking/application/tracking.usecases.ts:208:    async listActiveAlertsByContainerId(
src/modules/tracking/application/tracking.usecases.ts:217:    async listActiveAlertReadModel(): Promise<ListActiveAlertReadModelResult> {
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:15:    findInstallerTokenByHash: vi.fn(async ({ tokenHash }) => ({
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:21:    findAgentByFingerprint: vi.fn(async () => null),
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:22:    createAgent: vi.fn(async () => ({
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:39:    updateAgentEnrollmentMetadata: vi.fn(async () => ({
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:56:    emitAuditEvent: vi.fn(async () => undefined),
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:85:  it('returns 400 for invalid payload', async () => {
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:99:  it('returns 429 when rate limit is exceeded', async () => {
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:112:  it('returns 401 when installer token is missing', async () => {
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:123:  it('accepts authorization header with extra bearer whitespace', async () => {
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:148:  it('creates a new agent when machine fingerprint is not enrolled', async () => {
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:164:  it('updates metadata and returns existing config when agent is already enrolled', async () => {
src/modules/tracking/interface/http/tests/agent-enroll.controllers.test.ts:166:      findAgentByFingerprint: vi.fn(async () => ({
src/modules/tracking/application/usecases/unacknowledge-alert.usecase.ts:20:export async function unacknowledgeAlert(
src/modules/tracking/interface/http/refresh.schemas.ts:19:  syncRequestId: z.string().uuid(),
src/modules/tracking/interface/http/refresh.schemas.ts:37:  sync_request_id: z.array(z.string().uuid()).min(1).max(100),
src/modules/tracking/interface/http/refresh.schemas.ts:41:  syncRequestId: z.string().uuid(),
src/modules/tracking/application/usecases/list-active-alerts-by-container-id.usecase.ts:24:export async function listActiveAlertsByContainerId(
src/modules/tracking/application/ports/tracking.sync-metadata.repository.ts:13: * Repository for operational sync metadata only.
src/modules/tracking/interface/http/agent-sync.controllers.ts:9:} from '~/modules/tracking/interface/http/agent-sync.schemas'
src/modules/tracking/interface/http/agent-sync.controllers.ts:28:    readonly syncRequestId: string
src/modules/tracking/interface/http/agent-sync.controllers.ts:33:    readonly syncRequestId: string
src/modules/tracking/interface/http/agent-sync.controllers.ts:38:    readonly syncRequestId: string
src/modules/tracking/interface/http/agent-sync.controllers.ts:87:async function ensureAgentAuth(
src/modules/tracking/interface/http/agent-sync.controllers.ts:124:  async function getTargets({ request }: { request: Request }): Promise<Response> {
src/modules/tracking/interface/http/agent-sync.controllers.ts:153:          sync_request_id: item.id,
src/modules/tracking/interface/http/agent-sync.controllers.ts:167:  async function ingestSnapshot({ request }: { request: Request }): Promise<Response> {
src/modules/tracking/interface/http/agent-sync.controllers.ts:187:        syncRequestId: body.sync_request_id,
src/modules/tracking/interface/http/agent-sync.controllers.ts:196:        return jsonResponse({ error: 'sync_request target does not match payload' }, 400)
src/modules/tracking/interface/http/agent-sync.controllers.ts:220:          syncRequestId: body.sync_request_id,
src/modules/tracking/interface/http/agent-sync.controllers.ts:244:        syncRequestId: body.sync_request_id,
src/routes/api/processes/[id]/sync.ts:5:export const POST = processControllers.syncProcessById
src/modules/tracking/application/usecases/get-container-summary.usecase.ts:132:async function loadSnapshotsForCarrierLabelEnrichment(
src/modules/tracking/application/usecases/get-container-summary.usecase.ts:156:export async function getContainerSummary(
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:8:} from '~/modules/tracking/interface/http/agent-sync.controllers'
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:12:} from '~/modules/tracking/interface/http/agent-sync.schemas'
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:37:    async leaseSyncRequests({ tenantId, agentId, limit, leaseMinutes }) {
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:38:      const result = await supabaseServer.rpc('lease_sync_requests', {
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:46:        operation: 'lease_sync_requests',
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:47:        table: 'sync_requests',
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:53:    async findLeasedSyncRequest({ tenantId, syncRequestId, agentId }) {
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:55:        .from('sync_requests')
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:57:        .eq('id', syncRequestId)
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:66:        table: 'sync_requests',
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:73:    async markSyncRequestDone({ tenantId, syncRequestId, agentId }) {
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:75:        .from('sync_requests')
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:81:        .eq('id', syncRequestId)
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:91:        table: 'sync_requests',
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:97:    async markSyncRequestFailed({ tenantId, syncRequestId, agentId, errorMessage }) {
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:99:        .from('sync_requests')
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:105:        .eq('id', syncRequestId)
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:115:        table: 'sync_requests',
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:121:    async findContainersByNumber({ containerNumbers }) {
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:133:    async saveAndProcess({ containerId, containerNumber, provider, payload, fetchedAt }) {
src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:146:    async authenticateAgentToken({ token }) {
src/modules/tracking/application/usecases/types.ts:4:import type { SyncMetadataRepository } from '~/modules/tracking/application/ports/tracking.sync-metadata.repository'
src/modules/tracking/application/usecases/types.ts:16:  readonly syncMetadataRepository: SyncMetadataRepository
src/modules/tracking/application/orchestration/pipeline.ts:61:export async function processSnapshot(
src/modules/tracking/interface/http/agent-enroll.controllers.ts:156:async function emitAuditEventSafely(
src/modules/tracking/interface/http/agent-enroll.controllers.ts:176:async function ensureInstallerAuth(
src/modules/tracking/interface/http/agent-enroll.controllers.ts:210:  async function enroll({ request }: { request: Request }): Promise<Response> {
src/modules/tracking/application/usecases/list-tracking-search-projections.usecase.ts:11:export async function listTrackingSearchProjections(
src/modules/tracking/application/usecases/get-containers-sync-metadata.usecase.ts:1:import type { SyncMetadataRepository } from '~/modules/tracking/application/ports/tracking.sync-metadata.repository'
src/modules/tracking/application/usecases/get-containers-sync-metadata.usecase.ts:18:  readonly syncMetadataRepository: SyncMetadataRepository
src/modules/tracking/application/usecases/get-containers-sync-metadata.usecase.ts:62:  return async function execute(
src/modules/tracking/application/usecases/get-containers-sync-metadata.usecase.ts:83:    const metadataRows = await deps.syncMetadataRepository.listByContainerNumbers({
src/routes/api/tests/processes-sync.route.test.ts:4:  syncAllProcesses: vi.fn(),
src/routes/api/tests/processes-sync.route.test.ts:9:    syncAllProcesses: processHandlers.syncAllProcesses,
src/routes/api/tests/processes-sync.route.test.ts:13:import { runtime, POST as syncProcessesPost } from '~/routes/api/processes/sync'
src/routes/api/tests/processes-sync.route.test.ts:15:describe('processes sync route', () => {
src/routes/api/tests/processes-sync.route.test.ts:16:  it('binds POST /api/processes/sync to process sync controller', () => {
src/routes/api/tests/processes-sync.route.test.ts:17:    expect(syncProcessesPost).toBe(processHandlers.syncAllProcesses)
src/modules/tracking/application/usecases/search-tracking-by-vessel-name.usecase.ts:19:export async function searchTrackingByVesselName(
src/routes/api/tests/processes-process-sync.route.test.ts:4:  syncProcessById: vi.fn(),
src/routes/api/tests/processes-process-sync.route.test.ts:9:    syncProcessById: processHandlers.syncProcessById,
src/routes/api/tests/processes-process-sync.route.test.ts:13:import { runtime, POST as syncProcessPost } from '~/routes/api/processes/[id]/sync'
src/routes/api/tests/processes-process-sync.route.test.ts:15:describe('process sync by id route', () => {
src/routes/api/tests/processes-process-sync.route.test.ts:16:  it('binds POST /api/processes/:id/sync to process sync controller', () => {
src/routes/api/tests/processes-process-sync.route.test.ts:17:    expect(syncProcessPost).toBe(processHandlers.syncProcessById)
src/modules/tracking/application/usecases/search-tracking-by-derived-status-text.usecase.ts:15:export async function searchTrackingByDerivedStatusText(
src/routes/api/agent/tests/targets.route.test.ts:8:vi.mock('~/modules/tracking/interface/http/agent-sync.controllers.bootstrap', () => ({
src/routes/api/agent/tests/targets.route.test.ts:18:  it('binds GET /api/agent/targets to agent-sync controller', () => {
src/modules/tracking/application/usecases/save-and-process.usecase.ts:35:export async function saveAndProcess(
src/routes/api/tests/refresh.route.test.ts:34:  it('returns 410 for legacy /api/refresh-maersk/:container', async () => {
src/routes/api/tests/refresh.route.test.ts:42:    expect(getBody.error).toBe('refresh_maersk_deprecated_use_sync_queue')
src/routes/api/tests/refresh.route.test.ts:43:    expect(postBody.error).toBe('refresh_maersk_deprecated_use_sync_queue')
src/modules/tracking/application/usecases/get-snapshots-for-container.usecase.ts:19:export async function getSnapshotsForContainer(
src/routes/api/agent/targets.ts:2: * Agent targets API route — thin adapter to the tracking agent-sync controller.
src/routes/api/agent/targets.ts:7:import { bootstrapAgentSyncControllers } from '~/modules/tracking/interface/http/agent-sync.controllers.bootstrap'
src/modules/tracking/application/usecases/get-latest-snapshot.usecase.ts:19:export async function getLatestSnapshot(
src/modules/tracking/application/usecases/fetch-and-process.usecase.ts:43:export async function fetchAndProcess(
src/modules/tracking/application/usecases/acknowledge-alert.usecase.ts:21:export async function acknowledgeAlert(
src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts:22:  async insertMany(alerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]> {
src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts:36:  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts:53:  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts:72:  async findByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts:88:  async listActiveAlertReadModel(): Promise<readonly TrackingActiveAlertReadModel[]> {
src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts:169:  async acknowledge(alertId: string, ackedAt: string): Promise<void> {
src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts:178:  async unacknowledge(alertId: string): Promise<void> {
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:48:      insertMany: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:49:      findAllByContainerId: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:50:      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:54:      insert: vi.fn(async () => {
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:57:      findLatestByContainerId: vi.fn(async (): Promise<Snapshot | null> => null),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:58:      findAllByContainerId: vi.fn(async (): Promise<readonly Snapshot[]> => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:61:      insertMany: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:62:      findActiveByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:63:      findByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:64:      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:65:      listActiveAlertReadModel: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:66:      acknowledge: vi.fn(async () => undefined),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:67:      unacknowledge: vi.fn(async () => undefined),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:69:    syncMetadataRepository: {
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:70:      listByContainerNumbers: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:76:  it('matches vessel name and returns tracking-derived projection fields', async () => {
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:77:    const deps = createDeps(async () => [
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:156:  it('respects limit after matching', async () => {
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:157:    const deps = createDeps(async () => [
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:195:  it('returns empty results for empty query without loading projections', async () => {
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:196:    const listSearchObservations = vi.fn(async () => [])
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:254:    async capture(command: CaptureMaerskCommand): Promise<MaerskCaptureResult> {
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:405:        cdpClient.on('Network.responseReceived', async (evt: unknown) => {
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:502:        const tryApiFallback = async () => {
src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts:6:} from '~/modules/tracking/application/ports/tracking.sync-metadata.repository'
src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts:7:import { normalizeContainerNumber } from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts:24:  async listByContainerNumbers(command): Promise<readonly SyncMetadataRecord[]> {
src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts:36:      .from('sync_requests')
src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts:43:      operation: 'list_sync_metadata_by_container_numbers',
src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts:44:      table: 'sync_requests',
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:46:      insertMany: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:47:      findAllByContainerId: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:48:      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:52:      insert: vi.fn(async () => {
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:55:      findLatestByContainerId: vi.fn(async (): Promise<Snapshot | null> => null),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:56:      findAllByContainerId: vi.fn(async (): Promise<readonly Snapshot[]> => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:59:      insertMany: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:60:      findActiveByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:61:      findByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:62:      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:63:      listActiveAlertReadModel: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:64:      acknowledge: vi.fn(async () => undefined),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:65:      unacknowledge: vi.fn(async () => undefined),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:67:    syncMetadataRepository: {
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:68:      listByContainerNumbers: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:74:  it('matches exact status text (case-insensitive) and returns tracking projections', async () => {
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:75:    const deps = createDeps(async () => [
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:146:  it('does not match partial status text', async () => {
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:147:    const deps = createDeps(async () => [
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:172:  it('respects limit and skips repository call for empty query', async () => {
src/modules/tracking/application/usecases/tests/search-tracking-by-derived-status-text.usecase.test.ts:173:    const listSearchObservations = vi.fn(async () => [
src/modules/tracking/application/tests/pipeline.integration.test.ts:22:  async insert(snapshot: NewSnapshot): Promise<Snapshot> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:31:  async findLatestByContainerId(containerId: string): Promise<Snapshot | null> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:38:  async findAllByContainerId(containerId: string): Promise<readonly Snapshot[]> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:53:  async insertMany(newObservations: readonly NewObservation[]): Promise<readonly Observation[]> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:67:  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:88:  async findFingerprintsByContainerId(containerId: string): Promise<ReadonlySet<string>> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:95:  async listSearchObservations() {
src/modules/tracking/application/tests/pipeline.integration.test.ts:107:  async insertMany(newAlerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:119:  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:125:  async findByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:129:  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:135:  async listActiveAlertReadModel(): Promise<readonly TrackingActiveAlertReadModel[]> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:138:  async acknowledge(alertId: string, ackedAt: string): Promise<void> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:145:  async unacknowledge(alertId: string): Promise<void> {
src/modules/tracking/application/tests/pipeline.integration.test.ts:155:  it('should process Maersk snapshot through complete pipeline: parsing → observations → timeline', async () => {
src/modules/tracking/application/tests/pipeline.integration.test.ts:229:  it('should handle idempotent processing - second snapshot with same data creates no new observations', async () => {
src/modules/tracking/application/tests/pipeline.integration.test.ts:277:  it('should detect event types correctly from Maersk payload', async () => {
src/modules/tracking/application/tests/pipeline.integration.test.ts:323:  it('should distinguish ACTUAL vs EXPECTED events', async () => {
src/modules/tracking/application/tests/pipeline.integration.test.ts:368:  it('should handle incompatible payload structure by returning no observations', async () => {
src/modules/tracking/application/tests/pipeline.integration.test.ts:402:  it('should derive timeline holes when events have large gaps', async () => {
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:12:      insertMany: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:13:      findAllByContainerId: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:14:      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:15:      listSearchObservations: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:18:      insert: vi.fn(async () => {
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:21:      findLatestByContainerId: vi.fn(async (): Promise<Snapshot | null> => null),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:22:      findAllByContainerId: vi.fn(async (): Promise<readonly Snapshot[]> => []),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:25:      insertMany: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:26:      findActiveByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:27:      findByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:28:      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:30:      acknowledge: vi.fn(async () => undefined),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:31:      unacknowledge: vi.fn(async () => undefined),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:33:    syncMetadataRepository: {
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:34:      listByContainerNumbers: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:40:  it('returns only active alerts and preserves fact/monitoring types', async () => {
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:41:    const deps = createDeps(async () => [
src/modules/container/interface/http/container.controllers.ts:15:  async function checkContainers({ request }: { request: Request }): Promise<Response> {
src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts:15:  async insertMany(observations: readonly NewObservation[]): Promise<readonly Observation[]> {
src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts:27:  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts:42:  async findFingerprintsByContainerId(containerId: string): Promise<ReadonlySet<string>> {
src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts:56:  async listSearchObservations(): Promise<readonly TrackingSearchObservationProjection[]> {
src/modules/tracking/application/usecases/tests/refresh-rest-container.usecase.test.ts:6:  it('returns container_not_found when container does not exist', async () => {
src/modules/tracking/application/usecases/tests/refresh-rest-container.usecase.test.ts:9:        findByNumbers: vi.fn(async () => ({ containers: [] })),
src/modules/tracking/application/usecases/tests/refresh-rest-container.usecase.test.ts:27:  it('returns queued with deduped=false when sync request is newly created', async () => {
src/modules/tracking/application/usecases/tests/refresh-rest-container.usecase.test.ts:28:    const enqueueSyncRequest = vi.fn(async () => ({
src/modules/tracking/application/usecases/tests/refresh-rest-container.usecase.test.ts:36:        findByNumbers: vi.fn(async () => ({
src/modules/tracking/application/usecases/tests/refresh-rest-container.usecase.test.ts:52:      expect(result.syncRequestId).toBe('07f5958b-b9df-4163-a6c4-feaed0229121')
src/modules/tracking/application/usecases/tests/refresh-rest-container.usecase.test.ts:65:  it('returns queued with deduped=true when open sync request already exists', async () => {
src/modules/tracking/application/usecases/tests/refresh-rest-container.usecase.test.ts:68:        findByNumbers: vi.fn(async () => ({
src/modules/tracking/application/usecases/tests/refresh-rest-container.usecase.test.ts:73:        enqueueSyncRequest: vi.fn(async () => ({
src/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository.ts:16:  async insert(snapshot: NewSnapshot): Promise<Snapshot> {
src/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository.ts:27:  async findLatestByContainerId(containerId: string): Promise<Snapshot | null> {
src/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository.ts:44:  async findAllByContainerId(containerId: string): Promise<readonly Snapshot[]> {
src/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository.ts:59:  async findByIds(
src/modules/tracking/application/usecases/list-active-alert-read-model.usecase.ts:14:export async function listActiveAlertReadModel(
src/routes/api/tracking/snapshots/ingest.ts:2: * Snapshot ingest API route — thin adapter to the tracking agent-sync controller.
src/routes/api/tracking/snapshots/ingest.ts:7:import { bootstrapAgentSyncControllers } from '~/modules/tracking/interface/http/agent-sync.controllers.bootstrap'
src/modules/tracking/application/usecases/get-containers-summary.usecase.ts:21:export async function getContainersSummary(
src/modules/tracking/application/usecases/get-containers-summary.usecase.ts:28:    cmd.containers.map(async (container) => {
src/modules/tracking/infrastructure/carriers/fetchers/msc.fetcher.ts:17:export async function fetchMscStatus(containerNumber: string): Promise<FetchResult> {
src/modules/process/interface/http/process.http.mappers.ts:17:import type { ContainerSyncDTO } from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
src/modules/process/interface/http/process.http.mappers.ts:154:  sync: ProcessSyncSummaryReadModel,
src/modules/process/interface/http/process.http.mappers.ts:165:    last_sync_status: sync.lastSyncStatus,
src/modules/process/interface/http/process.http.mappers.ts:166:    last_sync_at: sync.lastSyncAt,
src/modules/process/interface/http/process.http.mappers.ts:218:function toContainerSyncResponse(sync: ContainerSyncDTO) {
src/modules/process/interface/http/process.http.mappers.ts:220:    containerNumber: sync.containerNumber,
src/modules/process/interface/http/process.http.mappers.ts:221:    carrier: sync.carrier,
src/modules/process/interface/http/process.http.mappers.ts:222:    lastSuccessAt: sync.lastSuccessAt,
src/modules/process/interface/http/process.http.mappers.ts:223:    lastAttemptAt: sync.lastAttemptAt,
src/modules/process/interface/http/process.http.mappers.ts:224:    isSyncing: sync.isSyncing,
src/modules/process/interface/http/process.http.mappers.ts:225:    lastErrorCode: sync.lastErrorCode,
src/modules/process/interface/http/process.http.mappers.ts:226:    lastErrorAt: sync.lastErrorAt,
src/modules/container/interface/http/tests/container.controllers.test.ts:11:  it('returns conflicts for existing container numbers', async () => {
src/modules/container/interface/http/tests/container.controllers.test.ts:14:        findByNumbers: vi.fn(async () => ({
src/modules/container/interface/http/tests/container.controllers.test.ts:45:  it('returns empty conflicts when no container exists', async () => {
src/modules/container/interface/http/tests/container.controllers.test.ts:48:        findByNumbers: vi.fn(async () => ({ containers: [] })),
src/modules/container/application/usecases/reconcile-containers.usecase.ts:34:  return async function execute(
src/modules/tracking/application/usecases/refresh-rest-container.usecase.ts:39:      readonly syncRequestId: string
src/modules/tracking/application/usecases/refresh-rest-container.usecase.ts:50:  return async function execute(
src/modules/tracking/application/usecases/refresh-rest-container.usecase.ts:75:      syncRequestId: enqueueResult.id,
src/modules/process/interface/http/process.controllers.ts:18:} from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
src/modules/process/interface/http/process.controllers.ts:41:    | 'syncAllProcesses'
src/modules/process/interface/http/process.controllers.ts:42:    | 'syncProcessContainers'
src/modules/process/interface/http/process.controllers.ts:51:const syncingProcessIds = new Set<string>()
src/modules/process/interface/http/process.controllers.ts:119:  async function listProcesses(): Promise<Response> {
src/modules/process/interface/http/process.controllers.ts:123:        toProcessResponseWithSummary(p.pwc, p.summary, p.sync),
src/modules/process/interface/http/process.controllers.ts:135:  async function createProcess({ request }: { request: Request }): Promise<Response> {
src/modules/process/interface/http/process.controllers.ts:168:  async function getProcessById({
src/modules/process/interface/http/process.controllers.ts:201:        console.error('Failed to get container sync metadata:', err)
src/modules/process/interface/http/process.controllers.ts:206:        pwc.containers.map(async (c) => {
src/modules/process/interface/http/process.controllers.ts:260:  async function updateProcessById({
src/modules/process/interface/http/process.controllers.ts:305:  async function deleteProcessById({
src/modules/process/interface/http/process.controllers.ts:331:  // POST /api/processes/sync — run global tracking sync for active processes
src/modules/process/interface/http/process.controllers.ts:333:  async function syncAllProcesses(): Promise<Response> {
src/modules/process/interface/http/process.controllers.ts:334:    if (isSyncAllProcessesRunning || syncingProcessIds.size > 0) {
src/modules/process/interface/http/process.controllers.ts:335:      return jsonResponse({ error: 'sync_already_running' }, 409)
src/modules/process/interface/http/process.controllers.ts:340:      const result = await processUseCases.syncAllProcesses()
src/modules/process/interface/http/process.controllers.ts:344:          syncedProcesses: result.syncedProcesses,
src/modules/process/interface/http/process.controllers.ts:345:          syncedContainers: result.syncedContainers,
src/modules/process/interface/http/process.controllers.ts:351:      console.error('POST /api/processes/sync error:', err)
src/modules/process/interface/http/process.controllers.ts:359:  // POST /api/processes/[id]/sync — run tracking sync for a single process
src/modules/process/interface/http/process.controllers.ts:361:  async function syncProcessById({
src/modules/process/interface/http/process.controllers.ts:371:    if (isSyncAllProcessesRunning || syncingProcessIds.has(processId)) {
src/modules/process/interface/http/process.controllers.ts:372:      return jsonResponse({ error: 'sync_already_running' }, 409)
src/modules/process/interface/http/process.controllers.ts:375:    syncingProcessIds.add(processId)
src/modules/process/interface/http/process.controllers.ts:377:      const result = await processUseCases.syncProcessContainers({
src/modules/process/interface/http/process.controllers.ts:384:          syncedContainers: result.syncedContainers,
src/modules/process/interface/http/process.controllers.ts:390:      console.error(`POST /api/processes/${processId}/sync error:`, err)
src/modules/process/interface/http/process.controllers.ts:393:      syncingProcessIds.delete(processId)
src/modules/process/interface/http/process.controllers.ts:403:    syncAllProcesses,
src/modules/process/interface/http/process.controllers.ts:404:    syncProcessById,
src/modules/tracking/application/usecases/tests/get-containers-sync-metadata.usecase.test.ts:2:import type { SyncMetadataRecord } from '~/modules/tracking/application/ports/tracking.sync-metadata.repository'
src/modules/tracking/application/usecases/tests/get-containers-sync-metadata.usecase.test.ts:6:} from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
src/modules/tracking/application/usecases/tests/get-containers-sync-metadata.usecase.test.ts:20:describe('get-containers-sync-metadata use case', () => {
src/modules/tracking/application/usecases/tests/get-containers-sync-metadata.usecase.test.ts:21:  it('aggregates attempt/success/error/syncing and preserves input order', async () => {
src/modules/tracking/application/usecases/tests/get-containers-sync-metadata.usecase.test.ts:22:    const listByContainerNumbers = vi.fn(async () => [
src/modules/tracking/application/usecases/tests/get-containers-sync-metadata.usecase.test.ts:55:      syncMetadataRepository: {
src/modules/tracking/application/usecases/tests/get-containers-sync-metadata.usecase.test.ts:90:  it('normalizes values and returns deterministic fallback when there is no history', async () => {
src/modules/tracking/application/usecases/tests/get-containers-sync-metadata.usecase.test.ts:92:      syncMetadataRepository: {
src/modules/tracking/application/usecases/tests/get-containers-sync-metadata.usecase.test.ts:93:        listByContainerNumbers: vi.fn(async () => []),
src/routes/api/tracking/snapshots/ingest.route.test.ts:8:vi.mock('~/modules/tracking/interface/http/agent-sync.controllers.bootstrap', () => ({
src/routes/api/tracking/snapshots/ingest.route.test.ts:18:  it('binds POST /api/tracking/snapshots/ingest to agent-sync controller', () => {
src/modules/tracking/infrastructure/carriers/fetchers/cmacgm.fetcher.ts:10:export async function fetchCmaCgmStatus(containerNumber: string): Promise<FetchResult> {
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:91:    async (_containerId: string, _snapshotIds: readonly string[]): Promise<readonly Snapshot[]> =>
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:95:    async (_containerId: string): Promise<readonly Snapshot[]> => snapshots,
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:100:      insertMany: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:101:      findAllByContainerId: vi.fn(async () => observations),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:102:      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:103:      listSearchObservations: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:106:      insert: vi.fn(async () => {
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:109:      findLatestByContainerId: vi.fn(async (): Promise<Snapshot | null> => null),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:114:      insertMany: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:116:        async (): Promise<readonly TrackingActiveAlertReadModel[]> => [],
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:118:      findActiveByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:119:      findByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:120:      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:121:      acknowledge: vi.fn(async () => undefined),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:122:      unacknowledge: vi.fn(async () => undefined),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:124:    syncMetadataRepository: {
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:125:      listByContainerNumbers: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:142:  it('does not load snapshots when no OTHER observations require enrichment', async () => {
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:160:  it('enriches legacy OTHER observation carrier label using targeted snapshot ids', async () => {
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:200:  it('loads active + acknowledged alerts when includeAcknowledgedAlerts is enabled', async () => {
src/modules/tracking/application/usecases/tests/get-container-summary.usecase.test.ts:209:      async (): Promise<readonly TrackingAlert[]> => [
src/modules/container/application/usecases/list-containers-by-process-ids.usecase.ts:13:  return async function execute(
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:39:      insertMany: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:41:      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:42:      listSearchObservations: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:45:      insert: vi.fn(async () => {
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:48:      findLatestByContainerId: vi.fn(async (): Promise<Snapshot | null> => null),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:49:      findAllByContainerId: vi.fn(async (): Promise<readonly Snapshot[]> => []),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:52:      insertMany: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:53:      findActiveByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:54:      findByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:55:      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:56:      listActiveAlertReadModel: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:57:      acknowledge: vi.fn(async () => undefined),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:58:      unacknowledge: vi.fn(async () => undefined),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:60:    syncMetadataRepository: {
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:61:      listByContainerNumbers: vi.fn(async () => []),
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:67:  it('returns summaries for multiple containers', async () => {
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:68:    const deps = createDeps(async (containerId) => {
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:93:  it('keeps partial success and marks dataIssue=true for failed containers', async () => {
src/modules/tracking/application/usecases/tests/get-containers-summary.usecase.test.ts:94:    const deps = createDeps(async (containerId) => {
src/modules/container/application/usecases/list-containers-by-process-id.usecase.ts:13:  return async function execute(
src/modules/process/interface/http/tests/process.controllers.test.ts:13:import type { ContainerSyncDTO } from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
src/modules/process/interface/http/tests/process.controllers.test.ts:33:  readonly syncedProcesses: number
src/modules/process/interface/http/tests/process.controllers.test.ts:34:  readonly syncedContainers: number
src/modules/process/interface/http/tests/process.controllers.test.ts:39:  readonly syncedContainers: number
src/modules/process/interface/http/tests/process.controllers.test.ts:151:  const getContainersSyncMetadata = vi.fn<GetContainersSyncMetadataMock>(async (command) =>
src/modules/process/interface/http/tests/process.controllers.test.ts:170:  syncAllProcesses: SyncAllProcessesMock = vi.fn(async () => ({
src/modules/process/interface/http/tests/process.controllers.test.ts:171:    syncedProcesses: 1,
src/modules/process/interface/http/tests/process.controllers.test.ts:172:    syncedContainers: 2,
src/modules/process/interface/http/tests/process.controllers.test.ts:174:  syncProcessContainers: SyncProcessContainersMock = vi.fn(async (command) => ({
src/modules/process/interface/http/tests/process.controllers.test.ts:176:    syncedContainers: 2,
src/modules/process/interface/http/tests/process.controllers.test.ts:183:      listProcessesWithOperationalSummary: vi.fn(async () => ({ processes: [] })),
src/modules/process/interface/http/tests/process.controllers.test.ts:184:      createProcess: vi.fn(async () => ({
src/modules/process/interface/http/tests/process.controllers.test.ts:189:      findProcessByIdWithContainers: vi.fn(async () => ({
src/modules/process/interface/http/tests/process.controllers.test.ts:192:      updateProcess: vi.fn(async () => ({ process: processWithContainers })),
src/modules/process/interface/http/tests/process.controllers.test.ts:193:      findProcessById: vi.fn(async () => ({ process })),
src/modules/process/interface/http/tests/process.controllers.test.ts:194:      deleteProcess: vi.fn(async () => ({ deleted: true as const })),
src/modules/process/interface/http/tests/process.controllers.test.ts:195:      syncAllProcesses,
src/modules/process/interface/http/tests/process.controllers.test.ts:196:      syncProcessContainers,
src/modules/process/interface/http/tests/process.controllers.test.ts:206:  it('returns process detail with container operational and process coverage', async () => {
src/modules/process/interface/http/tests/process.controllers.test.ts:227:      async (containerId: string, containerNumber: string) => {
src/modules/process/interface/http/tests/process.controllers.test.ts:291:  it('falls back to deterministic empty sync metadata when sync metadata lookup fails', async () => {
src/modules/process/interface/http/tests/process.controllers.test.ts:294:      async (containerId: string, containerNumber: string) => {
src/modules/process/interface/http/tests/process.controllers.test.ts:298:    const getContainersSyncMetadata = vi.fn<GetContainersSyncMetadataMock>(async () => {
src/modules/process/interface/http/tests/process.controllers.test.ts:299:      throw new Error('sync metadata lookup failed')
src/modules/process/interface/http/tests/process.controllers.test.ts:334:  it('does not infer POD code from free-text destination names', async () => {
src/modules/process/interface/http/tests/process.controllers.test.ts:337:      async (containerId: string, containerNumber: string) => {
src/modules/process/interface/http/tests/process.controllers.test.ts:363:  it('accepts alphanumeric direct destination codes with numeric terminal suffix', async () => {
src/modules/process/interface/http/tests/process.controllers.test.ts:366:      async (containerId: string, containerNumber: string) => {
src/modules/process/interface/http/tests/process.controllers.test.ts:392:  it('returns 200 with sync counters when global sync completes', async () => {
src/modules/process/interface/http/tests/process.controllers.test.ts:395:      async (containerId: string, containerNumber: string) => {
src/modules/process/interface/http/tests/process.controllers.test.ts:399:    const syncAllProcessesMock = vi.fn<SyncAllProcessesMock>(async () => ({
src/modules/process/interface/http/tests/process.controllers.test.ts:400:      syncedProcesses: 3,
src/modules/process/interface/http/tests/process.controllers.test.ts:401:      syncedContainers: 8,
src/modules/process/interface/http/tests/process.controllers.test.ts:407:      vi.fn<GetContainersSyncMetadataMock>(async () => []),
src/modules/process/interface/http/tests/process.controllers.test.ts:408:      syncAllProcessesMock,
src/modules/process/interface/http/tests/process.controllers.test.ts:411:    const response = await controllers.syncAllProcesses()
src/modules/process/interface/http/tests/process.controllers.test.ts:417:      syncedProcesses: 3,
src/modules/process/interface/http/tests/process.controllers.test.ts:418:      syncedContainers: 8,
src/modules/process/interface/http/tests/process.controllers.test.ts:420:    expect(syncAllProcessesMock).toHaveBeenCalledTimes(1)
src/modules/process/interface/http/tests/process.controllers.test.ts:423:  it('returns 409 when a global sync is already in progress', async () => {
src/modules/process/interface/http/tests/process.controllers.test.ts:426:      async (containerId: string, containerNumber: string) => {
src/modules/process/interface/http/tests/process.controllers.test.ts:436:    const syncAllProcessesMock = vi.fn<SyncAllProcessesMock>(async () => {
src/modules/process/interface/http/tests/process.controllers.test.ts:439:        syncedProcesses: 1,
src/modules/process/interface/http/tests/process.controllers.test.ts:440:        syncedContainers: 2,
src/modules/process/interface/http/tests/process.controllers.test.ts:447:      vi.fn<GetContainersSyncMetadataMock>(async () => []),
src/modules/process/interface/http/tests/process.controllers.test.ts:448:      syncAllProcessesMock,
src/modules/process/interface/http/tests/process.controllers.test.ts:451:    const firstRequestPromise = controllers.syncAllProcesses()
src/modules/process/interface/http/tests/process.controllers.test.ts:454:    const secondResponse = await controllers.syncAllProcesses()
src/modules/process/interface/http/tests/process.controllers.test.ts:458:    expect(secondBody).toEqual({ error: 'sync_already_running' })
src/modules/process/interface/http/tests/process.controllers.test.ts:464:    expect(syncAllProcessesMock).toHaveBeenCalledTimes(1)
src/modules/process/interface/http/tests/process.controllers.test.ts:467:  it('returns 200 with process sync counters when process sync completes', async () => {
src/modules/process/interface/http/tests/process.controllers.test.ts:470:      async (containerId: string, containerNumber: string) => {
src/modules/process/interface/http/tests/process.controllers.test.ts:474:    const syncProcessContainersMock = vi.fn<SyncProcessContainersMock>(async (command) => ({
src/modules/process/interface/http/tests/process.controllers.test.ts:476:      syncedContainers: 3,
src/modules/process/interface/http/tests/process.controllers.test.ts:482:      vi.fn<GetContainersSyncMetadataMock>(async () => []),
src/modules/process/interface/http/tests/process.controllers.test.ts:483:      vi.fn<SyncAllProcessesMock>(async () => ({
src/modules/process/interface/http/tests/process.controllers.test.ts:484:        syncedProcesses: 1,
src/modules/process/interface/http/tests/process.controllers.test.ts:485:        syncedContainers: 2,
src/modules/process/interface/http/tests/process.controllers.test.ts:487:      syncProcessContainersMock,
src/modules/process/interface/http/tests/process.controllers.test.ts:490:    const response = await controllers.syncProcessById({ params: { id: 'process-1' } })
src/modules/process/interface/http/tests/process.controllers.test.ts:497:      syncedContainers: 3,
src/modules/process/interface/http/tests/process.controllers.test.ts:499:    expect(syncProcessContainersMock).toHaveBeenCalledWith({
src/modules/process/interface/http/tests/process.controllers.test.ts:504:  it('returns 409 when sync for the same process is already in progress', async () => {
src/modules/process/interface/http/tests/process.controllers.test.ts:507:      async (containerId: string, containerNumber: string) => {
src/modules/process/interface/http/tests/process.controllers.test.ts:517:    const syncProcessContainersMock = vi.fn<SyncProcessContainersMock>(async () => {
src/modules/process/interface/http/tests/process.controllers.test.ts:521:        syncedContainers: 2,
src/modules/process/interface/http/tests/process.controllers.test.ts:528:      vi.fn<GetContainersSyncMetadataMock>(async () => []),
src/modules/process/interface/http/tests/process.controllers.test.ts:529:      vi.fn<SyncAllProcessesMock>(async () => ({
src/modules/process/interface/http/tests/process.controllers.test.ts:530:        syncedProcesses: 1,
src/modules/process/interface/http/tests/process.controllers.test.ts:531:        syncedContainers: 2,
src/modules/process/interface/http/tests/process.controllers.test.ts:533:      syncProcessContainersMock,
src/modules/process/interface/http/tests/process.controllers.test.ts:536:    const firstRequestPromise = controllers.syncProcessById({ params: { id: 'process-1' } })
src/modules/process/interface/http/tests/process.controllers.test.ts:539:    const secondResponse = await controllers.syncProcessById({ params: { id: 'process-1' } })
src/modules/process/interface/http/tests/process.controllers.test.ts:543:    expect(secondBody).toEqual({ error: 'sync_already_running' })
src/modules/process/interface/http/tests/process.controllers.test.ts:549:    expect(syncProcessContainersMock).toHaveBeenCalledTimes(1)
src/modules/container/application/usecases/create-container.usecase.ts:20:  return async function execute(command: CreateContainerCommand): Promise<CreateContainerResult> {
src/modules/container/application/usecases/delete-container.usecase.ts:11:  return async function execute(params: DeleteContainerCommand): Promise<void> {
src/modules/process/infrastructure/persistence/supabaseProcessRepository.ts:19:  async fetchAll(): Promise<readonly ProcessEntity[]> {
src/modules/process/infrastructure/persistence/supabaseProcessRepository.ts:31:  async fetchById(processId: string): Promise<ProcessEntity | null> {
src/modules/process/infrastructure/persistence/supabaseProcessRepository.ts:40:  async create(record: InsertProcessRecord): Promise<ProcessEntity> {
src/modules/process/infrastructure/persistence/supabaseProcessRepository.ts:51:  async update(processId: string, record: UpdateProcessRecord): Promise<ProcessEntity> {
src/modules/process/infrastructure/persistence/supabaseProcessRepository.ts:67:  async delete(processId: string): Promise<void> {
src/modules/tracking/infrastructure/bootstrap/tracking.bootstrap.ts:7:import type { SyncMetadataRepository } from '~/modules/tracking/application/ports/tracking.sync-metadata.repository'
src/modules/tracking/infrastructure/bootstrap/tracking.bootstrap.ts:22:  readonly syncMetadataRepository: SyncMetadataRepository
src/modules/tracking/infrastructure/bootstrap/tracking.bootstrap.ts:43:  const syncMetadataRepository = overrides.syncMetadataRepository ?? supabaseSyncMetadataRepository
src/modules/tracking/infrastructure/bootstrap/tracking.bootstrap.ts:49:    syncMetadataRepository,
src/modules/container/application/usecases/create-many-containers.usecase.ts:23:  return async function execute(
src/modules/container/application/usecases/find-containers-by-number.usecase.ts:14:  return async function execute(
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:18:import type { SyncAllProcessesDeps } from '~/modules/process/application/usecases/sync-all-processes.usecase'
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:19:import type { SyncProcessContainersDeps } from '~/modules/process/application/usecases/sync-process-containers.usecase'
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:50:async function sleep(delayMs: number): Promise<void> {
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:77:async function enqueueContainerSyncRequest(command: {
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:85:  const result = await supabaseServer.rpc('enqueue_sync_request', {
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:94:    operation: 'enqueue_sync_request',
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:95:    table: 'sync_requests',
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:108:async function getSyncRequestStatuses(command: {
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:109:  readonly syncRequestIds: readonly string[]
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:113:    readonly syncRequestId: string
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:120:  const uniqueSyncRequestIds = Array.from(new Set(command.syncRequestIds))
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:129:    .from('sync_requests')
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:135:    operation: 'get_sync_request_statuses_for_process_sync',
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:136:    table: 'sync_requests',
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:142:  const requests = command.syncRequestIds.map((syncRequestId) => {
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:143:    const row = byId.get(syncRequestId)
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:146:        syncRequestId,
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:148:        lastError: 'sync_request_not_found',
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:155:      syncRequestId: row.id,
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:175:const syncAllProcessesDeps: SyncAllProcessesDeps = {
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:176:  async listActiveProcessIds() {
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:200:const syncProcessContainersDeps: SyncProcessContainersDeps = {
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:201:  async fetchProcessById(command) {
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:204:  async listContainersByProcessId(command) {
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:226:  syncAllProcessesDeps,
src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:227:  syncProcessContainersDeps,
src/modules/process/ui/hooks/useProcessSyncRealtime.ts:10:} from '~/shared/api/sync-requests.realtime.client'
src/modules/process/ui/hooks/useProcessSyncRealtime.ts:55:  if (status === 'PENDING' || status === 'LEASED' || status === 'RUNNING') return 'syncing'
src/modules/process/ui/hooks/useProcessSyncRealtime.ts:72:  if (states.some((state) => state === 'syncing')) return 'syncing'
src/modules/process/ui/hooks/useProcessSyncRealtime.ts:175:        // Defer update to break potential synchronous cycles
src/modules/process/application/process.usecases.ts:21:} from '~/modules/process/application/usecases/sync-all-processes.usecase'
src/modules/process/application/process.usecases.ts:25:} from '~/modules/process/application/usecases/sync-process-containers.usecase'
src/modules/process/application/process.usecases.ts:32:  syncAllProcessesDeps: SyncAllProcessesDeps
src/modules/process/application/process.usecases.ts:33:  syncProcessContainersDeps: SyncProcessContainersDeps
src/modules/process/application/process.usecases.ts:80:  const syncAllProcesses = createSyncAllProcessesUseCase(deps.syncAllProcessesDeps)
src/modules/process/application/process.usecases.ts:81:  const syncProcessContainers = createSyncProcessContainersUseCase(deps.syncProcessContainersDeps)
src/modules/process/application/process.usecases.ts:94:    syncAllProcesses,
src/modules/process/application/process.usecases.ts:95:    syncProcessContainers,
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:13:    insert: vi.fn(async (_record: InsertContainerRecord): Promise<ContainerEntity> => {
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:16:    insertMany: vi.fn(async (_records: InsertContainerRecord[]): Promise<ContainerEntity[]> => {
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:19:    delete: vi.fn(async (_id: string): Promise<void> => {
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:22:    existsMany: vi.fn(async (_numbers: string[]): Promise<Map<string, boolean>> => {
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:25:    findByNumber: vi.fn(async (_containerNumber: string): Promise<ContainerEntity | null> => {
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:28:    findByNumbers: vi.fn(async (_numbers: string[]): Promise<ContainerEntity[]> => {
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:31:    listSearchProjections: vi.fn(async () => projections),
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:32:    listByProcessId: vi.fn(async (_processId: string): Promise<readonly ContainerEntity[]> => {
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:36:      async (
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:46:  it('supports exact and partial case-insensitive matches', async () => {
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:73:  it('respects the limit after matching', async () => {
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:90:  it('applies process limit before truncating container matches', async () => {
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:109:  it('returns empty results for empty query or non-positive limit without calling repository', async () => {
src/modules/container/application/usecases/tests/search-containers-by-number.usecase.test.ts:110:    const listSearchProjections = vi.fn(async () => [
src/modules/container/infrastructure/persistence/container.repository.supabase.ts:14:  async findByNumber(containerNumber: string): Promise<ContainerEntity | null> {
src/modules/container/infrastructure/persistence/container.repository.supabase.ts:32:  async insert(record): Promise<ContainerEntity> {
src/modules/container/infrastructure/persistence/container.repository.supabase.ts:44:  async insertMany(records): Promise<ContainerEntity[]> {
src/modules/container/infrastructure/persistence/container.repository.supabase.ts:58:  async existsMany(containerNumbers: string[]): Promise<Map<string, boolean>> {
src/modules/container/infrastructure/persistence/container.repository.supabase.ts:80:  async findByNumbers(containerNumbers: string[]): Promise<ContainerEntity[]> {
src/modules/container/infrastructure/persistence/container.repository.supabase.ts:95:  async listSearchProjections() {
src/modules/container/infrastructure/persistence/container.repository.supabase.ts:112:  async delete(containerId: string): Promise<void> {
src/modules/container/infrastructure/persistence/container.repository.supabase.ts:118:  async listByProcessId(processId: string): Promise<readonly ContainerEntity[]> {
src/modules/container/infrastructure/persistence/container.repository.supabase.ts:133:  async listByProcessIds(
src/modules/process/ui/hooks/tests/useProcessSyncRealtime.test.ts:12:  it('maps RUNNING-like realtime statuses to syncing', () => {
src/modules/process/ui/hooks/tests/useProcessSyncRealtime.test.ts:13:    expect(toProcessSyncStateFromRealtimeStatus('RUNNING')).toBe('syncing')
src/modules/process/ui/hooks/tests/useProcessSyncRealtime.test.ts:14:    expect(toProcessSyncStateFromRealtimeStatus('PENDING')).toBe('syncing')
src/modules/process/ui/hooks/tests/useProcessSyncRealtime.test.ts:15:    expect(toProcessSyncStateFromRealtimeStatus('LEASED')).toBe('syncing')
src/modules/process/ui/hooks/tests/useProcessSyncRealtime.test.ts:40:        last_sync_status: 'DONE',
src/modules/process/ui/hooks/tests/useProcessSyncRealtime.test.ts:48:        last_sync_status: 'FAILED',
src/modules/process/ui/hooks/tests/useProcessSyncRealtime.test.ts:53:    expect(mapped[0].syncStatus).toBe('idle')
src/modules/process/ui/hooks/tests/useProcessSyncRealtime.test.ts:54:    expect(mapped[1].syncStatus).toBe('idle')
src/modules/container/application/usecases/search-containers-by-number.usecase.ts:47:  return async function searchByNumber(
src/modules/process/ui/fetchProcess.ts:6:export async function fetchProcess(
src/modules/container/application/usecases/check-container-existence.usecase.ts:13:  return async function execute(
src/routes/api/refresh-maersk/[container].ts:5: * Use POST /api/refresh to enqueue a sync request instead.
src/routes/api/refresh-maersk/[container].ts:9:  return new Response(JSON.stringify({ error: 'refresh_maersk_deprecated_use_sync_queue' }), {
src/modules/process/ui/CreateProcessDialog.tsx:268:async function requestContainerConflicts(
src/modules/process/ui/CreateProcessDialog.tsx:292:async function validateSubmitWithServerCheck(params: {
src/modules/process/ui/CreateProcessDialog.tsx:587:    void (async () => {
src/modules/process/ui/CreateProcessDialog.tsx:633:    void (async () => {
src/modules/process/ui/components/DashboardProcessTable.tsx:355:          status={props.process.syncStatus}
src/modules/process/ui/components/DashboardProcessTable.tsx:441:        <th class="px-3 py-2.5 text-center">{t(keys.dashboard.table.col.sync)}</th>
src/modules/process/ui/validation/processApi.validation.ts:108:export async function fetchDashboardProcessSummaries(
src/modules/process/ui/validation/processApi.validation.ts:119:async function fetchDashboardOperationalSummary() {
src/modules/process/ui/validation/processApi.validation.ts:127:export async function fetchDashboardGlobalAlertsSummary(): Promise<DashboardGlobalAlertsVM> {
src/modules/process/ui/validation/processApi.validation.ts:132:export async function createProcessRequest(input: CreateProcessInput): Promise<string> {
src/modules/process/ui/validation/processApi.validation.ts:146:export async function updateProcessRequest(id: string, input: CreateProcessInput): Promise<void> {
src/modules/process/ui/validation/processApi.validation.ts:158:async function runTrackingAlertActionRequest(
src/modules/process/ui/validation/processApi.validation.ts:173:export async function acknowledgeTrackingAlertRequest(alertId: string): Promise<void> {
src/modules/process/ui/validation/processApi.validation.ts:177:export async function unacknowledgeTrackingAlertRequest(alertId: string): Promise<void> {
src/modules/process/ui/components/ContainerSelector.tsx:37:  readonly syncing: string
src/modules/process/ui/components/ContainerSelector.tsx:63:  readonly syncNow: Date
src/modules/process/ui/components/ContainerSelector.tsx:68:  const syncLabel = () =>
src/modules/process/ui/components/ContainerSelector.tsx:70:      props.container.sync,
src/modules/process/ui/components/ContainerSelector.tsx:72:        syncing: props.labels.syncing,
src/modules/process/ui/components/ContainerSelector.tsx:80:        now: props.syncNow,
src/modules/process/ui/components/ContainerSelector.tsx:147:          data-testid={`container-sync-chip-${props.container.id}`}
src/modules/process/ui/components/ContainerSelector.tsx:150:          {syncLabel()}
src/modules/process/ui/components/ContainerSelector.tsx:166:  syncNow: Date
src/modules/process/ui/components/ContainerSelector.tsx:177:    syncing: t(keys.shipmentView.sync.syncing),
src/modules/process/ui/components/ContainerSelector.tsx:178:    never: t(keys.shipmentView.sync.never),
src/modules/process/ui/components/ContainerSelector.tsx:179:    updatedUnknownTime: t(keys.shipmentView.sync.updatedUnknownTime),
src/modules/process/ui/components/ContainerSelector.tsx:180:    failedUnknownTime: t(keys.shipmentView.sync.failedUnknownTime),
src/modules/process/ui/components/ContainerSelector.tsx:181:    updated: (relative: string) => t(keys.shipmentView.sync.updated, { relative }),
src/modules/process/ui/components/ContainerSelector.tsx:182:    failed: (relative: string) => t(keys.shipmentView.sync.failed, { relative }),
src/modules/process/ui/components/ContainerSelector.tsx:195:            syncNow={props.syncNow}
src/modules/process/ui/screens/DashboardScreen.tsx:5:  syncAllProcessesRequest,
src/modules/process/ui/screens/DashboardScreen.tsx:6:  syncProcessRequest,
src/modules/process/ui/screens/DashboardScreen.tsx:167:        syncStatus: realtimeState,
src/modules/process/ui/screens/DashboardScreen.tsx:200:  const handleDashboardRefresh = async () => {
src/modules/process/ui/screens/DashboardScreen.tsx:202:      syncAllProcesses: syncAllProcessesRequest,
src/modules/process/ui/screens/DashboardScreen.tsx:208:  const handleProcessSync = async (processId: string) => {
src/modules/process/ui/screens/DashboardScreen.tsx:209:    await syncProcessRequest(processId)
src/modules/process/ui/screens/DashboardScreen.tsx:244:  const handleProcessSubmit = async (data: CreateProcessDialogFormData) => {
src/modules/process/ui/api/tests/processSync.api.test.ts:3:  syncAllProcessesRequest,
src/modules/process/ui/api/tests/processSync.api.test.ts:4:  syncProcessRequest,
src/modules/process/ui/api/tests/processSync.api.test.ts:7:describe('syncAllProcessesRequest', () => {
src/modules/process/ui/api/tests/processSync.api.test.ts:12:  it('calls the global process sync endpoint and returns parsed counters', async () => {
src/modules/process/ui/api/tests/processSync.api.test.ts:14:      async () =>
src/modules/process/ui/api/tests/processSync.api.test.ts:15:        new Response(JSON.stringify({ ok: true, syncedProcesses: 2, syncedContainers: 5 }), {
src/modules/process/ui/api/tests/processSync.api.test.ts:23:    const result = await syncAllProcessesRequest()
src/modules/process/ui/api/tests/processSync.api.test.ts:25:    expect(fetchSpy).toHaveBeenCalledWith('/api/processes/sync', {
src/modules/process/ui/api/tests/processSync.api.test.ts:30:      syncedProcesses: 2,
src/modules/process/ui/api/tests/processSync.api.test.ts:31:      syncedContainers: 5,
src/modules/process/ui/api/tests/processSync.api.test.ts:36:describe('syncProcessRequest', () => {
src/modules/process/ui/api/tests/processSync.api.test.ts:41:  it('calls the process scoped sync endpoint and returns parsed counters', async () => {
src/modules/process/ui/api/tests/processSync.api.test.ts:43:      async () =>
src/modules/process/ui/api/tests/processSync.api.test.ts:44:        new Response(JSON.stringify({ ok: true, processId: 'process-123', syncedContainers: 2 }), {
src/modules/process/ui/api/tests/processSync.api.test.ts:52:    const result = await syncProcessRequest('process-123')
src/modules/process/ui/api/tests/processSync.api.test.ts:54:    expect(fetchSpy).toHaveBeenCalledWith('/api/processes/process-123/sync', {
src/modules/process/ui/api/tests/processSync.api.test.ts:60:      syncedContainers: 2,
src/modules/process/application/usecases/sync-process-containers.usecase.ts:11:  readonly syncRequestId: string
src/modules/process/application/usecases/sync-process-containers.usecase.ts:28:  readonly syncedContainers: number
src/modules/process/application/usecases/sync-process-containers.usecase.ts:51:    readonly syncRequestIds: readonly string[]
src/modules/process/application/usecases/sync-process-containers.usecase.ts:90:  syncRequestIds: readonly string[],
src/modules/process/application/usecases/sync-process-containers.usecase.ts:93:  const byId = new Map(requests.map((request) => [request.syncRequestId, request]))
src/modules/process/application/usecases/sync-process-containers.usecase.ts:95:  return syncRequestIds.map((syncRequestId) => {
src/modules/process/application/usecases/sync-process-containers.usecase.ts:96:    const request = byId.get(syncRequestId)
src/modules/process/application/usecases/sync-process-containers.usecase.ts:100:      syncRequestId,
src/modules/process/application/usecases/sync-process-containers.usecase.ts:102:      lastError: 'sync_request_not_found',
src/modules/process/application/usecases/sync-process-containers.usecase.ts:107:async function defaultSleep(delayMs: number): Promise<void> {
src/modules/process/application/usecases/sync-process-containers.usecase.ts:113:async function waitForTerminalStatuses(command: {
src/modules/process/application/usecases/sync-process-containers.usecase.ts:114:  readonly syncRequestIds: readonly string[]
src/modules/process/application/usecases/sync-process-containers.usecase.ts:126:      syncRequestIds: command.syncRequestIds,
src/modules/process/application/usecases/sync-process-containers.usecase.ts:129:    const requests = toTerminalStatusItems(command.syncRequestIds, response.requests)
src/modules/process/application/usecases/sync-process-containers.usecase.ts:150:  throw new HttpError('sync_process_timeout', 504)
src/modules/process/application/usecases/sync-process-containers.usecase.ts:159:  return async function execute(
src/modules/process/application/usecases/sync-process-containers.usecase.ts:164:      throw new HttpError('process_id_required_for_sync', 400)
src/modules/process/application/usecases/sync-process-containers.usecase.ts:176:        syncedContainers: 0,
src/modules/process/application/usecases/sync-process-containers.usecase.ts:180:    const syncTargets: SyncTarget[] = []
src/modules/process/application/usecases/sync-process-containers.usecase.ts:188:          `unsupported_sync_provider_for_process:${processId}:${containerNumber}:${carrierCode}`,
src/modules/process/application/usecases/sync-process-containers.usecase.ts:195:        throw new HttpError('invalid_container_number_for_sync', 422)
src/modules/process/application/usecases/sync-process-containers.usecase.ts:198:      syncTargets.push({
src/modules/process/application/usecases/sync-process-containers.usecase.ts:205:      syncTargets.map((target) =>
src/modules/process/application/usecases/sync-process-containers.usecase.ts:213:    const syncRequestIds = Array.from(new Set(enqueueResults.map((result) => result.id)))
src/modules/process/application/usecases/sync-process-containers.usecase.ts:215:      syncRequestIds,
src/modules/process/application/usecases/sync-process-containers.usecase.ts:231:        `${firstFailure.status.toLowerCase()}_${firstFailure.syncRequestId}`
src/modules/process/application/usecases/sync-process-containers.usecase.ts:232:      throw new HttpError(`sync_process_failed:${processId}:${firstError}`, 502)
src/modules/process/application/usecases/sync-process-containers.usecase.ts:237:      syncedContainers: syncTargets.length,
src/modules/process/ui/viewmodels/process-summary.vm.ts:4:export type ProcessSyncStatus = 'idle' | 'syncing' | 'success' | 'error'
src/modules/process/ui/viewmodels/process-summary.vm.ts:31:  readonly syncStatus: ProcessSyncStatus
src/modules/process/ui/utils/dashboard-refresh.ts:2:  readonly syncAllProcesses: () => unknown
src/modules/process/ui/utils/dashboard-refresh.ts:16:export async function refreshDashboardData(command: DashboardRefreshCommand): Promise<void> {
src/modules/process/ui/utils/dashboard-refresh.ts:17:  await Promise.resolve(command.syncAllProcesses())
src/modules/process/ui/tests/ShipmentView.sync-realtime.test.ts:5:} from '~/modules/process/ui/utils/sync-realtime-coordinator'
src/modules/process/ui/tests/ShipmentView.sync-realtime.test.ts:6:import type { SyncRequestRealtimeEvent } from '~/shared/api/sync-requests.realtime.client'
src/modules/process/ui/tests/ShipmentView.sync-realtime.test.ts:28:describe('ShipmentView sync realtime helpers', () => {
src/modules/process/ui/tests/ShipmentView.sync-realtime.test.ts:98:  it('enables fallback polling when there are syncing containers and page is visible', () => {
src/modules/process/ui/components/ContainersPanel.tsx:11:  syncNow: Date
src/modules/process/ui/components/ContainersPanel.tsx:25:        syncNow={props.syncNow}
src/modules/process/ui/ShipmentView.tsx:15:import { pollRefreshSyncStatus } from '~/modules/process/ui/utils/refresh-sync-polling'
src/modules/process/ui/ShipmentView.tsx:16:import { useSyncRealtimeCoordinator } from '~/modules/process/ui/utils/sync-realtime-coordinator'
src/modules/process/ui/ShipmentView.tsx:36:} from '~/shared/api/sync-requests.realtime.client'
src/modules/process/ui/ShipmentView.tsx:129:  syncRequestId: z.string().uuid(),
src/modules/process/ui/ShipmentView.tsx:139:      syncRequestId: z.string().uuid(),
src/modules/process/ui/ShipmentView.tsx:149:  readonly syncRequestId: string
src/modules/process/ui/ShipmentView.tsx:213:async function refreshTrackingDataOnly(command: {
src/modules/process/ui/ShipmentView.tsx:259:  syncRequestIdSet: ReadonlySet<string>,
src/modules/process/ui/ShipmentView.tsx:263:  if (!syncRequestIdSet.has(row.id)) return null
src/modules/process/ui/ShipmentView.tsx:267:      syncRequestId: row.id,
src/modules/process/ui/ShipmentView.tsx:269:      lastError: 'sync_request_not_found',
src/modules/process/ui/ShipmentView.tsx:276:    syncRequestId: row.id,
src/modules/process/ui/ShipmentView.tsx:289:    statusBySyncRequestId.set(request.syncRequestId, request)
src/modules/process/ui/ShipmentView.tsx:294:  syncRequestIds: readonly string[],
src/modules/process/ui/ShipmentView.tsx:297:  const requests = syncRequestIds.map((syncRequestId) => {
src/modules/process/ui/ShipmentView.tsx:298:    const known = statusBySyncRequestId.get(syncRequestId)
src/modules/process/ui/ShipmentView.tsx:302:      syncRequestId,
src/modules/process/ui/ShipmentView.tsx:304:      lastError: 'sync_request_not_found',
src/modules/process/ui/ShipmentView.tsx:339:async function enqueueContainerRefresh(
src/modules/process/ui/ShipmentView.tsx:342:): Promise<{ readonly syncRequestId: string }> {
src/modules/process/ui/ShipmentView.tsx:361:  return { syncRequestId: parsed.data.syncRequestId }
src/modules/process/ui/ShipmentView.tsx:364:async function fetchRefreshSyncStatuses(syncRequestIds: readonly string[]) {
src/modules/process/ui/ShipmentView.tsx:366:  for (const syncRequestId of syncRequestIds) {
src/modules/process/ui/ShipmentView.tsx:367:    params.append('sync_request_id', syncRequestId)
src/modules/process/ui/ShipmentView.tsx:394:  readonly syncRequestIds: readonly string[]
src/modules/process/ui/ShipmentView.tsx:412:async function waitForTerminalSyncRequests(
src/modules/process/ui/ShipmentView.tsx:415:  const syncRequestIdSet = new Set(command.syncRequestIds)
src/modules/process/ui/ShipmentView.tsx:430:      command.syncRequestIds,
src/modules/process/ui/ShipmentView.tsx:443:    syncRequestIds: command.syncRequestIds,
src/modules/process/ui/ShipmentView.tsx:447:      const requestStatus = mapRealtimeEventToRefreshStatus(event, syncRequestIdSet)
src/modules/process/ui/ShipmentView.tsx:450:      statusBySyncRequestId.set(requestStatus.syncRequestId, requestStatus)
src/modules/process/ui/ShipmentView.tsx:455:        console.warn('[refresh] sync_requests realtime channel degraded', channelStatus)
src/modules/process/ui/ShipmentView.tsx:462:  const bootstrapStatus = await fetchRefreshSyncStatuses(command.syncRequestIds)
src/modules/process/ui/ShipmentView.tsx:469:      response: toRefreshStatusResponseFromMap(command.syncRequestIds, statusBySyncRequestId),
src/modules/process/ui/ShipmentView.tsx:474:    syncRequestIds: command.syncRequestIds,
src/modules/process/ui/ShipmentView.tsx:477:    fetchSyncStatus: async (syncRequestIds) => {
src/modules/process/ui/ShipmentView.tsx:478:      const response = await fetchRefreshSyncStatuses(syncRequestIds)
src/modules/process/ui/ShipmentView.tsx:524:async function refreshShipmentContainers(params: RefreshContainersParams): Promise<void> {
src/modules/process/ui/ShipmentView.tsx:543:    const syncRequestIds: string[] = []
src/modules/process/ui/ShipmentView.tsx:548:        syncRequestIds.push(result.value.syncRequestId)
src/modules/process/ui/ShipmentView.tsx:554:    const uniqueSyncRequestIds = Array.from(new Set(syncRequestIds))
src/modules/process/ui/ShipmentView.tsx:562:    // Reflect queued sync requests immediately in chips/header (syncing state) before terminal wait.
src/modules/process/ui/ShipmentView.tsx:570:      syncRequestIds: uniqueSyncRequestIds,
src/modules/process/ui/ShipmentView.tsx:594:      return requestStatus.lastError ?? `sync_request_${requestStatus.syncRequestId}_failed`
src/modules/process/ui/ShipmentView.tsx:629:        console.error('Failed to refresh tracking data after sync:', err)
src/modules/process/ui/ShipmentView.tsx:662:  readonly syncNow: Date
src/modules/process/ui/ShipmentView.tsx:689:  readonly syncNow: Date
src/modules/process/ui/ShipmentView.tsx:701:        syncNow={props.syncNow}
src/modules/process/ui/ShipmentView.tsx:731:              syncNow={props.syncNow}
src/modules/process/ui/ShipmentView.tsx:860:              syncNow={props.syncNow}
src/modules/process/ui/ShipmentView.tsx:945:  const handleCreateSubmit = async (formData: CreateProcessDialogFormData) => {
src/modules/process/ui/ShipmentView.tsx:966:  const handleEditSubmit = async (formData: CreateProcessDialogFormData) => {
src/modules/process/ui/ShipmentView.tsx:1060:  const acknowledgeAlert = async (alertId: string) => {
src/modules/process/ui/ShipmentView.tsx:1082:  const unacknowledgeAlert = async (alertId: string) => {
src/modules/process/ui/ShipmentView.tsx:1136:  const syncNow = useSyncRealtimeCoordinator({
src/modules/process/ui/ShipmentView.tsx:1142:  const triggerRefresh = async () => {
src/modules/process/ui/ShipmentView.tsx:1277:      syncNow={syncNow()}
src/modules/process/ui/components/TimelineNode.tsx:72:async function copyAndOpenCarrierLink(
src/modules/process/ui/components/DashboardRefreshButton.tsx:101:      return t(keys.dashboard.actions.syncing)
src/modules/process/ui/components/DashboardRefreshButton.tsx:104:    return t(keys.dashboard.actions.sync)
src/modules/process/ui/components/DashboardRefreshButton.tsx:109:      return t(keys.dashboard.actions.syncFailed)
src/modules/process/ui/components/DashboardRefreshButton.tsx:112:      return t(keys.dashboard.actions.syncing)
src/modules/process/ui/components/DashboardRefreshButton.tsx:114:    return t(keys.dashboard.actions.sync)
src/modules/process/ui/components/DashboardRefreshButton.tsx:117:  const handleClick = async () => {
src/modules/process/ui/components/DashboardRefreshButton.tsx:134:      console.error('Dashboard sync failed:', error)
src/modules/process/ui/components/tests/process-sync-button.test.ts:5:  it('forces syncing while request is in progress regardless of server status', () => {
src/modules/process/ui/components/tests/process-sync-button.test.ts:12:    ).toBe('syncing')
src/modules/process/ui/api/processSync.api.ts:7:export async function syncAllProcessesRequest(): Promise<{
src/modules/process/ui/api/processSync.api.ts:9:  readonly syncedProcesses: number
src/modules/process/ui/api/processSync.api.ts:10:  readonly syncedContainers: number
src/modules/process/ui/api/processSync.api.ts:13:    '/api/processes/sync',
src/modules/process/ui/api/processSync.api.ts:21:export async function syncProcessRequest(processId: string): Promise<{
src/modules/process/ui/api/processSync.api.ts:24:  readonly syncedContainers: number
src/modules/process/ui/api/processSync.api.ts:27:    `/api/processes/${encodeURIComponent(processId)}/sync`,
src/modules/container/application/usecases/tests/find-containers-by-number.usecase.test.ts:21:    insert: vi.fn(async (_record: InsertContainerRecord): Promise<ContainerEntity> => {
src/modules/container/application/usecases/tests/find-containers-by-number.usecase.test.ts:24:    insertMany: vi.fn(async (_records: InsertContainerRecord[]): Promise<ContainerEntity[]> => {
src/modules/container/application/usecases/tests/find-containers-by-number.usecase.test.ts:27:    delete: vi.fn(async (_id: string): Promise<void> => {
src/modules/container/application/usecases/tests/find-containers-by-number.usecase.test.ts:30:    existsMany: vi.fn(async (_numbers: string[]): Promise<Map<string, boolean>> => {
src/modules/container/application/usecases/tests/find-containers-by-number.usecase.test.ts:33:    findByNumber: vi.fn(async (_containerNumber: string): Promise<ContainerEntity | null> => {
src/modules/container/application/usecases/tests/find-containers-by-number.usecase.test.ts:37:    listSearchProjections: vi.fn(async () => {
src/modules/container/application/usecases/tests/find-containers-by-number.usecase.test.ts:40:    listByProcessId: vi.fn(async (_processId: string): Promise<readonly ContainerEntity[]> => {
src/modules/container/application/usecases/tests/find-containers-by-number.usecase.test.ts:44:      async (
src/modules/container/application/usecases/tests/find-containers-by-number.usecase.test.ts:54:  it('keeps exact lookup behavior by normalizing numbers before repository search', async () => {
src/modules/container/application/usecases/tests/find-containers-by-number.usecase.test.ts:63:    const findByNumbers = vi.fn(async (numbers: string[]) => {
src/modules/process/application/usecases/update-process.usecase.ts:25:  return async function execute(command: UpdateProcessCommand): Promise<UpdateProcessResult> {
src/modules/process/ui/validation/tests/processApi.validation.test.ts:10:    async () =>
src/modules/process/ui/validation/tests/processApi.validation.test.ts:25:  it('uses the existing dashboard endpoint when sort params are omitted', async () => {
src/modules/process/ui/validation/tests/processApi.validation.test.ts:33:  it('serializes optional sort query params when both are provided', async () => {
src/modules/process/ui/validation/tests/processApi.validation.test.ts:44:  it('ignores incomplete sort query params', async () => {
src/modules/process/ui/validation/tests/processApi.validation.test.ts:58:  it('serializes optional filter query params', async () => {
src/modules/process/ui/validation/tests/processApi.validation.test.ts:76:  it('serializes sort and filters together when both are valid', async () => {
src/modules/process/ui/validation/tests/processApi.validation.test.ts:94:  it('ignores empty filter values and keeps existing endpoint behavior', async () => {
src/modules/process/ui/validation/tests/processApi.validation.test.ts:115:  it('sends acknowledge action with the expected payload', async () => {
src/modules/process/ui/validation/tests/processApi.validation.test.ts:117:      async () =>
src/modules/process/ui/validation/tests/processApi.validation.test.ts:133:  it('sends unacknowledge action with the expected payload', async () => {
src/modules/process/ui/validation/tests/processApi.validation.test.ts:135:      async () =>
src/modules/process/ui/utils/sync-realtime-coordinator.ts:7:} from '~/shared/api/sync-requests.realtime.client'
src/modules/process/ui/utils/sync-realtime-coordinator.ts:36:  const [syncNow, setSyncNow] = createSignal(new Date())
src/modules/process/ui/utils/sync-realtime-coordinator.ts:45:  const runAutoSyncRefresh = async () => {
src/modules/process/ui/utils/sync-realtime-coordinator.ts:58:      console.error('Auto sync refresh failed:', err)
src/modules/process/ui/utils/sync-realtime-coordinator.ts:167:      data?.containers.some((container) => container.sync.state === 'syncing') ?? false
src/modules/process/ui/utils/sync-realtime-coordinator.ts:199:  return syncNow
src/modules/process/ui/mappers/processList.ui-mapper.ts:34:  last_sync_status?: 'DONE' | 'FAILED' | 'RUNNING' | 'UNKNOWN'
src/modules/process/ui/mappers/processList.ui-mapper.ts:35:  last_sync_at?: string | null
src/modules/process/ui/mappers/processList.ui-mapper.ts:55:  status: ProcessListItemSource['last_sync_status'],
src/modules/process/ui/mappers/processList.ui-mapper.ts:56:): ProcessSummaryVM['syncStatus'] {
src/modules/process/ui/mappers/processList.ui-mapper.ts:58:  // After reload we only keep "syncing" when backend still reports active work.
src/modules/process/ui/mappers/processList.ui-mapper.ts:59:  if (status === 'RUNNING') return 'syncing'
src/modules/process/ui/mappers/processList.ui-mapper.ts:106:      syncStatus: toProcessSyncStatus(process.last_sync_status),
src/modules/process/ui/mappers/processList.ui-mapper.ts:107:      lastSyncAt: process.last_sync_at ?? null,
src/modules/process/ui/viewmodels/shipment.vm.ts:43:export type ContainerSyncState = 'syncing' | 'ok' | 'error' | 'never'
src/modules/process/ui/viewmodels/shipment.vm.ts:59:  readonly sync: ContainerSyncVM
src/modules/process/application/usecases/find-process-by-id.usecase.ts:13:  return async function execute(command: FindProcessByIdCommand): Promise<FindProcessByIdResult> {
src/modules/process/ui/components/ProcessSyncButton.tsx:24:  // 1. Local submitting -> syncing
src/modules/process/ui/components/ProcessSyncButton.tsx:25:  // 2. Server-reported syncing -> syncing
src/modules/process/ui/components/ProcessSyncButton.tsx:28:  if (command.isSubmitting) return 'syncing'
src/modules/process/ui/components/ProcessSyncButton.tsx:41:  if (status === 'syncing') return t(keys.dashboard.table.sync.syncing)
src/modules/process/ui/components/ProcessSyncButton.tsx:42:  if (status === 'success') return t(keys.dashboard.table.sync.success)
src/modules/process/ui/components/ProcessSyncButton.tsx:43:  if (status === 'error') return t(keys.dashboard.table.sync.error)
src/modules/process/ui/components/ProcessSyncButton.tsx:44:  return t(keys.dashboard.table.sync.idle)
src/modules/process/ui/components/ProcessSyncButton.tsx:51:  if (status === 'syncing') return `${base} border-blue-200 bg-blue-50 text-blue-700`
src/modules/process/ui/components/ProcessSyncButton.tsx:60:      <Match when={props.status === 'syncing'}>
src/modules/process/ui/components/ProcessSyncButton.tsx:135:    return t(keys.dashboard.table.sync.lastSyncAt, {
src/modules/process/ui/components/ProcessSyncButton.tsx:141:  const isBlocked = createMemo(() => isSubmitting() || visualStatus() === 'syncing')
src/modules/process/ui/components/ProcessSyncButton.tsx:143:  const handleClick = async (): Promise<void> => {
src/modules/process/ui/components/ProcessSyncButton.tsx:155:      console.error(`Process sync failed for ${props.processId}:`, error)
src/modules/process/ui/components/ProcessSyncButton.tsx:170:      aria-busy={visualStatus() === 'syncing'}
src/modules/process/application/usecases/remove-container-from-process.usecase.ts:17:  return async function execute(
src/modules/process/ui/components/ShipmentHeader.tsx:17:  syncNow: Date
src/modules/process/ui/components/ShipmentHeader.tsx:272:  const syncEntries = createMemo(() =>
src/modules/process/ui/components/ShipmentHeader.tsx:278:  const syncHeaderPrefix = createMemo(() =>
src/modules/process/ui/components/ShipmentHeader.tsx:279:    resolveProcessSyncHeaderMode(syncEntries()) === 'syncing'
src/modules/process/ui/components/ShipmentHeader.tsx:280:      ? t(keys.shipmentView.sync.headerSyncingPrefix)
src/modules/process/ui/components/ShipmentHeader.tsx:281:      : t(keys.shipmentView.sync.headerUpdatedPrefix),
src/modules/process/ui/components/ShipmentHeader.tsx:284:  const toSyncEntryLabel = (entry: ReturnType<typeof syncEntries>[number]): string => {
src/modules/process/ui/components/ShipmentHeader.tsx:289:    const syncLabel = toContainerSyncLabel(
src/modules/process/ui/components/ShipmentHeader.tsx:290:      entry.sync,
src/modules/process/ui/components/ShipmentHeader.tsx:292:        syncing: t(keys.shipmentView.sync.syncing),
src/modules/process/ui/components/ShipmentHeader.tsx:293:        never: t(keys.shipmentView.sync.never),
src/modules/process/ui/components/ShipmentHeader.tsx:294:        updatedUnknownTime: t(keys.shipmentView.sync.updatedUnknownTime),
src/modules/process/ui/components/ShipmentHeader.tsx:295:        failedUnknownTime: t(keys.shipmentView.sync.failedUnknownTime),
src/modules/process/ui/components/ShipmentHeader.tsx:296:        updated: (relative: string) => t(keys.shipmentView.sync.updated, { relative }),
src/modules/process/ui/components/ShipmentHeader.tsx:297:        failed: (relative: string) => t(keys.shipmentView.sync.failed, { relative }),
src/modules/process/ui/components/ShipmentHeader.tsx:300:        now: props.syncNow,
src/modules/process/ui/components/ShipmentHeader.tsx:305:    return `${containerLabel} ${syncLabel}`
src/modules/process/ui/components/ShipmentHeader.tsx:382:      <Show when={syncEntries().length > 0}>
src/modules/process/ui/components/ShipmentHeader.tsx:384:          <span data-testid="process-sync-prefix" class="font-medium text-slate-400">
src/modules/process/ui/components/ShipmentHeader.tsx:385:            {syncHeaderPrefix()}
src/modules/process/ui/components/ShipmentHeader.tsx:387:          <For each={syncEntries()}>
src/modules/process/ui/components/ShipmentHeader.tsx:390:                <span data-testid={`process-sync-item-${entry.containerNumber}`}>
src/modules/process/ui/components/ShipmentHeader.tsx:393:                <SyncSeparator visible={index() < syncEntries().length - 1} />
src/modules/process/application/usecases/sync-all-processes.usecase.ts:12:  readonly syncRequestId: string
src/modules/process/application/usecases/sync-all-processes.usecase.ts:20:  readonly syncedProcesses: number
src/modules/process/application/usecases/sync-all-processes.usecase.ts:21:  readonly syncedContainers: number
src/modules/process/application/usecases/sync-all-processes.usecase.ts:40:    readonly syncRequestIds: readonly string[]
src/modules/process/application/usecases/sync-all-processes.usecase.ts:84:async function defaultSleep(delayMs: number): Promise<void> {
src/modules/process/application/usecases/sync-all-processes.usecase.ts:91:  syncRequestIds: readonly string[],
src/modules/process/application/usecases/sync-all-processes.usecase.ts:94:  const byId = new Map(requests.map((request) => [request.syncRequestId, request]))
src/modules/process/application/usecases/sync-all-processes.usecase.ts:96:  return syncRequestIds.map((syncRequestId) => {
src/modules/process/application/usecases/sync-all-processes.usecase.ts:97:    const request = byId.get(syncRequestId)
src/modules/process/application/usecases/sync-all-processes.usecase.ts:101:      syncRequestId,
src/modules/process/application/usecases/sync-all-processes.usecase.ts:103:      lastError: 'sync_request_not_found',
src/modules/process/application/usecases/sync-all-processes.usecase.ts:110:async function waitForTerminalStatuses(command: {
src/modules/process/application/usecases/sync-all-processes.usecase.ts:111:  readonly syncRequestIds: readonly string[]
src/modules/process/application/usecases/sync-all-processes.usecase.ts:123:      syncRequestIds: command.syncRequestIds,
src/modules/process/application/usecases/sync-all-processes.usecase.ts:126:    const requests = toTerminalStatusItems(command.syncRequestIds, response.requests)
src/modules/process/application/usecases/sync-all-processes.usecase.ts:147:  throw new HttpError('sync_global_timeout', 504)
src/modules/process/application/usecases/sync-all-processes.usecase.ts:156:  return async function execute(): Promise<SyncAllProcessesResult> {
src/modules/process/application/usecases/sync-all-processes.usecase.ts:159:      return { syncedProcesses: 0, syncedContainers: 0 }
src/modules/process/application/usecases/sync-all-processes.usecase.ts:163:    const syncTargets: SyncTarget[] = []
src/modules/process/application/usecases/sync-all-processes.usecase.ts:173:            `unsupported_sync_provider_for_container:${containerNumber}:${carrierCode}`,
src/modules/process/application/usecases/sync-all-processes.usecase.ts:180:          throw new HttpError('invalid_container_number_for_sync', 422)
src/modules/process/application/usecases/sync-all-processes.usecase.ts:183:        syncTargets.push({
src/modules/process/application/usecases/sync-all-processes.usecase.ts:191:    if (syncTargets.length === 0) {
src/modules/process/application/usecases/sync-all-processes.usecase.ts:192:      return { syncedProcesses: 0, syncedContainers: 0 }
src/modules/process/application/usecases/sync-all-processes.usecase.ts:196:      syncTargets.map((target) =>
src/modules/process/application/usecases/sync-all-processes.usecase.ts:204:    const syncRequestIds = Array.from(new Set(enqueueResults.map((result) => result.id)))
src/modules/process/application/usecases/sync-all-processes.usecase.ts:206:      syncRequestIds,
src/modules/process/application/usecases/sync-all-processes.usecase.ts:222:        `${firstFailure.status.toLowerCase()}_${firstFailure.syncRequestId}`
src/modules/process/application/usecases/sync-all-processes.usecase.ts:223:      throw new HttpError(`sync_global_failed:${firstError}`, 502)
src/modules/process/application/usecases/sync-all-processes.usecase.ts:226:    const syncedProcesses = new Set(syncTargets.map((target) => target.processId)).size
src/modules/process/application/usecases/sync-all-processes.usecase.ts:227:    const syncedContainers = syncTargets.length
src/modules/process/application/usecases/sync-all-processes.usecase.ts:230:      syncedProcesses,
src/modules/process/application/usecases/sync-all-processes.usecase.ts:231:      syncedContainers,
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:38:    syncStatus: 'idle',
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:61:  readonly sync: ProcessSyncSummaryReadModel
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:87:function toContainerSyncStatus(sync: ContainerSyncMetadata): ProcessLastSyncStatus {
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:88:  if (sync.isSyncing) return 'RUNNING'
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:90:  const lastSuccessAtMs = toTimestampOrNegativeInfinity(sync.lastSuccessAt)
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:91:  const lastErrorAtMs = toTimestampOrNegativeInfinity(sync.lastErrorAt)
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:98:function toContainerLastSyncAt(sync: ContainerSyncMetadata): string | null {
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:100:  latest = pickMostRecentTimestamp(latest, sync.lastAttemptAt)
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:101:  latest = pickMostRecentTimestamp(latest, sync.lastSuccessAt)
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:102:  latest = pickMostRecentTimestamp(latest, sync.lastErrorAt)
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:118:  readonly syncByContainerNumber: ReadonlyMap<string, ContainerSyncMetadata>
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:132:    const sync =
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:133:      command.syncByContainerNumber.get(normalizedContainerNumber) ??
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:136:    statuses.push(toContainerSyncStatus(sync))
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:137:    lastSyncAt = pickMostRecentTimestamp(lastSyncAt, toContainerLastSyncAt(sync))
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:167:async function listSyncMetadataByContainerNumber(command: {
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:190:    console.error('Failed to get process sync metadata for dashboard list:', error)
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:285:  return async function execute(): Promise<ListProcessesWithOperationalSummaryResult> {
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:296:    const syncByContainerNumber = await listSyncMetadataByContainerNumber({
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:305:      allProcesses.map(async (process) => {
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:311:          containers.map(async (c) => {
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:341:        const sync = deriveProcessSyncSummary({
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:343:          syncByContainerNumber,
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:346:        return { pwc, summary, sync }
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:5:  it('runs sync before refetches and resolves when all requests succeed', async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:7:    const syncAllProcesses = vi.fn(async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:8:      sequence.push('sync')
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:11:    const refetchProcesses = vi.fn(async () => [])
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:12:    const refetchGlobalAlerts = vi.fn(async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:17:    refetchProcesses.mockImplementation(async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:24:        syncAllProcesses,
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:30:    expect(syncAllProcesses).toHaveBeenCalledTimes(1)
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:33:    expect(sequence[0]).toBe('sync')
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:38:  it('rejects when sync fails and does not execute refetches', async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:39:    const syncAllProcesses = vi.fn(async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:40:      throw new Error('sync failed')
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:42:    const refetchProcesses = vi.fn(async () => [])
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:43:    const refetchGlobalAlerts = vi.fn(async () => ({ totalActiveAlerts: 0 }))
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:47:        syncAllProcesses,
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:51:    ).rejects.toThrow('sync failed')
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:53:    expect(syncAllProcesses).toHaveBeenCalledTimes(1)
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:58:  it('rejects when one refetch fails after a successful sync', async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:59:    const syncAllProcesses = vi.fn(async () => ({ ok: true }))
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:60:    const refetchProcesses = vi.fn(async () => [])
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:61:    const refetchGlobalAlerts = vi.fn(async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:67:        syncAllProcesses,
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:73:    expect(syncAllProcesses).toHaveBeenCalledTimes(1)
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:78:  it('rejects when both refetches fail after a successful sync', async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:79:    const syncAllProcesses = vi.fn(async () => ({ ok: true }))
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:80:    const refetchProcesses = vi.fn(async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:83:    const refetchGlobalAlerts = vi.fn(async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:89:        syncAllProcesses,
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:95:    expect(syncAllProcesses).toHaveBeenCalledTimes(1)
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:148:  const syncByContainerNumber = new Map(
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:174:    const sync =
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:175:      syncByContainerNumber.get(normalizeContainerNumber(container.container_number)) ??
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:184:      sync,
src/modules/process/application/usecases/search-processes-by-text.usecase.ts:31:  return async function searchByText(
src/modules/process/application/usecases/find-process-by-id-with-containers.usecase.ts:17:  return async function execute(
src/modules/process/application/usecases/list-processes.usecase.ts:9:  return async function execute(): Promise<ListProcessesResult> {
src/modules/process/ui/viewmodels/tests/dashboard-filter-interaction.vm.test.ts:42:    syncStatus: 'idle',
src/modules/process/ui/utils/refresh-sync-polling.ts:4:  readonly syncRequestId: string
src/modules/process/ui/utils/refresh-sync-polling.ts:23:  readonly syncRequestIds: readonly string[]
src/modules/process/ui/utils/refresh-sync-polling.ts:27:    syncRequestIds: readonly string[],
src/modules/process/ui/utils/refresh-sync-polling.ts:73:async function defaultSleep(delayMs: number): Promise<void> {
src/modules/process/ui/utils/refresh-sync-polling.ts:79:export async function pollRefreshSyncStatus(
src/modules/process/ui/utils/refresh-sync-polling.ts:99:    lastResponse = await command.fetchSyncStatus(command.syncRequestIds)
src/modules/process/application/usecases/list-processes-with-containers.usecase.ts:13:  return async function execute(): Promise<ListProcessesWithContainersResult> {
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:5:} from '~/modules/process/application/usecases/sync-process-containers.usecase'
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:19:  const sleep = vi.fn(async (delayMs: number) => {
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:25:    async (command: { readonly containerNumber: string }) => ({
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:26:      id: `sync-${command.containerNumber}`,
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:33:    async (command: { readonly syncRequestIds: readonly string[] }) => ({
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:35:      requests: command.syncRequestIds.map((syncRequestId) => ({
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:36:        syncRequestId,
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:44:    fetchProcessById: async () => ({ id: 'process-1' }),
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:45:    listContainersByProcessId: async () => ({
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:65:describe('sync-process-containers.usecase', () => {
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:66:  it('syncs only containers from the requested process and returns synced container count', async () => {
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:67:    const listContainersByProcessId = vi.fn(async () => ({
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:75:      fetchProcessById: async (command) => ({ id: command.processId }),
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:84:      syncedContainers: 2,
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:100:  it('fails with 422 when process container provider is unsupported', async () => {
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:102:      listContainersByProcessId: async () => ({
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:121:  it('fails with 504 when process sync requests do not reach terminal state before timeout', async () => {
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:122:    const getSyncRequestStatusesMock = vi.fn(async () => ({
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:126:          syncRequestId: 'sync-MSCU1234567',
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:134:      listContainersByProcessId: async () => ({
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:156:  it('fails with 502 when process sync reaches FAILED status', async () => {
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:158:      getSyncRequestStatuses: vi.fn(async () => ({
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:162:            syncRequestId: 'sync-MSCU1234567',
src/modules/process/application/usecases/tests/sync-process-containers.usecase.test.ts:168:      listContainersByProcessId: async () => ({
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:52:    syncStatus: 'idle',
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:60:    expect(result.containers[0].sync.state).toBe('never')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:116:  it('maps container sync metadata by normalized container number', () => {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:118:      id: 'proc-sync',
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:128:          id: 'c-sync',
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:150:    expect(result.containers[0].sync.state).toBe('error')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:151:    expect(result.containers[0].sync.carrier).toBe('maersk')
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:7:describe('process header sync ordering', () => {
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:8:  it('orders syncing > error > stale > ok > never', () => {
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:13:        sync: {
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:24:        sync: {
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:35:        sync: {
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:46:        sync: {
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:49:          state: 'syncing',
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:57:        sync: {
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:76:  it('uses syncing prefix when at least one container is syncing', () => {
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:81:        sync: {
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:84:          state: 'syncing',
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:91:    expect(mode).toBe('syncing')
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:94:  it('uses updated prefix when none is syncing', () => {
src/modules/process/ui/mappers/tests/process-header-sync.test.ts:99:        sync: {
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:6:} from '~/modules/process/ui/utils/refresh-sync-polling'
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:8:describe('refresh-sync-polling', () => {
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:17:  it('stops on first retry when all requests are DONE', async () => {
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:18:    const sleep = vi.fn(async () => undefined)
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:20:    const fetchSyncStatus = vi.fn(async () => ({
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:25:          syncRequestId: 'e567dadb-b3ad-4f10-9f3f-d37f8f3163fc',
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:35:      syncRequestIds: ['e567dadb-b3ad-4f10-9f3f-d37f8f3163fc'],
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:52:  it('retries while any request is PENDING/LEASED and finishes when terminal', async () => {
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:53:    const sleep = vi.fn(async () => undefined)
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:61:            syncRequestId: '84f54d33-cfb8-421f-8be5-533da5f0e127',
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:74:            syncRequestId: '84f54d33-cfb8-421f-8be5-533da5f0e127',
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:87:            syncRequestId: '84f54d33-cfb8-421f-8be5-533da5f0e127',
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:97:      syncRequestIds: ['84f54d33-cfb8-421f-8be5-533da5f0e127'],
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:112:  it('returns timeout when max retries are exhausted', async () => {
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:113:    const sleep = vi.fn(async () => undefined)
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:114:    const fetchSyncStatus = vi.fn(async () => ({
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:119:          syncRequestId: '954b82bc-06f6-4772-84b4-6f6a2c5e3397',
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:129:      syncRequestIds: ['954b82bc-06f6-4772-84b4-6f6a2c5e3397'],
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:146:  it('treats FAILED and NOT_FOUND as terminal statuses', async () => {
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:153:    const fetchSyncStatus = vi.fn(async () => ({
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:158:          syncRequestId: '37cca430-0ace-42f8-a333-c8b1ca369967',
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:165:          syncRequestId: 'f64e9f2d-c996-4f1f-950f-ee813ba22b30',
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:167:          lastError: 'sync_request_not_found',
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:175:      syncRequestIds: [
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:182:      sleep: async () => undefined,
src/modules/process/application/usecases/tests/search-processes-by-text.usecase.test.ts:44:    fetchAll: vi.fn(async () => processes),
src/modules/process/application/usecases/tests/search-processes-by-text.usecase.test.ts:45:    fetchById: vi.fn(async (_processId: string) => null),
src/modules/process/application/usecases/tests/search-processes-by-text.usecase.test.ts:46:    create: vi.fn(async (_record: InsertProcessRecord) => {
src/modules/process/application/usecases/tests/search-processes-by-text.usecase.test.ts:49:    update: vi.fn(async (_processId: string, _record: UpdateProcessRecord) => {
src/modules/process/application/usecases/tests/search-processes-by-text.usecase.test.ts:52:    delete: vi.fn(async (_processId: string) => {
src/modules/process/application/usecases/tests/search-processes-by-text.usecase.test.ts:59:  it('returns a process on exact reference match', async () => {
src/modules/process/application/usecases/tests/search-processes-by-text.usecase.test.ts:90:  it('supports case-insensitive partial matching on reference, importer, BL and carrier', async () => {
src/modules/process/application/usecases/tests/search-processes-by-text.usecase.test.ts:111:  it('respects the provided result limit after matching', async () => {
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:17:  readonly sync: ContainerSyncVM
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:21:  readonly syncing: string
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:39:  if (dto.isSyncing) return 'syncing'
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:62:function toSyncPriority(sync: ContainerSyncVM): number {
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:63:  if (sync.state === 'syncing') return 0
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:64:  if (sync.state === 'error') return 1
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:65:  if (sync.state === 'ok' && sync.isStale) return 2
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:66:  if (sync.state === 'ok') return 3
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:108:    const priorityDelta = toSyncPriority(a.sync) - toSyncPriority(b.sync)
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:116:): 'syncing' | 'updated' {
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:117:  return entries.some((entry) => entry.sync.state === 'syncing') ? 'syncing' : 'updated'
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:121:  sync: ContainerSyncVM,
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:128:  if (sync.state === 'syncing') return messages.syncing
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:129:  if (sync.state === 'never') return messages.never
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:131:  const relativeTimeLabel = sync.relativeTimeAt
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:133:        sync.relativeTimeAt,
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:140:  if (sync.state === 'error') {
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:148:  readonly containers: readonly Pick<ContainerDetailVM, 'number' | 'carrierCode' | 'sync'>[]
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:154:      carrier: container.sync.carrier ?? container.carrierCode ?? command.processCarrier ?? null,
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:155:      sync: container.sync,
src/modules/process/application/usecases/delete-process.usecase.ts:12:  return async function execute(command: DeleteProcessCommand): Promise<DeleteProcessResult> {
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:46:    expect(result[0].syncStatus).toBe('idle')
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:66:        last_sync_status: 'DONE',
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:67:        last_sync_at: '2025-05-01T11:00:00Z',
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:81:    expect(result[0].syncStatus).toBe('idle')
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:96:    expect(result[0].syncStatus).toBe('idle')
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:100:  it('maps sync metadata to dashboard sync visual states', () => {
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:103:        id: 'p-sync-running',
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:104:        last_sync_status: 'RUNNING',
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:105:        last_sync_at: '2026-03-05T10:00:00.000Z',
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:107:      makeSource({ id: 'p-sync-failed', last_sync_status: 'FAILED' }),
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:108:      makeSource({ id: 'p-sync-unknown', last_sync_status: 'UNKNOWN' }),
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:111:    expect(result[0].syncStatus).toBe('syncing')
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:113:    expect(result[1].syncStatus).toBe('idle')
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:114:    expect(result[2].syncStatus).toBe('idle')
src/modules/process/application/usecases/create-process.usecase.ts:29:  return async function execute(command: CreateProcessCommand): Promise<CreateProcessResult> {
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:5:} from '~/modules/process/application/usecases/sync-all-processes.usecase'
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:22:  const sleep = vi.fn(async (delayMs: number) => {
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:26:    async (command: { readonly containerNumber: string }) => ({
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:27:      id: `sync-${command.containerNumber}`,
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:33:    async (command: { readonly syncRequestIds: readonly string[] }) => ({
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:35:      requests: command.syncRequestIds.map((syncRequestId) => ({
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:36:        syncRequestId,
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:46:    listActiveProcessIds: async () => [],
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:47:    listContainersByProcessIds: async () => ({ containersByProcessId: new Map() }),
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:64:describe('sync-all-processes.usecase', () => {
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:65:  it('returns synced process and container counters when all sync requests finish as DONE', async () => {
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:71:            syncRequestId: 'sync-MSCU1234567',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:78:            syncRequestId: 'sync-MRKU7654321',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:90:            syncRequestId: 'sync-MSCU1234567',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:97:            syncRequestId: 'sync-MRKU7654321',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:108:      async () => statusesByCall.shift() ?? statusesByCall[0],
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:112:      listActiveProcessIds: async () => ['process-a', 'process-b'],
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:113:      listContainersByProcessIds: async () => ({
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:146:      syncedProcesses: 2,
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:147:      syncedContainers: 2,
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:152:  it('fails with 422 when a container carrier is not supported for global sync', async () => {
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:154:      listActiveProcessIds: async () => ['process-a'],
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:155:      listContainersByProcessIds: async () => ({
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:186:  it('fails with 504 when sync requests do not reach terminal state before timeout', async () => {
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:187:    const getSyncRequestStatusesMock = vi.fn(async () => ({
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:191:          syncRequestId: 'sync-MSCU1234567',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:201:      listActiveProcessIds: async () => ['process-a'],
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:202:      listContainersByProcessIds: async () => ({
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:236:  it('resets timeout window when there is DONE progress and times out only after idle period', async () => {
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:242:            syncRequestId: 'sync-MSCU1234567',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:249:            syncRequestId: 'sync-MRKU7654321',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:261:            syncRequestId: 'sync-MSCU1234567',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:268:            syncRequestId: 'sync-MRKU7654321',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:280:            syncRequestId: 'sync-MSCU1234567',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:287:            syncRequestId: 'sync-MRKU7654321',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:299:            syncRequestId: 'sync-MSCU1234567',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:306:            syncRequestId: 'sync-MRKU7654321',
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:317:      async () => statusesByCall.shift() ?? statusesByCall[statusesByCall.length - 1],
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:321:      listActiveProcessIds: async () => ['process-a', 'process-b'],
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:322:      listContainersByProcessIds: async () => ({
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:367:  it('fails with 502 when any sync request reaches FAILED or NOT_FOUND', async () => {
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:369:      listActiveProcessIds: async () => ['process-a'],
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:370:      listContainersByProcessIds: async () => ({
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:385:      getSyncRequestStatuses: vi.fn(async () => ({
src/modules/process/application/usecases/tests/sync-all-processes.usecase.test.ts:389:            syncRequestId: 'sync-MSCU1234567',
src/modules/process/ui/mappers/tests/container-chip-sync-state.test.ts:11:  syncing: 'syncing…',
src/modules/process/ui/mappers/tests/container-chip-sync-state.test.ts:12:  never: 'never synced',
src/modules/process/ui/mappers/tests/container-chip-sync-state.test.ts:32:describe('container sync state mapping', () => {
src/modules/process/ui/mappers/tests/container-chip-sync-state.test.ts:33:  it('maps syncing when isSyncing=true', () => {
src/modules/process/ui/mappers/tests/container-chip-sync-state.test.ts:43:    expect(vm.state).toBe('syncing')
src/modules/process/ui/mappers/tests/container-chip-sync-state.test.ts:44:    expect(toContainerSyncLabel(vm, labelMessages)).toBe('syncing…')
src/modules/process/ui/mappers/tests/container-chip-sync-state.test.ts:90:    expect(toContainerSyncLabel(vm, labelMessages)).toBe('never synced')

```



# Search: refresh occurrences

Command executed:
```bash
rg -n "refresh" src
```

Output:
```

src/entry-server.tsx:1:// @refresh reload
src/entry-client.tsx:1:// @refresh reload
src/entry-client.tsx:45:          // Delegated handler for refresh buttons (works even if Solid onClick isn't attached)
src/entry-client.tsx:46:          const candidate = t?.closest?.('button.refresh-button') ?? null
src/entry-client.tsx:57:            console.debug('entry-client: delegated refresh click for', container)
src/entry-client.tsx:59:              alert(`delegated handler: refreshing ${container}...`) // i18n-enforce-ignore — diagnostic debug handler (see issue #30)
src/entry-client.tsx:65:            fetch('/api/refresh', {
src/entry-client.tsx:75:                  console.error('entry-client: failed to parse refresh response JSON', e)
src/entry-client.tsx:81:                    console.error('entry-client: failed to show refresh success alert', err)
src/entry-client.tsx:87:                    console.error('entry-client: failed to show refresh failure alert', err)
src/entry-client.tsx:92:                console.error('delegated refresh error', err)
src/entry-client.tsx:96:                  console.error('entry-client: failed to show refresh error alert', e)
src/locales/pt-PT.json:224:      "refresh": "Atualizar",
src/locales/pt-PT.json:324:    "refreshSyncing": "a sincronizar...",
src/locales/pt-PT.json:325:    "refreshRecentlyUpdatedSeconds": "Já atualizado há {{count}}s",
src/locales/pt-PT.json:326:    "refreshRecentlyUpdatedMinutes": "Já atualizado há {{count}} min",
src/locales/pt-PT.json:327:    "refreshRetry": "tentativa {{current}}/{{total}}",
src/locales/pt-PT.json:328:    "refreshSyncTimeout": "A sincronização do refresh continua pendente após {{total}} tentativas. Tente novamente em instantes.",
src/locales/pt-PT.json:329:    "refreshSyncFailed": "Refresh concluído com {{failedCount}} pedido(s) com falha. Primeiro erro: {{firstError}}",
src/locales/pt-PT.json:340:    "refreshCarrierUnknownTitle": "Não é possível atualizar — armador desconhecido",
src/locales/pt-PT.json:341:    "refreshCarrierUnknownMessage": "Esta expedição não tem um armador selecionado, por isso não é possível executar um refresh automático. Pode editar o processo e escolher o armador correto para habilitar o refresh.",
src/locales/pt-PT.json:342:    "refreshCarrierUnknownEditCTA": "Editar processo",
src/locales/pt-PT.json:343:    "refreshCarrierUnknownCancelCTA": "Cancelar"
src/locales/pt-BR.json:224:      "refresh": "Atualizar",
src/locales/pt-BR.json:324:    "refreshSyncing": "sincronizando...",
src/locales/pt-BR.json:325:    "refreshRecentlyUpdatedSeconds": "Já atualizado há {{count}}s",
src/locales/pt-BR.json:326:    "refreshRecentlyUpdatedMinutes": "Já atualizado há {{count}} min",
src/locales/pt-BR.json:327:    "refreshRetry": "tentativa {{current}}/{{total}}",
src/locales/pt-BR.json:328:    "refreshSyncTimeout": "A sincronização do refresh ainda está pendente após {{total}} tentativas. Tente novamente em instantes.",
src/locales/pt-BR.json:329:    "refreshSyncFailed": "Refresh concluído com {{failedCount}} requisição(ões) com falha. Primeiro erro: {{firstError}}",
src/locales/pt-BR.json:340:    "refreshCarrierUnknownTitle": "Não é possível atualizar — armador desconhecido",
src/locales/pt-BR.json:341:    "refreshCarrierUnknownMessage": "Este processo não tem um armador selecionado, portanto não é possível executar um refresh automático. Você pode editar o processo e escolher o armador correto para habilitar o refresh.",
src/locales/pt-BR.json:342:    "refreshCarrierUnknownEditCTA": "Editar processo",
src/locales/pt-BR.json:343:    "refreshCarrierUnknownCancelCTA": "Cancelar"
src/locales/en-US.json:213:      "refresh": "Refresh",
src/locales/en-US.json:313:    "refreshSyncing": "syncing...",
src/locales/en-US.json:314:    "refreshRecentlyUpdatedSeconds": "Already updated {{count}}s ago",
src/locales/en-US.json:315:    "refreshRecentlyUpdatedMinutes": "Already updated {{count}} min ago",
src/locales/en-US.json:316:    "refreshRetry": "retry {{current}}/{{total}}",
src/locales/en-US.json:317:    "refreshSyncTimeout": "Refresh sync is still pending after {{total}} retries. Try again shortly.",
src/locales/en-US.json:318:    "refreshSyncFailed": "Refresh finished with {{failedCount}} failed request(s). First error: {{firstError}}",
src/locales/en-US.json:329:    "refreshCarrierUnknownTitle": "Cannot refresh — unknown carrier",
src/locales/en-US.json:330:    "refreshCarrierUnknownMessage": "This shipment has no carrier selected, so an automatic refresh cannot be performed. You can edit the process and choose the correct carrier to enable refresh.",
src/locales/en-US.json:331:    "refreshCarrierUnknownEditCTA": "Edit process",
src/locales/en-US.json:332:    "refreshCarrierUnknownCancelCTA": "Cancel"
src/modules/tracking/interface/http/refresh.controllers.ts:4:} from '~/modules/tracking/application/usecases/refresh-rest-container.usecase'
src/modules/tracking/interface/http/refresh.controllers.ts:5:import { RefreshSchemas } from '~/modules/tracking/interface/http/refresh.schemas'
src/modules/tracking/interface/http/refresh.controllers.ts:25:  readonly refreshRestUseCase: RefreshRestUseCase
src/modules/tracking/interface/http/refresh.controllers.ts:59:  async function refresh({ request }: { request: Request }): Promise<Response> {
src/modules/tracking/interface/http/refresh.controllers.ts:61:      const body = await parseBody(request, RefreshSchemas.refreshRequest)
src/modules/tracking/interface/http/refresh.controllers.ts:62:      const result = await deps.refreshRestUseCase({
src/modules/tracking/interface/http/refresh.controllers.ts:79:      const parsedQuery = RefreshSchemas.refreshStatusQuery.safeParse({
src/modules/tracking/interface/http/refresh.controllers.ts:115:    refresh,
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:7:} from '~/modules/tracking/application/usecases/refresh-rest-container.usecase'
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:11:} from '~/modules/tracking/interface/http/refresh.controllers'
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:37:  readonly refreshRestDeps: RefreshRestContainerDeps
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:43:  const refreshRestDeps: RefreshRestContainerDeps = overrides.refreshRestDeps ?? {
src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:73:    refreshRestUseCase: createRefreshRestContainerUseCase(refreshRestDeps),
src/shared/api/respondWithSchema.ts:20:    console.error('refresh: response validation failed', parsed.error)
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:3:import { createRefreshControllers } from '~/modules/tracking/interface/http/refresh.controllers'
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:4:import { RefreshSchemas } from '~/modules/tracking/interface/http/refresh.schemas'
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:6:describe('refresh controllers', () => {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:8:    const refreshRestUseCase = vi.fn(async () => ({
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:17:      refreshRestUseCase,
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:21:    const request = new Request('http://localhost/api/refresh', {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:27:    const response = await controllers.refresh({ request })
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:36:    expect(refreshRestUseCase).toHaveBeenCalledTimes(1)
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:37:    expect(refreshRestUseCase).toHaveBeenCalledWith({
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:44:    const refreshRestUseCase = vi.fn(async () => ({
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:53:      refreshRestUseCase,
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:57:    const request = new Request('http://localhost/api/refresh', {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:63:    const response = await controllers.refresh({ request })
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:72:      refreshRestUseCase: vi.fn(async () => ({
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:79:    const request = new Request('http://localhost/api/refresh', {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:85:    const response = await controllers.refresh({ request })
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:92:  it('returns 400 for invalid refresh payload', async () => {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:94:      refreshRestUseCase: vi.fn(),
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:98:    const request = new Request('http://localhost/api/refresh', {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:104:    const response = await controllers.refresh({ request })
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:111:  it('returns 400 for invalid refresh status query', async () => {
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:113:      refreshRestUseCase: vi.fn(),
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:117:    const request = new Request('http://localhost/api/refresh/status')
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:141:      refreshRestUseCase: vi.fn(),
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:146:      'http://localhost/api/refresh/status?sync_request_id=e567dadb-b3ad-4f10-9f3f-d37f8f3163fc',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:162:      refreshRestUseCase: vi.fn(),
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:185:      'http://localhost/api/refresh/status?sync_request_id=377b29fd-97b6-4f9c-ad6e-66de6a66b565&sync_request_id=2999c8fb-1db8-4a48-bce2-b8fcf9f8908f',
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:199:      refreshRestUseCase: vi.fn(),
src/modules/tracking/interface/http/tests/refresh.controllers.test.ts:215:      'http://localhost/api/refresh/status?sync_request_id=ec4536a8-9650-43d8-b68d-930f8a8bfe50',
src/routes/api/refresh.ts:2: * Refresh API route - thin adapter to tracking refresh controllers.
src/routes/api/refresh.ts:4: * POST /api/refresh
src/routes/api/refresh.ts:5: * GET  /api/refresh (health)
src/routes/api/refresh.ts:8:import { bootstrapRefreshControllers } from '~/modules/tracking/interface/http/refresh.controllers.bootstrap'
src/routes/api/refresh.ts:12:const refreshControllers = bootstrapRefreshControllers()
src/routes/api/refresh.ts:14:export const POST = refreshControllers.refresh
src/routes/api/refresh.ts:15:export const GET = refreshControllers.health
src/modules/tracking/interface/http/refresh.schemas.ts:55:  refreshRequest: RefreshRequestSchema,
src/modules/tracking/interface/http/refresh.schemas.ts:56:  refreshStatusQuery: RefreshStatusQuerySchema,
src/routes/api/tests/refresh.route.test.ts:4:  refresh: vi.fn(),
src/routes/api/tests/refresh.route.test.ts:9:vi.mock('~/modules/tracking/interface/http/refresh.controllers.bootstrap', () => ({
src/routes/api/tests/refresh.route.test.ts:11:    refresh: trackingHandlers.refresh,
src/routes/api/tests/refresh.route.test.ts:17:import { GET as refreshGet, POST as refreshPost } from '~/routes/api/refresh'
src/routes/api/tests/refresh.route.test.ts:18:import { GET as refreshStatusGet } from '~/routes/api/refresh/status'
src/routes/api/tests/refresh.route.test.ts:20:  GET as refreshMaerskGet,
src/routes/api/tests/refresh.route.test.ts:21:  POST as refreshMaerskPost,
src/routes/api/tests/refresh.route.test.ts:22:} from '~/routes/api/refresh-maersk/[container]'
src/routes/api/tests/refresh.route.test.ts:24:describe('refresh routes', () => {
src/routes/api/tests/refresh.route.test.ts:25:  it('binds /api/refresh to refresh controllers', () => {
src/routes/api/tests/refresh.route.test.ts:26:    expect(refreshPost).toBe(trackingHandlers.refresh)
src/routes/api/tests/refresh.route.test.ts:27:    expect(refreshGet).toBe(trackingHandlers.health)
src/routes/api/tests/refresh.route.test.ts:30:  it('binds /api/refresh/status to refresh status controller', () => {
src/routes/api/tests/refresh.route.test.ts:31:    expect(refreshStatusGet).toBe(trackingHandlers.status)
src/routes/api/tests/refresh.route.test.ts:34:  it('returns 410 for legacy /api/refresh-maersk/:container', async () => {
src/routes/api/tests/refresh.route.test.ts:35:    const getResponse = await refreshMaerskGet()
src/routes/api/tests/refresh.route.test.ts:37:    const postResponse = await refreshMaerskPost()
src/routes/api/tests/refresh.route.test.ts:42:    expect(getBody.error).toBe('refresh_maersk_deprecated_use_sync_queue')
src/routes/api/tests/refresh.route.test.ts:43:    expect(postBody.error).toBe('refresh_maersk_deprecated_use_sync_queue')
src/routes/api/refresh-maersk/[container].ts:5: * Use POST /api/refresh to enqueue a sync request instead.
src/routes/api/refresh-maersk/[container].ts:9:  return new Response(JSON.stringify({ error: 'refresh_maersk_deprecated_use_sync_queue' }), {
src/routes/api/refresh/status.ts:2: * Refresh status API route - thin adapter to tracking refresh controllers.
src/routes/api/refresh/status.ts:4: * GET /api/refresh/status
src/routes/api/refresh/status.ts:7:import { bootstrapRefreshControllers } from '~/modules/tracking/interface/http/refresh.controllers.bootstrap'
src/routes/api/refresh/status.ts:11:const refreshControllers = bootstrapRefreshControllers()
src/routes/api/refresh/status.ts:13:export const GET = refreshControllers.status
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:277:      console.log('[maersk-refresh] Starting capture for container:', command.container)
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:278:      console.log('[maersk-refresh] Config:', {
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:334:        `[maersk-refresh] Using Chrome at: ${browserResolution.executablePath} (source: ${browserResolution.source})`,
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:419:              console.log('[maersk-refresh] CDP captured response:', responseUrl, 'status:', status)
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:475:                console.log('[maersk-refresh] Candidate capture score:', candidateScore)
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:477:                console.error('[maersk-refresh] Error getting response body:', error)
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:485:        console.log('[maersk-refresh] Warmup: visiting homepage')
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:496:          console.warn('[maersk-refresh] Warmup failed, continuing:', error)
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:505:          console.log('[maersk-refresh] Fallback: navigating directly to API URL:', apiFallbackUrl)
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:512:            console.warn('[maersk-refresh] API fallback navigation failed:', error)
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:518:        console.log('[maersk-refresh] Navigating to:', trackingUrl)
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:528:          console.warn('[maersk-refresh] Navigation timeout, checking if we captured response')
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:543:          console.log('[maersk-refresh] Waiting for API response...')
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:560:            console.debug('[maersk-refresh] bmak not found')
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:567:          console.log('[maersk-refresh] HOLD mode - browser stays open. Press Ctrl+C to exit.')
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:575:            console.warn('[maersk-refresh] Error closing browser:', error)
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:623:              console.warn('[maersk-refresh] Could not write diagnostics file:', error)
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:685:              `[maersk-refresh] Wrote diagnostics to ${path.relative(projectRoot, diagnosticsPath)}`,
src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:688:            console.warn('[maersk-refresh] Could not write diagnostics file:', error)
src/modules/tracking/application/usecases/tests/refresh-rest-container.usecase.test.ts:3:import { createRefreshRestContainerUseCase } from '~/modules/tracking/application/usecases/refresh-rest-container.usecase'
src/modules/tracking/application/usecases/tests/refresh-rest-container.usecase.test.ts:5:describe('refresh-rest-container use case', () => {
src/modules/process/ui/screens/DashboardScreen.tsx:16:import { refreshDashboardData } from '~/modules/process/ui/utils/dashboard-refresh'
src/modules/process/ui/screens/DashboardScreen.tsx:201:    await refreshDashboardData({
src/modules/process/ui/utils/dashboard-refresh.ts:16:export async function refreshDashboardData(command: DashboardRefreshCommand): Promise<void> {
src/modules/process/ui/utils/dashboard-refresh.ts:34:  throw new Error('Dashboard refresh failed')
src/modules/process/ui/utils/sync-realtime-coordinator.ts:33:  readonly refreshTrackingData: () => Promise<void>
src/modules/process/ui/utils/sync-realtime-coordinator.ts:56:      await command.refreshTrackingData()
src/modules/process/ui/utils/sync-realtime-coordinator.ts:58:      console.error('Auto sync refresh failed:', err)
src/modules/process/ui/components/ShipmentHeader.tsx:19:  refreshRetry: {
src/modules/process/ui/components/ShipmentHeader.tsx:23:  refreshHint: string | null
src/modules/process/ui/components/ShipmentHeader.tsx:343:              title={t(keys.shipmentView.actions.refresh)}
src/modules/process/ui/components/ShipmentHeader.tsx:347:            <Show when={props.isRefreshing ? props.refreshRetry : null}>
src/modules/process/ui/components/ShipmentHeader.tsx:348:              {(refreshRetry) => (
src/modules/process/ui/components/ShipmentHeader.tsx:350:                  {t(keys.shipmentView.refreshRetry, {
src/modules/process/ui/components/ShipmentHeader.tsx:351:                    current: refreshRetry().current,
src/modules/process/ui/components/ShipmentHeader.tsx:352:                    total: refreshRetry().total,
src/modules/process/ui/components/ShipmentHeader.tsx:357:            <Show when={props.isRefreshing ? null : props.refreshHint}>
src/modules/process/ui/components/ShipmentHeader.tsx:358:              {(refreshHint) => <span class="text-[10px] text-slate-500">{refreshHint()}</span>}
src/modules/process/ui/components/ShipmentHeader.tsx:364:              title={t(keys.shipmentView.refreshCarrierUnknownTitle)}
src/modules/process/ui/components/ShipmentHeader.tsx:365:              description={t(keys.shipmentView.refreshCarrierUnknownMessage)}
src/modules/process/ui/components/ShipmentHeader.tsx:366:              cancelLabel={t(keys.shipmentView.refreshCarrierUnknownCancelCTA)}
src/modules/process/ui/components/ShipmentHeader.tsx:367:              editLabel={t(keys.shipmentView.refreshCarrierUnknownEditCTA)}
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:2:import { refreshDashboardData } from '~/modules/process/ui/utils/dashboard-refresh'
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:4:describe('refreshDashboardData', () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:23:      refreshDashboardData({
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:46:      refreshDashboardData({
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:66:      refreshDashboardData({
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:88:      refreshDashboardData({
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:6:} from '~/modules/process/ui/utils/refresh-sync-polling'
src/modules/process/ui/utils/tests/refresh-sync-polling.test.ts:8:describe('refresh-sync-polling', () => {
src/modules/process/ui/ShipmentView.tsx:15:import { pollRefreshSyncStatus } from '~/modules/process/ui/utils/refresh-sync-polling'
src/modules/process/ui/ShipmentView.tsx:190:  readonly refreshTrackingData: () => Promise<void> // i18n-enforce-ignore
src/modules/process/ui/ShipmentView.tsx:213:async function refreshTrackingDataOnly(command: {
src/modules/process/ui/ShipmentView.tsx:343:  const response = await fetch('/api/refresh', {
src/modules/process/ui/ShipmentView.tsx:353:    throw new Error(`refresh failed for ${containerNumber}: ${response.status} ${errorMessage}`)
src/modules/process/ui/ShipmentView.tsx:358:    throw new Error(`refresh failed for ${containerNumber}: invalid enqueue response`)
src/modules/process/ui/ShipmentView.tsx:371:  const response = await fetch(`/api/refresh/status?${params.toString()}`, {
src/modules/process/ui/ShipmentView.tsx:382:    throw new Error(`refresh status failed: ${response.status} ${errorMessage}`)
src/modules/process/ui/ShipmentView.tsx:387:    throw new Error('refresh status failed: invalid response payload')
src/modules/process/ui/ShipmentView.tsx:455:        console.warn('[refresh] sync_requests realtime channel degraded', channelStatus)
src/modules/process/ui/ShipmentView.tsx:524:async function refreshShipmentContainers(params: RefreshContainersParams): Promise<void> {
src/modules/process/ui/ShipmentView.tsx:564:      await params.refreshTrackingData()
src/modules/process/ui/ShipmentView.tsx:566:      console.error('Failed to refresh tracking data after enqueue:', err)
src/modules/process/ui/ShipmentView.tsx:608:    console.error('Failed to refresh containers:', {
src/modules/process/ui/ShipmentView.tsx:627:        await params.refreshTrackingData()
src/modules/process/ui/ShipmentView.tsx:629:        console.error('Failed to refresh tracking data after sync:', err)
src/modules/process/ui/ShipmentView.tsx:636:  readonly refreshError: string | null
src/modules/process/ui/ShipmentView.tsx:638:  readonly refreshHint: string | null
src/modules/process/ui/ShipmentView.tsx:661:  readonly refreshRetry: RefreshRetryState | null
src/modules/process/ui/ShipmentView.tsx:687:  readonly refreshRetry: RefreshRetryState | null
src/modules/process/ui/ShipmentView.tsx:688:  readonly refreshHint: string | null
src/modules/process/ui/ShipmentView.tsx:703:        refreshRetry={props.refreshRetry}
src/modules/process/ui/ShipmentView.tsx:704:        refreshHint={props.refreshHint}
src/modules/process/ui/ShipmentView.tsx:763:      <Show when={props.refreshError}>
src/modules/process/ui/ShipmentView.tsx:767:              <div>{props.refreshError}</div>
src/modules/process/ui/ShipmentView.tsx:858:              refreshRetry={props.refreshRetry}
src/modules/process/ui/ShipmentView.tsx:859:              refreshHint={props.refreshHint}
src/modules/process/ui/ShipmentView.tsx:1116:  const [refreshRetry, setRefreshRetry] = createSignal<RefreshRetryState | null>(null)
src/modules/process/ui/ShipmentView.tsx:1117:  const [refreshError, setRefreshError] = createSignal<string | null>(null)
src/modules/process/ui/ShipmentView.tsx:1118:  const [refreshHint, setRefreshHint] = createSignal<string | null>(null)
src/modules/process/ui/ShipmentView.tsx:1129:  const refreshTrackingData = () =>
src/modules/process/ui/ShipmentView.tsx:1130:    refreshTrackingDataOnly({
src/modules/process/ui/ShipmentView.tsx:1139:    refreshTrackingData,
src/modules/process/ui/ShipmentView.tsx:1152:              t(keys.shipmentView.refreshRecentlyUpdatedSeconds, { count }),
src/modules/process/ui/ShipmentView.tsx:1154:              t(keys.shipmentView.refreshRecentlyUpdatedMinutes, { count }),
src/modules/process/ui/ShipmentView.tsx:1163:    await refreshShipmentContainers({
src/modules/process/ui/ShipmentView.tsx:1177:      refreshTrackingData,
src/modules/process/ui/ShipmentView.tsx:1180:        t(keys.shipmentView.refreshSyncTimeout, { total: totalRetries }),
src/modules/process/ui/ShipmentView.tsx:1182:        t(keys.shipmentView.refreshSyncFailed, { failedCount, firstError }),
src/modules/process/ui/ShipmentView.tsx:1251:      refreshError={refreshError()}
src/modules/process/ui/ShipmentView.tsx:1253:      refreshHint={refreshHint()}
src/modules/process/ui/ShipmentView.tsx:1276:      refreshRetry={refreshRetry()}

```



# Search: Sincronizar occurrences

Command executed:
```bash
rg -n "Sincronizar" src
```

Output:
```

src/locales/pt-PT.json:31:      "sync": "Sincronizar",
src/locales/pt-PT.json:141:        "idle": "Sincronizar processo",
src/locales/pt-BR.json:31:      "sync": "Sincronizar",
src/locales/pt-BR.json:141:        "idle": "Sincronizar processo",

```



# Search: alerts in process UI

Command executed:
```bash
rg -n "alerts" src/modules/process/ui
```

Output:
```

src/modules/process/ui/ShipmentView.tsx:77:function toSortedActiveAlerts(alerts: readonly AlertDisplayVM[]): readonly AlertDisplayVM[] {
src/modules/process/ui/ShipmentView.tsx:78:  return [...alerts]
src/modules/process/ui/ShipmentView.tsx:83:function toSortedArchivedAlerts(alerts: readonly AlertDisplayVM[]): readonly AlertDisplayVM[] {
src/modules/process/ui/ShipmentView.tsx:84:  return [...alerts].filter((alert) => alert.ackedAtIso !== null).sort(compareAlertsByAckedAtDesc)
src/modules/process/ui/ShipmentView.tsx:88:  alerts: readonly AlertDisplayVM[],
src/modules/process/ui/ShipmentView.tsx:92:  return alerts.map((alert) => {
src/modules/process/ui/ShipmentView.tsx:102:  alerts: readonly AlertDisplayVM[],
src/modules/process/ui/ShipmentView.tsx:105:  return alerts.map((alert) => {
src/modules/process/ui/ShipmentView.tsx:234:    alerts: latest.alerts,
src/modules/process/ui/ShipmentView.tsx:711:      <OperationalSummaryStrip data={props.data} alerts={props.activeAlerts} />
src/modules/process/ui/ShipmentView.tsx:738:              alerts={props.activeAlerts}
src/modules/process/ui/ShipmentView.tsx:789:                aria-label={t(keys.shipmentView.alerts.action.dismissActionError)}
src/modules/process/ui/ShipmentView.tsx:1069:      command.updateAlerts((alerts) => {
src/modules/process/ui/ShipmentView.tsx:1070:        return withAlertMarkedAsAcknowledged(alerts, alertId, new Date().toISOString())
src/modules/process/ui/ShipmentView.tsx:1089:      command.updateAlerts((alerts) => withAlertMarkedAsActive(alerts, alertId))
src/modules/process/ui/ShipmentView.tsx:1194:    acknowledgeErrorMessage: t(keys.shipmentView.alerts.action.errorAcknowledge),
src/modules/process/ui/ShipmentView.tsx:1195:    unacknowledgeErrorMessage: t(keys.shipmentView.alerts.action.errorUnacknowledge),
src/modules/process/ui/ShipmentView.tsx:1202:          alerts: updater(current.alerts),
src/modules/process/ui/ShipmentView.tsx:1232:    return toSortedActiveAlerts(data.alerts)
src/modules/process/ui/ShipmentView.tsx:1238:    return toSortedArchivedAlerts(data.alerts)
src/modules/process/ui/viewmodels/process-summary.vm.ts:26:  readonly alertsCount: number
src/modules/process/ui/viewmodels/shipment.vm.ts:98:  readonly alerts: readonly AlertDisplayVM[]
src/modules/process/ui/timeline/timelineBlockModel.ts:561: * TODO (Future — Phase 26): Port waiting time should also generate monitoring alerts.
src/modules/process/ui/timeline/timelineBlockModel.ts:568: * - These alerts should appear in AlertsPanel + Dashboard
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:34:    alertsCount: 0,
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:48:    alertsCount: 0,
src/modules/process/ui/viewmodels/tests/dashboard-filter-interaction.vm.test.ts:38:    alertsCount: 0,
src/modules/process/ui/validation/processApi.validation.ts:6:import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
src/modules/process/ui/validation/processApi.validation.ts:163:    '/api/alerts',
src/modules/process/ui/validation/tests/processApi.validation.test.ts:126:    expect(fetchSpy).toHaveBeenCalledWith('/api/alerts', {
src/modules/process/ui/validation/tests/processApi.validation.test.ts:144:    expect(fetchSpy).toHaveBeenCalledWith('/api/alerts', {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:13:      sequence.push('alerts')
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:35:    expect(sequence).toContain('alerts')
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:62:      throw new Error('global alerts failed')
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:71:    ).rejects.toThrow('global alerts failed')
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:84:      throw new Error('global alerts failed')
src/modules/process/ui/mappers/processList.ui-mapper.ts:29:  alerts_count?: number
src/modules/process/ui/mappers/processList.ui-mapper.ts:101:      alertsCount: process.alerts_count ?? 0,
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:27:  alerts: readonly TrackingAlertProjectionSource[],
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:30:  return toTrackingAlertProjections(alerts).map((projection) =>
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:223:    alerts: toAlertDisplayVMs(data.alerts ?? [], locale),
src/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper.ts:1:import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
src/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper.ts:8:    totalActiveAlerts: source.total_active_alerts,
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:62:        alerts_count: 2,
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:77:    expect(result[0].alertsCount).toBe(2)
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:92:    expect(result[0].alertsCount).toBe(0)
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:45:      alerts: [],
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:65:    expect(Array.isArray(result.alerts)).toBe(true)
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:68:  it('maps process-level status and alerts from tracking data', () => {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:89:      alerts: [
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:108:    expect(result.alerts.length).toBe(1)
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:109:    expect(result.alerts[0].type).toBe('transshipment')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:110:    expect(result.alerts[0].severity).toBe('warning')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:111:    expect(result.alerts[0].category).toBe('fact')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:112:    expect(result.alerts[0].triggeredAtIso).toBe('2026-02-01T10:00:00.000Z')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:113:    expect(result.alerts[0].ackedAtIso).toBeNull()
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:146:      alerts: [],
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:154:  it('keeps acknowledged alerts and exposes ackedAtIso', () => {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:166:      alerts: [
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:183:    expect(result.alerts.length).toBe(1)
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:184:    expect(result.alerts[0].ackedAtIso).toBe('2026-03-05T12:00:00.000Z')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:206:      alerts: [],
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:279:      alerts: [],
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:341:      alerts: [],
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:408:      alerts: [],
src/modules/process/ui/mappers/tests/dashboardProcessExceptions.ui-mapper.test.ts:7:      total_active_alerts: 3,
src/modules/process/ui/components/DashboardProcessTable.tsx:139:  if (process.alertsCount > 0) return 'info'
src/modules/process/ui/components/DashboardProcessTable.tsx:148:  if (process.alertsCount === 0) return t(keys.dashboard.table.dominantAlertLabel.noAlerts)
src/modules/process/ui/components/DashboardProcessTable.tsx:150:  return t(keys.dashboard.table.dominantAlertLabel.alertsPresent, { count: process.alertsCount })
src/modules/process/ui/components/DashboardProcessTable.tsx:163:  if (process.alertsCount > 0 && cats.length === 0) {
src/modules/process/ui/components/DashboardProcessTable.tsx:377:          {props.process.alertsCount}
src/modules/process/ui/mappers/tests/dashboardGlobalAlerts.ui-mapper.test.ts:7:      total_active_alerts: 12,
src/modules/process/ui/components/DashboardMetricsGrid.tsx:3:import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
src/modules/process/ui/components/TimelinePanel.tsx:29:  alerts?: readonly AlertDisplayVM[]
src/modules/process/ui/components/TimelinePanel.tsx:46:function buildHighlightedEventTypes(alerts: readonly AlertDisplayVM[]): ReadonlySet<string> {
src/modules/process/ui/components/TimelinePanel.tsx:48:  for (const alert of alerts) {
src/modules/process/ui/components/TimelinePanel.tsx:85:  const highlightedTypes = () => buildHighlightedEventTypes(props.alerts ?? [])
src/modules/process/ui/components/OperationalSummaryStrip.tsx:10:  readonly alerts: ShipmentDetailVM['alerts']
src/modules/process/ui/components/OperationalSummaryStrip.tsx:23:  if (s < 60) return t(keys.shipmentView.alerts.aging.now)
src/modules/process/ui/components/OperationalSummaryStrip.tsx:25:  if (m < 60) return t(keys.shipmentView.alerts.aging.minutes, { count: m })
src/modules/process/ui/components/OperationalSummaryStrip.tsx:27:  if (h < 24) return t(keys.shipmentView.alerts.aging.hours, { count: h })
src/modules/process/ui/components/OperationalSummaryStrip.tsx:29:  return t(keys.shipmentView.alerts.aging.days, { count: d })
src/modules/process/ui/components/OperationalSummaryStrip.tsx:32:function findLatestAlertTimestamp(alerts: ShipmentDetailVM['alerts']): string | null {
src/modules/process/ui/components/OperationalSummaryStrip.tsx:33:  if (alerts.length === 0) return null
src/modules/process/ui/components/OperationalSummaryStrip.tsx:35:  for (const alert of alerts) {
src/modules/process/ui/components/OperationalSummaryStrip.tsx:46:  const alertCount = () => props.alerts.length
src/modules/process/ui/components/OperationalSummaryStrip.tsx:47:  const latestAlertTs = () => findLatestAlertTimestamp(props.alerts)
src/modules/process/ui/components/OperationalSummaryStrip.tsx:95:          {t(keys.shipmentView.summaryStrip.alerts)}
src/modules/process/ui/components/ShipmentHeader.tsx:400:      {/* Row 2: Process-level ETA summary + containers/alerts count */}
src/modules/process/ui/components/ShipmentHeader.tsx:415:              <span class="font-medium">{t(keys.shipmentView.alerts.title)}:</span>{' '}
src/modules/process/ui/components/AlertsList.tsx:18:      return t(keys.shipmentView.alerts.category.eta)
src/modules/process/ui/components/AlertsList.tsx:20:      return t(keys.shipmentView.alerts.category.customs)
src/modules/process/ui/components/AlertsList.tsx:22:      return t(keys.shipmentView.alerts.category.movement)
src/modules/process/ui/components/AlertsList.tsx:24:      return t(keys.shipmentView.alerts.category.data)
src/modules/process/ui/components/AlertsList.tsx:63:  if (s < 60) return t(keys.shipmentView.alerts.aging.now)
src/modules/process/ui/components/AlertsList.tsx:65:  if (m < 60) return t(keys.shipmentView.alerts.aging.minutes, { count: m })
src/modules/process/ui/components/AlertsList.tsx:67:  if (h < 24) return t(keys.shipmentView.alerts.aging.hours, { count: h })
src/modules/process/ui/components/AlertsList.tsx:69:  return t(keys.shipmentView.alerts.aging.days, { count: d })
src/modules/process/ui/components/AlertsList.tsx:77:  if (severity === 'danger') return t(keys.shipmentView.alerts.severity.danger)
src/modules/process/ui/components/AlertsList.tsx:78:  if (severity === 'warning') return t(keys.shipmentView.alerts.severity.warning)
src/modules/process/ui/components/AlertsList.tsx:79:  return t(keys.shipmentView.alerts.severity.info)
src/modules/process/ui/components/AlertsList.tsx:108:  alerts: readonly AlertDisplayVM[]
src/modules/process/ui/components/AlertsList.tsx:119:      <For each={props.alerts}>
src/modules/process/ui/components/AlertsList.tsx:157:                    aria-label={t(keys.shipmentView.alerts.action.unacknowledgeAria)}
src/modules/process/ui/components/AlertsList.tsx:160:                    {t(keys.shipmentView.alerts.action.unacknowledge)}
src/modules/process/ui/components/AlertsList.tsx:168:                  aria-label={t(keys.shipmentView.alerts.action.acknowledgeAria)}
src/modules/process/ui/components/AlertsPanel.tsx:21:    <section id="shipment-alerts" class="space-y-1 scroll-mt-[120px]">
src/modules/process/ui/components/AlertsPanel.tsx:25:            alerts={props.activeAlerts}
src/modules/process/ui/components/AlertsPanel.tsx:38:            {t(keys.shipmentView.alerts.archived.title, { count: props.archivedAlerts.length })}
src/modules/process/ui/components/AlertsPanel.tsx:42:              alerts={props.archivedAlerts}
src/modules/process/ui/components/AlertsPanel.tsx:55:          {t(keys.shipmentView.alerts.activeEmpty)}

```



# Search: Alert components

Command executed:
```bash
rg -n "Alert" src/modules/process/ui
```

Output:
```

src/modules/process/ui/validation/processApi.validation.ts:4:import { toDashboardGlobalAlertsVM } from '~/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper'
src/modules/process/ui/validation/processApi.validation.ts:6:import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
src/modules/process/ui/validation/processApi.validation.ts:22:const AlertActionResponseSchema = z.object({
src/modules/process/ui/validation/processApi.validation.ts:127:export async function fetchDashboardGlobalAlertsSummary(): Promise<DashboardGlobalAlertsVM> {
src/modules/process/ui/validation/processApi.validation.ts:129:  return toDashboardGlobalAlertsVM(data)
src/modules/process/ui/validation/processApi.validation.ts:158:async function runTrackingAlertActionRequest(
src/modules/process/ui/validation/processApi.validation.ts:169:    AlertActionResponseSchema,
src/modules/process/ui/validation/processApi.validation.ts:173:export async function acknowledgeTrackingAlertRequest(alertId: string): Promise<void> {
src/modules/process/ui/validation/processApi.validation.ts:174:  await runTrackingAlertActionRequest(alertId, 'acknowledge')
src/modules/process/ui/validation/processApi.validation.ts:177:export async function unacknowledgeTrackingAlertRequest(alertId: string): Promise<void> {
src/modules/process/ui/validation/processApi.validation.ts:178:  await runTrackingAlertActionRequest(alertId, 'unacknowledge')
src/modules/process/ui/timeline/timelineBlockModel.ts:557:// Phase 26 (Future) — Port Risk Alerts (TODO only)
src/modules/process/ui/timeline/timelineBlockModel.ts:568: * - These alerts should appear in AlertsPanel + Dashboard
src/modules/process/ui/timeline/timelineBlockModel.ts:571: * - Alert is created when ARRIVAL event exists with no subsequent DISCHARGE/GATE_OUT/DELIVERY for >3 days
src/modules/process/ui/timeline/timelineBlockModel.ts:572: * - Alert includes durationDays and port information
src/modules/process/ui/timeline/timelineBlockModel.ts:573: * - Alert is retroactive: false (monitoring only)
src/modules/process/ui/timeline/timelineBlockModel.ts:574: * - Alert is resolved automatically when exit event arrives
src/modules/process/ui/ShipmentView.tsx:7:import { AlertsPanel } from '~/modules/process/ui/components/AlertsPanel'
src/modules/process/ui/ShipmentView.tsx:18:  acknowledgeTrackingAlertRequest,
src/modules/process/ui/ShipmentView.tsx:21:  unacknowledgeTrackingAlertRequest,
src/modules/process/ui/ShipmentView.tsx:28:import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
src/modules/process/ui/ShipmentView.tsx:63:function compareAlertsByTriggeredAtDesc(left: AlertDisplayVM, right: AlertDisplayVM): number {
src/modules/process/ui/ShipmentView.tsx:69:function compareAlertsByAckedAtDesc(left: AlertDisplayVM, right: AlertDisplayVM): number {
src/modules/process/ui/ShipmentView.tsx:77:function toSortedActiveAlerts(alerts: readonly AlertDisplayVM[]): readonly AlertDisplayVM[] {
src/modules/process/ui/ShipmentView.tsx:80:    .sort(compareAlertsByTriggeredAtDesc)
src/modules/process/ui/ShipmentView.tsx:83:function toSortedArchivedAlerts(alerts: readonly AlertDisplayVM[]): readonly AlertDisplayVM[] {
src/modules/process/ui/ShipmentView.tsx:84:  return [...alerts].filter((alert) => alert.ackedAtIso !== null).sort(compareAlertsByAckedAtDesc)
src/modules/process/ui/ShipmentView.tsx:87:function withAlertMarkedAsAcknowledged(
src/modules/process/ui/ShipmentView.tsx:88:  alerts: readonly AlertDisplayVM[],
src/modules/process/ui/ShipmentView.tsx:91:): readonly AlertDisplayVM[] {
src/modules/process/ui/ShipmentView.tsx:101:function withAlertMarkedAsActive(
src/modules/process/ui/ShipmentView.tsx:102:  alerts: readonly AlertDisplayVM[],
src/modules/process/ui/ShipmentView.tsx:104:): readonly AlertDisplayVM[] {
src/modules/process/ui/ShipmentView.tsx:640:  readonly onDismissAlertActionError: () => void
src/modules/process/ui/ShipmentView.tsx:656:  readonly activeAlerts: readonly AlertDisplayVM[]
src/modules/process/ui/ShipmentView.tsx:657:  readonly archivedAlerts: readonly AlertDisplayVM[]
src/modules/process/ui/ShipmentView.tsx:658:  readonly busyAlertIds: ReadonlySet<string>
src/modules/process/ui/ShipmentView.tsx:659:  readonly collapsingAlertIds: ReadonlySet<string>
src/modules/process/ui/ShipmentView.tsx:664:  readonly onAcknowledgeAlert: (alertId: string) => void
src/modules/process/ui/ShipmentView.tsx:665:  readonly onUnacknowledgeAlert: (alertId: string) => void
src/modules/process/ui/ShipmentView.tsx:679:  readonly activeAlerts: readonly AlertDisplayVM[]
src/modules/process/ui/ShipmentView.tsx:680:  readonly archivedAlerts: readonly AlertDisplayVM[]
src/modules/process/ui/ShipmentView.tsx:681:  readonly busyAlertIds: ReadonlySet<string>
src/modules/process/ui/ShipmentView.tsx:682:  readonly collapsingAlertIds: ReadonlySet<string>
src/modules/process/ui/ShipmentView.tsx:683:  readonly onAcknowledgeAlert: (alertId: string) => void
src/modules/process/ui/ShipmentView.tsx:684:  readonly onUnacknowledgeAlert: (alertId: string) => void
src/modules/process/ui/ShipmentView.tsx:705:        activeAlertCount={props.activeAlerts.length}
src/modules/process/ui/ShipmentView.tsx:711:      <OperationalSummaryStrip data={props.data} alerts={props.activeAlerts} />
src/modules/process/ui/ShipmentView.tsx:717:            <AlertsPanel
src/modules/process/ui/ShipmentView.tsx:718:              activeAlerts={props.activeAlerts}
src/modules/process/ui/ShipmentView.tsx:719:              archivedAlerts={props.archivedAlerts}
src/modules/process/ui/ShipmentView.tsx:720:              busyAlertIds={props.busyAlertIds}
src/modules/process/ui/ShipmentView.tsx:721:              collapsingAlertIds={props.collapsingAlertIds}
src/modules/process/ui/ShipmentView.tsx:722:              onAcknowledge={props.onAcknowledgeAlert}
src/modules/process/ui/ShipmentView.tsx:723:              onUnacknowledge={props.onUnacknowledgeAlert}
src/modules/process/ui/ShipmentView.tsx:738:              alerts={props.activeAlerts}
src/modules/process/ui/ShipmentView.tsx:760:        alertCount={props.activeAlerts.length}
src/modules/process/ui/ShipmentView.tsx:790:                onClick={() => props.onDismissAlertActionError()}
src/modules/process/ui/ShipmentView.tsx:851:              activeAlerts={props.activeAlerts}
src/modules/process/ui/ShipmentView.tsx:852:              archivedAlerts={props.archivedAlerts}
src/modules/process/ui/ShipmentView.tsx:853:              busyAlertIds={props.busyAlertIds}
src/modules/process/ui/ShipmentView.tsx:854:              collapsingAlertIds={props.collapsingAlertIds}
src/modules/process/ui/ShipmentView.tsx:855:              onAcknowledgeAlert={props.onAcknowledgeAlert}
src/modules/process/ui/ShipmentView.tsx:856:              onUnacknowledgeAlert={props.onUnacknowledgeAlert}
src/modules/process/ui/ShipmentView.tsx:1033:type AlertActionsCommand = {
src/modules/process/ui/ShipmentView.tsx:1037:  readonly updateAlerts: (
src/modules/process/ui/ShipmentView.tsx:1038:    updater: (current: readonly AlertDisplayVM[]) => readonly AlertDisplayVM[],
src/modules/process/ui/ShipmentView.tsx:1042:type AlertActionsController = {
src/modules/process/ui/ShipmentView.tsx:1043:  readonly busyAlertIds: () => ReadonlySet<string>
src/modules/process/ui/ShipmentView.tsx:1044:  readonly collapsingAlertIds: () => ReadonlySet<string>
src/modules/process/ui/ShipmentView.tsx:1046:  readonly clearAlertActionError: () => void
src/modules/process/ui/ShipmentView.tsx:1047:  readonly acknowledgeAlert: (alertId: string) => Promise<void> // i18n-enforce-ignore
src/modules/process/ui/ShipmentView.tsx:1048:  readonly unacknowledgeAlert: (alertId: string) => Promise<void> // i18n-enforce-ignore
src/modules/process/ui/ShipmentView.tsx:1055:function useAlertActionsController(command: AlertActionsCommand): AlertActionsController {
src/modules/process/ui/ShipmentView.tsx:1056:  const [busyAlertIds, setBusyAlertIds] = createSignal<ReadonlySet<string>>(new Set())
src/modules/process/ui/ShipmentView.tsx:1057:  const [collapsingAlertIds, setCollapsingAlertIds] = createSignal<ReadonlySet<string>>(new Set())
src/modules/process/ui/ShipmentView.tsx:1058:  const [alertActionError, setAlertActionError] = createSignal<string | null>(null)
src/modules/process/ui/ShipmentView.tsx:1060:  const acknowledgeAlert = async (alertId: string) => {
src/modules/process/ui/ShipmentView.tsx:1061:    if (busyAlertIds().has(alertId)) return
src/modules/process/ui/ShipmentView.tsx:1062:    setAlertActionError(null)
src/modules/process/ui/ShipmentView.tsx:1063:    setBusyAlertIds((prev) => withSetEntry(prev, alertId))
src/modules/process/ui/ShipmentView.tsx:1066:      await acknowledgeTrackingAlertRequest(alertId)
src/modules/process/ui/ShipmentView.tsx:1067:      setCollapsingAlertIds((prev) => withSetEntry(prev, alertId))
src/modules/process/ui/ShipmentView.tsx:1069:      command.updateAlerts((alerts) => {
src/modules/process/ui/ShipmentView.tsx:1070:        return withAlertMarkedAsAcknowledged(alerts, alertId, new Date().toISOString())
src/modules/process/ui/ShipmentView.tsx:1075:      setAlertActionError(command.acknowledgeErrorMessage)
src/modules/process/ui/ShipmentView.tsx:1077:      setBusyAlertIds((prev) => withoutSetEntry(prev, alertId))
src/modules/process/ui/ShipmentView.tsx:1078:      setCollapsingAlertIds((prev) => withoutSetEntry(prev, alertId))
src/modules/process/ui/ShipmentView.tsx:1082:  const unacknowledgeAlert = async (alertId: string) => {
src/modules/process/ui/ShipmentView.tsx:1083:    if (busyAlertIds().has(alertId)) return
src/modules/process/ui/ShipmentView.tsx:1084:    setAlertActionError(null)
src/modules/process/ui/ShipmentView.tsx:1085:    setBusyAlertIds((prev) => withSetEntry(prev, alertId))
src/modules/process/ui/ShipmentView.tsx:1088:      await unacknowledgeTrackingAlertRequest(alertId)
src/modules/process/ui/ShipmentView.tsx:1089:      command.updateAlerts((alerts) => withAlertMarkedAsActive(alerts, alertId))
src/modules/process/ui/ShipmentView.tsx:1093:      setAlertActionError(command.unacknowledgeErrorMessage)
src/modules/process/ui/ShipmentView.tsx:1095:      setBusyAlertIds((prev) => withoutSetEntry(prev, alertId))
src/modules/process/ui/ShipmentView.tsx:1100:    busyAlertIds,
src/modules/process/ui/ShipmentView.tsx:1101:    collapsingAlertIds,
src/modules/process/ui/ShipmentView.tsx:1103:    clearAlertActionError: () => setAlertActionError(null),
src/modules/process/ui/ShipmentView.tsx:1104:    acknowledgeAlert,
src/modules/process/ui/ShipmentView.tsx:1105:    unacknowledgeAlert,
src/modules/process/ui/ShipmentView.tsx:1193:  const alertActions = useAlertActionsController({
src/modules/process/ui/ShipmentView.tsx:1197:    updateAlerts: (updater) => {
src/modules/process/ui/ShipmentView.tsx:1229:  const activeAlerts = createMemo<readonly AlertDisplayVM[]>(() => {
src/modules/process/ui/ShipmentView.tsx:1232:    return toSortedActiveAlerts(data.alerts)
src/modules/process/ui/ShipmentView.tsx:1235:  const archivedAlerts = createMemo<readonly AlertDisplayVM[]>(() => {
src/modules/process/ui/ShipmentView.tsx:1238:    return toSortedArchivedAlerts(data.alerts)
src/modules/process/ui/ShipmentView.tsx:1255:      onDismissAlertActionError={alertActions.clearAlertActionError}
src/modules/process/ui/ShipmentView.tsx:1271:      activeAlerts={activeAlerts()}
src/modules/process/ui/ShipmentView.tsx:1272:      archivedAlerts={archivedAlerts()}
src/modules/process/ui/ShipmentView.tsx:1273:      busyAlertIds={alertActions.busyAlertIds()}
src/modules/process/ui/ShipmentView.tsx:1274:      collapsingAlertIds={alertActions.collapsingAlertIds()}
src/modules/process/ui/ShipmentView.tsx:1279:      onAcknowledgeAlert={alertActions.acknowledgeAlert}
src/modules/process/ui/ShipmentView.tsx:1280:      onUnacknowledgeAlert={alertActions.unacknowledgeAlert}
src/modules/process/ui/validation/tests/processApi.validation.test.ts:3:  acknowledgeTrackingAlertRequest,
src/modules/process/ui/validation/tests/processApi.validation.test.ts:5:  unacknowledgeTrackingAlertRequest,
src/modules/process/ui/validation/tests/processApi.validation.test.ts:124:    await acknowledgeTrackingAlertRequest('alert-1')
src/modules/process/ui/validation/tests/processApi.validation.test.ts:142:    await unacknowledgeTrackingAlertRequest('alert-2')
src/modules/process/ui/utils/dashboard-refresh.ts:4:  readonly refetchGlobalAlerts: () => unknown
src/modules/process/ui/utils/dashboard-refresh.ts:21:    Promise.resolve(command.refetchGlobalAlerts()),
src/modules/process/ui/viewmodels/process-summary.vm.ts:27:  readonly highestAlertSeverity: 'info' | 'warning' | 'danger' | null
src/modules/process/ui/mappers/processList.ui-mapper.ts:102:      highestAlertSeverity: process.highest_alert_severity ?? null,
src/modules/process/ui/viewmodels/alert.vm.ts:1:export type AlertDisplayVM = {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:12:    const refetchGlobalAlerts = vi.fn(async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:14:      return { totalActiveAlerts: 0 }
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:26:        refetchGlobalAlerts,
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:32:    expect(refetchGlobalAlerts).toHaveBeenCalledTimes(1)
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:43:    const refetchGlobalAlerts = vi.fn(async () => ({ totalActiveAlerts: 0 }))
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:49:        refetchGlobalAlerts,
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:55:    expect(refetchGlobalAlerts).toHaveBeenCalledTimes(0)
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:61:    const refetchGlobalAlerts = vi.fn(async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:69:        refetchGlobalAlerts,
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:75:    expect(refetchGlobalAlerts).toHaveBeenCalledTimes(1)
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:83:    const refetchGlobalAlerts = vi.fn(async () => {
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:91:        refetchGlobalAlerts,
src/modules/process/ui/utils/tests/dashboard-refresh.test.ts:97:    expect(refetchGlobalAlerts).toHaveBeenCalledTimes(1)
src/modules/process/ui/viewmodels/shipment.vm.ts:1:import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
src/modules/process/ui/viewmodels/shipment.vm.ts:98:  readonly alerts: readonly AlertDisplayVM[]
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:2:import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:4:  type TrackingAlertProjection,
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:5:  type TrackingAlertProjectionSource,
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:6:  toTrackingAlertProjections,
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:9:function projectionToAlertDisplayVM(
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:10:  projection: TrackingAlertProjection,
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:12:): AlertDisplayVM {
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:26:export function toAlertDisplayVMs(
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:27:  alerts: readonly TrackingAlertProjectionSource[],
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:29:): readonly AlertDisplayVM[] {
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:30:  return toTrackingAlertProjections(alerts).map((projection) =>
src/modules/process/ui/mappers/trackingAlert.ui-mapper.ts:31:    projectionToAlertDisplayVM(projection, locale),
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:9:import { toAlertDisplayVMs } from '~/modules/process/ui/mappers/trackingAlert.ui-mapper'
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:223:    alerts: toAlertDisplayVMs(data.alerts ?? [], locale),
src/modules/process/ui/viewmodels/dashboard-process-exception.vm.ts:15:  readonly activeAlertCount: number
src/modules/process/ui/viewmodels/dashboard-process-exception.vm.ts:16:  readonly oldestAlertGeneratedAt?: string | null
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:35:    highestAlertSeverity: null,
src/modules/process/ui/viewmodels/dashboard-global-alerts.vm.ts:1:export type DashboardGlobalAlertsVM = {
src/modules/process/ui/viewmodels/dashboard-global-alerts.vm.ts:2:  readonly totalActiveAlerts: number
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:49:    highestAlertSeverity: null,
src/modules/process/ui/viewmodels/tests/dashboard-filter-interaction.vm.test.ts:39:    highestAlertSeverity: null,
src/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper.ts:1:import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
src/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper.ts:2:import type { DashboardGlobalAlertsSummaryResponse } from '~/shared/api-schemas/dashboard.schemas'
src/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper.ts:4:export function toDashboardGlobalAlertsVM(
src/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper.ts:5:  source: DashboardGlobalAlertsSummaryResponse,
src/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper.ts:6:): DashboardGlobalAlertsVM {
src/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper.ts:8:    totalActiveAlerts: source.total_active_alerts,
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:78:    expect(result[0].highestAlertSeverity).toBe('warning')
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:93:    expect(result[0].highestAlertSeverity).toBeNull()
src/modules/process/ui/mappers/tests/dashboardProcessExceptions.ui-mapper.test.ts:55:        activeAlertCount: 2,
src/modules/process/ui/mappers/tests/dashboardProcessExceptions.ui-mapper.test.ts:66:        activeAlertCount: 0,
src/modules/process/ui/mappers/tests/dashboardGlobalAlerts.ui-mapper.test.ts:2:import { toDashboardGlobalAlertsVM } from '~/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper'
src/modules/process/ui/mappers/tests/dashboardGlobalAlerts.ui-mapper.test.ts:4:describe('toDashboardGlobalAlertsVM', () => {
src/modules/process/ui/mappers/tests/dashboardGlobalAlerts.ui-mapper.test.ts:6:    const result = toDashboardGlobalAlertsVM({
src/modules/process/ui/mappers/tests/dashboardGlobalAlerts.ui-mapper.test.ts:24:      totalActiveAlerts: 12,
src/modules/process/ui/screens/DashboardScreen.tsx:37:  fetchDashboardGlobalAlertsSummary,
src/modules/process/ui/screens/DashboardScreen.tsx:129:  const [globalAlerts, { refetch: refetchGlobalAlerts }] = createResource(() =>
src/modules/process/ui/screens/DashboardScreen.tsx:130:    fetchDashboardGlobalAlertsSummary(),
src/modules/process/ui/screens/DashboardScreen.tsx:204:      refetchGlobalAlerts,
src/modules/process/ui/screens/DashboardScreen.tsx:250:      await Promise.all([refetchProcesses(), refetchGlobalAlerts()])
src/modules/process/ui/screens/DashboardScreen.tsx:270:        alertCount={globalAlerts()?.totalActiveAlerts ?? 0}
src/modules/process/ui/screens/DashboardScreen.tsx:297:          summary={globalAlerts() ?? null}
src/modules/process/ui/screens/DashboardScreen.tsx:298:          loading={globalAlerts.loading}
src/modules/process/ui/screens/DashboardScreen.tsx:299:          hasError={Boolean(globalAlerts.error)}
src/modules/process/ui/mappers/dashboardProcessExceptions.ui-mapper.ts:34:      activeAlertCount: process.active_alert_count,
src/modules/process/ui/components/Icons.tsx:2:import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
src/modules/process/ui/components/Icons.tsx:66:export function AlertIcon(props: { readonly type: AlertDisplayVM['type'] }): JSX.Element {
src/modules/process/ui/components/AlertsList.tsx:3:import { AlertIcon } from '~/modules/process/ui/components/Icons'
src/modules/process/ui/components/AlertsList.tsx:4:import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
src/modules/process/ui/components/AlertsList.tsx:7:type AlertCategoryChipType = 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'
src/modules/process/ui/components/AlertsList.tsx:8:type AlertsListMode = 'active' | 'archived'
src/modules/process/ui/components/AlertsList.tsx:10:function toAlertCategoryLabel(
src/modules/process/ui/components/AlertsList.tsx:11:  type: AlertCategoryChipType,
src/modules/process/ui/components/AlertsList.tsx:28:function toAlertCategoryIcon(type: AlertCategoryChipType): string {
src/modules/process/ui/components/AlertsList.tsx:43:  severity: AlertDisplayVM['severity'],
src/modules/process/ui/components/AlertsList.tsx:44:  mode: AlertsListMode,
src/modules/process/ui/components/AlertsList.tsx:54:function formatAlertAge(
src/modules/process/ui/components/AlertsList.tsx:73:  severity: AlertDisplayVM['severity'],
src/modules/process/ui/components/AlertsList.tsx:82:function toAlertCardClasses(severity: AlertDisplayVM['severity'], mode: AlertsListMode): string {
src/modules/process/ui/components/AlertsList.tsx:89:function AlertCategoryChip(props: {
src/modules/process/ui/components/AlertsList.tsx:90:  type: AlertCategoryChipType
src/modules/process/ui/components/AlertsList.tsx:91:  mode: AlertsListMode
src/modules/process/ui/components/AlertsList.tsx:101:      <span aria-hidden="true">{toAlertCategoryIcon(props.type)}</span>
src/modules/process/ui/components/AlertsList.tsx:102:      {toAlertCategoryLabel(props.type, props.t, props.keys)}
src/modules/process/ui/components/AlertsList.tsx:107:export function AlertsList(props: {
src/modules/process/ui/components/AlertsList.tsx:108:  alerts: readonly AlertDisplayVM[]
src/modules/process/ui/components/AlertsList.tsx:109:  mode: AlertsListMode
src/modules/process/ui/components/AlertsList.tsx:110:  busyAlertIds: ReadonlySet<string>
src/modules/process/ui/components/AlertsList.tsx:111:  collapsingAlertIds: ReadonlySet<string>
src/modules/process/ui/components/AlertsList.tsx:121:          const isBusy = () => props.busyAlertIds.has(alert.id)
src/modules/process/ui/components/AlertsList.tsx:122:          const isCollapsing = () => props.collapsingAlertIds.has(alert.id)
src/modules/process/ui/components/AlertsList.tsx:126:              class={`list-none rounded border px-2 py-1.5 transition-all duration-200 ease-out overflow-hidden ${toAlertCardClasses(
src/modules/process/ui/components/AlertsList.tsx:135:              <AlertIcon type={alert.type} />
src/modules/process/ui/components/AlertsList.tsx:143:                  <AlertCategoryChip type={alert.type} mode={props.mode} t={t} keys={keys} />
src/modules/process/ui/components/AlertsList.tsx:145:                    {formatAlertAge(actionDateIso(), t, keys)}
src/modules/process/ui/components/DashboardProcessTable.tsx:135:  const highestSeverity = process.highestAlertSeverity
src/modules/process/ui/components/DashboardProcessTable.tsx:143:function toDominantAlertLabel(
src/modules/process/ui/components/DashboardProcessTable.tsx:148:  if (process.alertsCount === 0) return t(keys.dashboard.table.dominantAlertLabel.noAlerts)
src/modules/process/ui/components/DashboardProcessTable.tsx:149:  if (process.hasTransshipment) return t(keys.dashboard.table.dominantAlertLabel.transshipment)
src/modules/process/ui/components/DashboardProcessTable.tsx:150:  return t(keys.dashboard.table.dominantAlertLabel.alertsPresent, { count: process.alertsCount })
src/modules/process/ui/components/DashboardProcessTable.tsx:153:type AlertCategoryChip = 'eta' | 'movement' | 'data' | 'customs'
src/modules/process/ui/components/DashboardProcessTable.tsx:155:function toDerivedCategories(process: ProcessSummaryVM): readonly AlertCategoryChip[] {
src/modules/process/ui/components/DashboardProcessTable.tsx:156:  const cats: AlertCategoryChip[] = []
src/modules/process/ui/components/DashboardProcessTable.tsx:157:  if (process.highestAlertSeverity === 'danger' || process.highestAlertSeverity === 'warning') {
src/modules/process/ui/components/DashboardProcessTable.tsx:171:const CATEGORY_ICON: Record<AlertCategoryChip, string> = {
src/modules/process/ui/components/DashboardProcessTable.tsx:207:function AlertChipList(props: {
src/modules/process/ui/components/DashboardProcessTable.tsx:208:  readonly chips: readonly AlertCategoryChip[]
src/modules/process/ui/components/DashboardProcessTable.tsx:252:  const dominantAlertLabel = () => toDominantAlertLabel(props.process, t, keys)
src/modules/process/ui/components/DashboardProcessTable.tsx:360:      {/* Dominant Alert — emphasized */}
src/modules/process/ui/components/DashboardProcessTable.tsx:364:            {dominantAlertLabel()}
src/modules/process/ui/components/DashboardProcessTable.tsx:367:            <AlertChipList
src/modules/process/ui/components/DashboardProcessTable.tsx:442:        <th class="px-3 py-2.5">{t(keys.dashboard.table.col.dominantAlert)}</th>
src/modules/process/ui/components/DashboardProcessTable.tsx:443:        <th class="px-3 py-2.5 text-center">{t(keys.dashboard.table.col.activeAlerts)}</th>
src/modules/process/ui/components/AlertsPanel.tsx:3:import { AlertsList } from '~/modules/process/ui/components/AlertsList'
src/modules/process/ui/components/AlertsPanel.tsx:4:import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
src/modules/process/ui/components/AlertsPanel.tsx:8:  activeAlerts: readonly AlertDisplayVM[]
src/modules/process/ui/components/AlertsPanel.tsx:9:  archivedAlerts: readonly AlertDisplayVM[]
src/modules/process/ui/components/AlertsPanel.tsx:10:  busyAlertIds: ReadonlySet<string>
src/modules/process/ui/components/AlertsPanel.tsx:11:  collapsingAlertIds: ReadonlySet<string>
src/modules/process/ui/components/AlertsPanel.tsx:16:export function AlertsPanel(props: Props): JSX.Element {
src/modules/process/ui/components/AlertsPanel.tsx:18:  const hasAnyAlert = () => props.activeAlerts.length > 0 || props.archivedAlerts.length > 0
src/modules/process/ui/components/AlertsPanel.tsx:22:      <Show when={props.activeAlerts.length > 0}>
src/modules/process/ui/components/AlertsPanel.tsx:24:          <AlertsList
src/modules/process/ui/components/AlertsPanel.tsx:25:            alerts={props.activeAlerts}
src/modules/process/ui/components/AlertsPanel.tsx:27:            busyAlertIds={props.busyAlertIds}
src/modules/process/ui/components/AlertsPanel.tsx:28:            collapsingAlertIds={props.collapsingAlertIds}
src/modules/process/ui/components/AlertsPanel.tsx:35:      <Show when={props.archivedAlerts.length > 0}>
src/modules/process/ui/components/AlertsPanel.tsx:38:            {t(keys.shipmentView.alerts.archived.title, { count: props.archivedAlerts.length })}
src/modules/process/ui/components/AlertsPanel.tsx:41:            <AlertsList
src/modules/process/ui/components/AlertsPanel.tsx:42:              alerts={props.archivedAlerts}
src/modules/process/ui/components/AlertsPanel.tsx:44:              busyAlertIds={props.busyAlertIds}
src/modules/process/ui/components/AlertsPanel.tsx:45:              collapsingAlertIds={new Set()}
src/modules/process/ui/components/AlertsPanel.tsx:53:      <Show when={!hasAnyAlert()}>
src/modules/process/ui/components/DashboardMetricsGrid.tsx:3:import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
src/modules/process/ui/components/DashboardMetricsGrid.tsx:8:  readonly summary: DashboardGlobalAlertsVM | null
src/modules/process/ui/components/DashboardMetricsGrid.tsx:82:      totalActiveAlerts: 0,
src/modules/process/ui/components/DashboardMetricsGrid.tsx:188:    if (safeSummary().totalActiveAlerts === 0) return 'empty'
src/modules/process/ui/components/DashboardMetricsGrid.tsx:247:              {summary.totalActiveAlerts}
src/modules/process/ui/components/OperationalSummaryStrip.tsx:32:function findLatestAlertTimestamp(alerts: ShipmentDetailVM['alerts']): string | null {
src/modules/process/ui/components/OperationalSummaryStrip.tsx:47:  const latestAlertTs = () => findLatestAlertTimestamp(props.alerts)
src/modules/process/ui/components/OperationalSummaryStrip.tsx:92:      {/* Alerts */}
src/modules/process/ui/components/OperationalSummaryStrip.tsx:101:              {t(keys.shipmentView.summaryStrip.noAlerts)}
src/modules/process/ui/components/OperationalSummaryStrip.tsx:117:          {formatAge(latestAlertTs(), t, keys)}
src/modules/process/ui/components/ShipmentHeader.tsx:24:  activeAlertCount: number
src/modules/process/ui/components/ShipmentHeader.tsx:413:          <Show when={props.activeAlertCount > 0}>
src/modules/process/ui/components/ShipmentHeader.tsx:416:              <span class="text-slate-500">{props.activeAlertCount}</span>
src/modules/process/ui/components/TimelinePanel.tsx:19:import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
src/modules/process/ui/components/TimelinePanel.tsx:29:  alerts?: readonly AlertDisplayVM[]
src/modules/process/ui/components/TimelinePanel.tsx:33:function alertTypeToEventTypes(alertType: AlertDisplayVM['type']): readonly string[] {
src/modules/process/ui/components/TimelinePanel.tsx:46:function buildHighlightedEventTypes(alerts: readonly AlertDisplayVM[]): ReadonlySet<string> {

```



# Search: redestination usage

Command executed:
```bash
rg -n "redestination" src
```

Output:
```

src/locales/pt-PT.json:379:      "redestinationNumber": "Número de Redestinação",
src/locales/pt-PT.json:380:      "redestinationNumberPlaceholder": "ex. RED-001"
src/locales/pt-BR.json:379:      "redestinationNumber": "Número de Redestinação",
src/locales/pt-BR.json:380:      "redestinationNumberPlaceholder": "ex. RED-001"
src/locales/en-US.json:368:      "redestinationNumber": "Redestination Number",
src/locales/en-US.json:369:      "redestinationNumberPlaceholder": "e.g. RED-001"
src/capabilities/search/infrastructure/persistence/supabaseSearchRepository.ts:29:  redestination_number: string | null
src/capabilities/search/infrastructure/persistence/supabaseSearchRepository.ts:88:    row.redestination_number,
src/capabilities/search/infrastructure/persistence/supabaseSearchRepository.ts:168:        'id, reference, carrier, bill_of_lading, booking_number, importer_name, exporter_name, reference_importer, product, redestination_number, origin, destination',
src/capabilities/search/infrastructure/persistence/supabaseSearchRepository.ts:179:          `redestination_number.ilike.${pattern}`,
src/shared/api-schemas/processes.schemas.ts:17:  redestination_number: z.string().nullish(),
src/shared/supabase/database.types.ts:250:          redestination_number: string | null
src/shared/supabase/database.types.ts:271:          redestination_number?: string | null
src/shared/supabase/database.types.ts:292:          redestination_number?: string | null
src/modules/process/domain/process.entity.ts:19:  redestinationNumber: string | null
src/modules/process/interface/http/process.http.mappers.ts:35:    redestination_number: dto.redestination_number ?? undefined,
src/modules/process/interface/http/process.http.mappers.ts:58:    ...(dto.redestination_number !== undefined
src/modules/process/interface/http/process.http.mappers.ts:59:      ? { redestination_number: dto.redestination_number ?? null }
src/modules/process/interface/http/process.http.mappers.ts:137:    redestination_number: p.redestinationNumber ?? null,
src/modules/process/application/process.records.ts:12:  redestination_number?: string | null
src/modules/process/application/process.records.ts:27:  redestination_number?: string | null
src/modules/process/interface/http/process.schemas.ts:32:  redestination_number: z.string().nullable().optional(),
src/modules/process/interface/http/tests/process.controllers.test.ts:73:    redestinationNumber: null,
src/modules/process/infrastructure/persistence/process.persistence.mappers.ts:31:      redestinationNumber:
src/modules/process/infrastructure/persistence/process.persistence.mappers.ts:32:        row.redestination_number == null ? null : String(row.redestination_number),
src/modules/process/infrastructure/persistence/process.persistence.mappers.ts:51:      redestination_number: record.redestination_number ?? null,
src/modules/process/infrastructure/persistence/process.persistence.mappers.ts:72:      ...(record.redestination_number !== undefined
src/modules/process/infrastructure/persistence/process.persistence.mappers.ts:73:        ? { redestination_number: record.redestination_number ?? null }
src/modules/process/ui/ShipmentView.tsx:892:    redestinationNumber: data.redestination_number ?? '',
src/modules/process/ui/CreateProcessDialog.view.tsx:41:  readonly redestinationNumber: string
src/modules/process/ui/CreateProcessDialog.view.tsx:108:          label={t(keys.createProcess.field.redestinationNumber)}
src/modules/process/ui/CreateProcessDialog.view.tsx:109:          name="redestinationNumber"
src/modules/process/ui/CreateProcessDialog.view.tsx:110:          value={props.redestinationNumber}
src/modules/process/ui/CreateProcessDialog.view.tsx:112:          placeholder={t(keys.createProcess.field.redestinationNumberPlaceholder)}
src/modules/process/ui/CreateProcessDialog.view.tsx:343:          redestinationNumber={props.form.redestinationNumber}
src/modules/process/ui/mappers/processList.ui-mapper.ts:33:  redestination_number?: string | null
src/modules/process/ui/mappers/processList.ui-mapper.ts:103:      redestinationNumber: process.redestination_number ?? null,
src/modules/process/ui/components/DashboardProcessTable.tsx:332:          <Show when={props.process.redestinationNumber}>
src/modules/process/ui/components/DashboardProcessTable.tsx:334:              {t(keys.dashboard.table.routeRedestination)}: {props.process.redestinationNumber}
src/modules/process/application/usecases/tests/search-processes-by-text.usecase.test.ts:35:    redestinationNumber: null,
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:141:  it('maps redestination_number to redestinationNumber', () => {
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:143:      makeSource({ id: 'p-redest', redestination_number: 'RD-12345' }),
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:145:    expect(result[0].redestinationNumber).toBe('RD-12345')
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:148:  it('defaults redestinationNumber to null when absent', () => {
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:150:    expect(result[0].redestinationNumber).toBeNull()
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:153:  it('normalizes null redestination_number to null', () => {
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:155:      makeSource({ id: 'p-null-redest', redestination_number: null }),
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:157:    expect(result[0].redestinationNumber).toBeNull()
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:211:    redestination_number: data.redestination_number,
src/modules/process/ui/validation/processApi.validation.ts:100:    redestination_number: data.redestinationNumber || null,
src/modules/process/ui/CreateProcessDialog.tsx:27:  redestinationNumber: string
src/modules/process/ui/CreateProcessDialog.tsx:67:  readonly redestinationNumber: string
src/modules/process/ui/CreateProcessDialog.tsx:118:  readonly redestinationNumber: string
src/modules/process/ui/CreateProcessDialog.tsx:174:  readonly redestinationNumber: Accessor<string>
src/modules/process/ui/CreateProcessDialog.tsx:237:    redestinationNumber: input.redestinationNumber,
src/modules/process/ui/CreateProcessDialog.tsx:389:  params.setters.setRedestinationNumber(data.redestinationNumber || '')
src/modules/process/ui/CreateProcessDialog.tsx:468:  const [redestinationNumber, setRedestinationNumber] = createSignal('')
src/modules/process/ui/CreateProcessDialog.tsx:495:    redestinationNumber,
src/modules/process/ui/CreateProcessDialog.tsx:674:    redestinationNumber: params.redestinationNumber,
src/modules/process/ui/CreateProcessDialog.tsx:719:    redestinationNumber: state.redestinationNumber(),
src/modules/process/ui/CreateProcessDialog.tsx:738:      redestinationNumber: params.state.redestinationNumber(),
src/modules/process/ui/viewmodels/process-summary.vm.ts:28:  readonly redestinationNumber?: string | null
src/modules/process/ui/viewmodels/shipment.vm.ts:88:  readonly redestination_number?: string | null

```



# Search: ETA usage

Command executed:
```bash
rg -n "ETA" src/modules
```

Output:
```

src/modules/tracking/AGENTS.md:62:- Use `observationRepository.listSearchObservations()` + tracking derivation (`deriveTimeline`/`deriveStatus`/operational summary) to keep status/ETA semantics canonical.
src/modules/tracking/domain/model/trackingAlert.ts:24:  /** ETA passed without arrival */
src/modules/tracking/domain/model/trackingAlert.ts:25:  | 'ETA_PASSED'
src/modules/tracking/domain/model/trackingAlert.ts:26:  /** ETA missing */
src/modules/tracking/domain/model/trackingAlert.ts:27:  | 'ETA_MISSING'
src/modules/tracking/infrastructure/carriers/tests/mscNormalizer.test.ts:349:          CurrentDate: '20/02/2026', // After the ETA
src/modules/tracking/infrastructure/carriers/tests/mscNormalizer.test.ts:355:                  PodEtaDate: '15/02/2026', // Past ETA
src/modules/tracking/domain/model/observation.ts:12: *           Can be used for ETA calculations and monitoring alerts,
src/modules/tracking/domain/model/observation.ts:57:   * - EXPECTED events are informational only (ETA, predictions)
src/modules/tracking/application/ports/tracking.observation.repository.ts:23:   * status/ETA already derived by Tracking BC.
src/modules/tracking/domain/identity/fingerprint.ts:23: *   An EXPECTED ETA and the later ACTUAL arrival are NOT the same fact.
src/modules/tracking/domain/derive/deriveAlerts.ts:109: *   - ETA_MISSING: no ETA-related data available
src/modules/tracking/infrastructure/persistence/tracking.persistence.mappers.ts:123:  ETA_PASSED: 'ETA_PASSED',
src/modules/tracking/infrastructure/persistence/tracking.persistence.mappers.ts:124:  ETA_MISSING: 'ETA_MISSING',
src/modules/tracking/application/projection/tracking.alert.projection.ts:29:    case 'ETA_MISSING':
src/modules/tracking/application/projection/tracking.alert.projection.ts:30:    case 'ETA_PASSED':
src/modules/tracking/infrastructure/carriers/schemas/api/cmacgm.api.schema.ts:5:  - Models moves (past/current/provisional) and top-level ETA / container reference
src/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer.ts:224:          // Determine if this ETA is in the future
src/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer.ts:234:              type: 'ARRIVAL', // ETA implies arrival at POD
src/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer.ts:242:              confidence: 'medium', // ETA is provisional
src/modules/tracking/application/projection/tracking.operational-alert-category.readmodel.ts:13:    case 'ETA_MISSING':
src/modules/tracking/application/projection/tracking.operational-alert-category.readmodel.ts:14:    case 'ETA_PASSED':
src/modules/tracking/application/projection/tracking.operational-summary.readmodel.ts:108:    // For operational ETA visibility we keep expired EXPECTED as fallback
src/modules/tracking/application/usecases/tests/search-tracking-by-vessel-name.usecase.test.ts:180:          vesselName: 'BETA VESSEL',
src/modules/tracking/application/projection/tests/tracking.operational-summary.readmodel.test.ts:25:  it('marks future EXPECTED ETA as ACTIVE_EXPECTED', () => {
src/modules/tracking/application/projection/tests/tracking.operational-summary.readmodel.test.ts:43:  it('marks past EXPECTED ETA as EXPIRED_EXPECTED', () => {
src/modules/tracking/application/projection/tests/tracking.operational-summary.readmodel.test.ts:119:  it('returns null ETA when no arrival/discharge/delivery series exist', () => {
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:72:        type: 'ETA_PASSED',
src/modules/tracking/application/usecases/tests/list-active-alert-read-model.usecase.test.ts:101:        type: 'ETA_PASSED',
src/modules/process/application/operational-projection/tests/aggregateOperationalSummary.test.ts:60:  it('selects earliest future ETA among containers', () => {
src/modules/process/application/operational-projection/tests/aggregateOperationalSummary.test.ts:79:  it('returns null ETA when no future events', () => {
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:214:  // --- ETA ---
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:215:  // Select earliest future ETA among containers
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:301:    // Calculate 'now' once for consistent ETA comparison across all processes
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:205:  it('sorts ETA by etaMsOrNull and keeps null values at the end in both directions', () => {
src/modules/process/ui/utils/tests/eta-labels.test.ts:14:  expectedPrefix: 'ETA',
src/modules/process/ui/utils/tests/eta-labels.test.ts:15:  noEta: 'ETA —',
src/modules/process/ui/utils/tests/eta-labels.test.ts:26:  expectedPrefix: 'ETA',
src/modules/process/ui/utils/tests/eta-labels.test.ts:28:  missing: 'ETA —',
src/modules/process/ui/utils/tests/eta-labels.test.ts:32:  it('renders selected ETA title for ACTUAL', () => {
src/modules/process/ui/utils/tests/eta-labels.test.ts:44:  it('renders selected ETA title/subtitle for ACTIVE_EXPECTED', () => {
src/modules/process/ui/utils/tests/eta-labels.test.ts:52:    expect(toSelectedEtaTitle(selectedEta, headerTitleLabels)).toBe('ETA 08/03')
src/modules/process/ui/utils/tests/eta-labels.test.ts:56:  it('renders selected ETA title/subtitle for EXPIRED_EXPECTED', () => {
src/modules/process/ui/utils/tests/eta-labels.test.ts:64:    expect(toSelectedEtaTitle(selectedEta, headerTitleLabels)).toBe('ETA 01/03')
src/modules/process/ui/utils/tests/eta-labels.test.ts:68:  it('renders missing selected ETA as ETA dash', () => {
src/modules/process/ui/utils/tests/eta-labels.test.ts:71:    expect(toSelectedEtaTitle(selectedEta, headerTitleLabels)).toBe('ETA —')
src/modules/process/ui/utils/tests/eta-labels.test.ts:75:  it('renders container chips for all ETA states', () => {
src/modules/process/ui/utils/tests/eta-labels.test.ts:98:    expect(toContainerEtaChipLabel(activeExpectedChip, chipLabels)).toBe('ETA 08/03')
src/modules/process/ui/utils/tests/eta-labels.test.ts:99:    expect(toContainerEtaChipLabel(expiredExpectedChip, chipLabels)).toBe('ETA 05/03 · Atrasado')
src/modules/process/ui/utils/tests/eta-labels.test.ts:100:    expect(toContainerEtaChipLabel(missingChip, chipLabels)).toBe('ETA —')
src/modules/process/ui/components/OperationalSummaryStrip.tsx:72:      {/* ETA */}
src/modules/process/ui/components/TimelineNode.tsx:195:    // ETA chip removed: render expected date on the right instead.
src/modules/process/ui/components/ShipmentHeader.tsx:400:      {/* Row 2: Process-level ETA summary + containers/alerts count */}
src/modules/process/ui/components/ContainerSelector.tsx:45:/** Status codes for which ETA is no longer meaningful */
src/modules/process/ui/components/ContainerSelector.tsx:106:        {/* Row 2: ETA / TS / Data chips */}
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:217:  it('maps ETA and transshipment operational chips for multi-container view', () => {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:349:  it('marks process ETA coverage as complete when all containers have ETA', () => {

```



# Search: eta usage in process UI

Command executed:
```bash
rg -n "eta" src/modules/process/ui
```

Output:
```

src/modules/process/ui/ShipmentView.tsx:30:  ContainerEtaDetailVM,
src/modules/process/ui/ShipmentView.tsx:31:  ShipmentDetailVM,
src/modules/process/ui/ShipmentView.tsx:42:type ShipmentContainer = ShipmentDetailVM['containers'][number]
src/modules/process/ui/ShipmentView.tsx:182:  readonly data: ShipmentDetailVM | null | undefined
src/modules/process/ui/ShipmentView.tsx:216:  readonly current: ShipmentDetailVM | null | undefined
src/modules/process/ui/ShipmentView.tsx:217:  readonly apply: (next: ShipmentDetailVM) => void
src/modules/process/ui/ShipmentView.tsx:227:  // Keep non-tracking process metadata and update only fields derived from tracking.
src/modules/process/ui/ShipmentView.tsx:232:    eta: latest.eta,
src/modules/process/ui/ShipmentView.tsx:653:  readonly shipmentData: ShipmentDetailVM | null | undefined
src/modules/process/ui/ShipmentView.tsx:669:  readonly selectedContainerEtaVm: ContainerEtaDetailVM
src/modules/process/ui/ShipmentView.tsx:671:    shipment: ShipmentDetailVM,
src/modules/process/ui/ShipmentView.tsx:678:  readonly data: ShipmentDetailVM
src/modules/process/ui/ShipmentView.tsx:876:function toEditInitialData(data: ShipmentDetailVM): CreateProcessDialogFormData {
src/modules/process/ui/ShipmentView.tsx:929:    shipmentData: ShipmentDetailVM,
src/modules/process/ui/ShipmentView.tsx:995:    shipmentData: ShipmentDetailVM,
src/modules/process/ui/ShipmentView.tsx:1223:  const selectedContainerEtaVm = createMemo<ContainerEtaDetailVM>(() => {
src/modules/process/ui/mappers/processList.ui-mapper.ts:28:  eta?: string | null
src/modules/process/ui/mappers/processList.ui-mapper.ts:69:    const eta = process.eta ?? null
src/modules/process/ui/mappers/processList.ui-mapper.ts:98:      eta,
src/modules/process/ui/mappers/processList.ui-mapper.ts:99:      etaMsOrNull: toTimestampOrNull(eta),
src/modules/process/ui/validation/dashboardSortQuery.validation.ts:27:    case 'eta':
src/modules/process/ui/TimelineNode.layout.tsx:28:  readonly etaChipLabel?: string | null
src/modules/process/ui/TimelineNode.layout.tsx:38:  const showInlineEta = createMemo(() => props.etaChipLabel && !isFuture())
src/modules/process/ui/TimelineNode.layout.tsx:39:  const showEtaBelow = createMemo(() => props.etaChipLabel && isFuture())
src/modules/process/ui/TimelineNode.layout.tsx:94:              <Show when={showInlineEta() && props.etaChipLabel}>
src/modules/process/ui/TimelineNode.layout.tsx:95:                {(etaChipLabel) => <EtaChip label={etaChipLabel()} />}
src/modules/process/ui/TimelineNode.layout.tsx:141:            <Show when={showEtaBelow() && props.etaChipLabel}>
src/modules/process/ui/TimelineNode.layout.tsx:142:              {(etaChipLabel) => (
src/modules/process/ui/TimelineNode.layout.tsx:144:                  <EtaChip label={etaChipLabel()} />
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:14:import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:20:import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:36:type ContainerOperational = NonNullable<ProcessDetailResponse['containers'][number]['operational']>
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:37:type OperationalEta = NonNullable<ContainerOperational['eta']>
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:42:): ShipmentDetailVM['containers'][number]['etaChipVm']['tone'] {
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:54:  eta: ContainerOperational['eta'] | undefined,
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:56:): ShipmentDetailVM['containers'][number]['etaChipVm'] {
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:57:  if (!eta?.event_time) {
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:66:    state: eta.state,
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:67:    tone: toEtaTone(eta.state),
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:68:    date: formatDateForLocale(eta.event_time, locale),
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:72:function toContainerEtaDetailVm(
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:73:  eta: ContainerOperational['eta'] | undefined,
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:75:): ShipmentDetailVM['containers'][number]['selectedEtaVm'] {
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:76:  if (!eta?.event_time) return null
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:79:    state: eta.state,
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:80:    tone: toEtaTone(eta.state),
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:81:    date: formatDateForLocale(eta.event_time, locale),
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:82:    type: eta.type,
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:88:): ShipmentDetailVM['containers'][number]['transshipment'] {
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:108:  transshipment: ShipmentDetailVM['containers'][number]['transshipment'],
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:109:): ShipmentDetailVM['containers'][number]['tsChipVm'] {
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:125:  data: ProcessDetailResponse,
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:126:  containers: readonly ShipmentDetailVM['containers'][number][],
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:128:): ShipmentDetailVM['processEtaSecondaryVm'] {
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:131:    data.process_operational?.coverage.with_eta ?? containers.filter((c) => c.selectedEtaVm).length
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:132:  const etaMax = data.process_operational?.eta_max ?? null
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:136:    date: etaMax?.event_time ? formatDateForLocale(etaMax.event_time, locale) : null,
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:143:export function toShipmentDetailVM(
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:144:  data: ProcessDetailResponse,
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:146:): ShipmentDetailVM {
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:171:    const etaChipVm = toContainerEtaChipVm(container.operational?.eta, locale)
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:172:    const selectedEtaVm = toContainerEtaDetailVm(container.operational?.eta, locale)
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:185:      eta: null,
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:186:      etaChipVm,
src/modules/process/ui/mappers/processDetail.ui-mapper.ts:220:    eta: processEtaSecondaryVm.date,
src/modules/process/ui/mappers/dashboardProcessExceptions.ui-mapper.ts:32:      etaCurrent: process.eta_current,
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:3:  ContainerDetailVM,
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:7:import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:12:type ContainerSyncDTO = ProcessDetailResponse['containersSync'][number]
src/modules/process/ui/mappers/containerSync.ui-mapper.ts:148:  readonly containers: readonly Pick<ContainerDetailVM, 'number' | 'carrierCode' | 'sync'>[]
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:61:        eta: '2025-06-01T00:00:00Z',
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:75:    expect(result[0].eta).toBe('2025-06-01T00:00:00Z')
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:76:    expect(result[0].etaMsOrNull).toBe(Date.parse('2025-06-01T00:00:00Z'))
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:90:    expect(result[0].eta).toBeNull()
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:91:    expect(result[0].etaMsOrNull).toBeNull()
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:100:  it('maps sync metadata to dashboard sync visual states', () => {
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:124:  it('maps invalid eta string to etaMsOrNull = null', () => {
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:125:    const result = toProcessSummaryVMs([makeSource({ id: 'p7', eta: 'not-a-date' })])
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:126:    expect(result[0].eta).toBe('not-a-date')
src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts:127:    expect(result[0].etaMsOrNull).toBeNull()
src/modules/process/ui/validation/tests/dashboardSortQuery.validation.test.ts:61:      sortField: 'eta',
src/modules/process/ui/validation/tests/dashboardSortQuery.validation.test.ts:203:      { field: 'eta', direction: 'desc' },
src/modules/process/ui/validation/tests/dashboardSortQuery.validation.test.ts:207:    expect(result.get('sortField')).toBe('eta')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:2:import { toShipmentDetailVM } from '~/modules/process/ui/mappers/processDetail.ui-mapper'
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:3:import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:5:describe('toShipmentDetailVM', () => {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:6:  it('maps a minimal API payload into shipment detail view model', () => {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:7:    const example: ProcessDetailResponse = {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:48:    const result = toShipmentDetailVM(example)
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:61:    expect(result.containers[0].etaChipVm.state).toBe('UNAVAILABLE')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:69:    const example: ProcessDetailResponse = {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:105:    const result = toShipmentDetailVM(example)
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:116:  it('maps container sync metadata by normalized container number', () => {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:117:    const example: ProcessDetailResponse = {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:149:    const result = toShipmentDetailVM(example, 'en-US')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:155:    const example: ProcessDetailResponse = {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:182:    const result = toShipmentDetailVM(example)
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:188:    const example: ProcessDetailResponse = {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:209:    const result = toShipmentDetailVM(example)
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:216:describe('toShipmentDetailVM operational mapping', () => {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:218:    const example: ProcessDetailResponse = {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:235:            eta: {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:261:            eta: {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:281:        eta_max: {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:291:          with_eta: 1,
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:296:    const result = toShipmentDetailVM(example, 'pt-BR')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:298:    expect(result.containers[0].etaChipVm.state).toBe('EXPIRED_EXPECTED')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:310:    const example: ProcessDetailResponse = {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:327:            eta: null,
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:344:    const result = toShipmentDetailVM(example, 'pt-BR')
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:350:    const example: ProcessDetailResponse = {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:367:            eta: {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:390:            eta: {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:410:        eta_max: {
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:420:          with_eta: 2,
src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts:425:    const result = toShipmentDetailVM(example, 'pt-BR')
src/modules/process/ui/mappers/tests/container-chip-sync-state.test.ts:6:import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
src/modules/process/ui/mappers/tests/container-chip-sync-state.test.ts:8:type ContainerSyncDTO = ProcessDetailResponse['containersSync'][number]
src/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper.ts:16:      eta: source.by_category.eta,
src/modules/process/ui/telemetry/dashboardSort.telemetry.ts:26:  window.dispatchEvent(new CustomEvent(eventName, { detail: payload }))
src/modules/process/ui/mappers/tests/dashboardProcessExceptions.ui-mapper.test.ts:15:        eta: 1,
src/modules/process/ui/mappers/tests/dashboardProcessExceptions.ui-mapper.test.ts:28:          eta_current: '2026-03-10T10:00:00.000Z',
src/modules/process/ui/mappers/tests/dashboardProcessExceptions.ui-mapper.test.ts:38:          eta_current: null,
src/modules/process/ui/mappers/tests/dashboardProcessExceptions.ui-mapper.test.ts:53:        etaCurrent: '2026-03-10T10:00:00.000Z',
src/modules/process/ui/mappers/tests/dashboardProcessExceptions.ui-mapper.test.ts:64:        etaCurrent: null,
src/modules/process/ui/fetchProcess.ts:1:import { toShipmentDetailVM } from '~/modules/process/ui/mappers/processDetail.ui-mapper'
src/modules/process/ui/fetchProcess.ts:2:import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
src/modules/process/ui/fetchProcess.ts:4:import { ProcessDetailResponseSchema } from '~/shared/api-schemas/processes.schemas'
src/modules/process/ui/fetchProcess.ts:9:): Promise<ShipmentDetailVM | null> {
src/modules/process/ui/fetchProcess.ts:11:    const data = await typedFetch(`/api/processes/${id}`, undefined, ProcessDetailResponseSchema)
src/modules/process/ui/fetchProcess.ts:12:    return toShipmentDetailVM(data, locale)
src/modules/process/ui/components/DashboardProcessTable.tsx:129:function displayEta(eta: string | null): string {
src/modules/process/ui/components/DashboardProcessTable.tsx:130:  if (!eta) return '—'
src/modules/process/ui/components/DashboardProcessTable.tsx:131:  return formatDateForLocale(eta)
src/modules/process/ui/components/DashboardProcessTable.tsx:153:type AlertCategoryChip = 'eta' | 'movement' | 'data' | 'customs'
src/modules/process/ui/components/DashboardProcessTable.tsx:158:    cats.push('eta')
src/modules/process/ui/components/DashboardProcessTable.tsx:172:  eta: '⏱',
src/modules/process/ui/components/DashboardProcessTable.tsx:346:        <Show when={props.process.eta} fallback={<span class="text-[14px] text-slate-300">—</span>}>
src/modules/process/ui/components/DashboardProcessTable.tsx:348:            {displayEta(props.process.eta)}
src/modules/process/ui/components/DashboardProcessTable.tsx:406:  const etaSortDirection = () => getActiveDashboardSortDirection(props.sortSelection, 'eta')
src/modules/process/ui/components/DashboardProcessTable.tsx:432:        <th class="px-3 py-2.5 text-right" aria-sort={toAriaSort(etaSortDirection())}>
src/modules/process/ui/components/DashboardProcessTable.tsx:434:            field="eta"
src/modules/process/ui/components/DashboardProcessTable.tsx:435:            label={t(keys.dashboard.table.col.eta)}
src/modules/process/ui/components/DashboardProcessTable.tsx:436:            direction={etaSortDirection()}
src/modules/process/ui/mappers/tests/dashboardGlobalAlerts.ui-mapper.test.ts:15:        eta: 6,
src/modules/process/ui/mappers/tests/dashboardGlobalAlerts.ui-mapper.test.ts:32:        eta: 6,
src/modules/process/ui/viewmodels/dashboard-process-exception.vm.ts:13:  readonly etaCurrent: string | null
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:107:    <details class="group relative w-full" data-testid={props.testId}>
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:133:    </details>
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:227:    const detailsElement = event.currentTarget.closest('details')
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:228:    if (detailsElement instanceof HTMLDetailsElement) {
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:229:      detailsElement.open = false
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:234:    <details class="group relative w-full" data-testid={props.testId}>
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:272:    </details>
src/modules/process/ui/utils/sync-realtime-coordinator.ts:3:import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
src/modules/process/ui/utils/sync-realtime-coordinator.ts:31:  readonly shipment: Accessor<ShipmentDetailVM | null | undefined>
src/modules/process/ui/viewmodels/dashboard-global-alerts.vm.ts:10:    readonly eta: number
src/modules/process/ui/utils/eta-labels.ts:3:  ContainerEtaDetailVM,
src/modules/process/ui/utils/eta-labels.ts:26:  selectedEta: ContainerEtaDetailVM,
src/modules/process/ui/utils/eta-labels.ts:37:  selectedEta: ContainerEtaDetailVM,
src/modules/process/ui/utils/eta-labels.ts:47:  etaChip: ContainerEtaChipVM,
src/modules/process/ui/utils/eta-labels.ts:50:  if (etaChip.state === 'UNAVAILABLE') {
src/modules/process/ui/utils/eta-labels.ts:54:  const datePart = etaChip.date ? ` ${etaChip.date}` : ''
src/modules/process/ui/utils/eta-labels.ts:56:  if (etaChip.state === 'ACTUAL') {
src/modules/process/ui/utils/eta-labels.ts:60:  if (etaChip.state === 'EXPIRED_EXPECTED') {
src/modules/process/ui/components/DashboardMetricsGrid.tsx:90:        eta: 0,
src/modules/process/ui/components/DashboardMetricsGrid.tsx:126:      key: 'eta',
src/modules/process/ui/components/DashboardMetricsGrid.tsx:127:      label: t(keys.dashboard.alertIndicators.category.eta),
src/modules/process/ui/components/DashboardMetricsGrid.tsx:128:      value: safeSummary().byCategory.eta,
src/modules/process/ui/viewmodels/process-summary.vm.ts:23:  readonly eta: string | null
src/modules/process/ui/viewmodels/process-summary.vm.ts:24:  readonly etaMsOrNull: number | null
src/modules/process/ui/utils/tests/eta-labels.test.ts:6:} from '~/modules/process/ui/utils/eta-labels'
src/modules/process/ui/utils/tests/eta-labels.test.ts:9:  ContainerEtaDetailVM,
src/modules/process/ui/utils/tests/eta-labels.test.ts:31:describe('eta labels', () => {
src/modules/process/ui/utils/tests/eta-labels.test.ts:33:    const selectedEta: ContainerEtaDetailVM = {
src/modules/process/ui/utils/tests/eta-labels.test.ts:45:    const selectedEta: ContainerEtaDetailVM = {
src/modules/process/ui/utils/tests/eta-labels.test.ts:57:    const selectedEta: ContainerEtaDetailVM = {
src/modules/process/ui/utils/tests/eta-labels.test.ts:69:    const selectedEta: ContainerEtaDetailVM = null
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:14:    readonly eta?: string | null
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:15:    readonly etaMsOrNull?: number | null
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:31:    eta: input.eta ?? null,
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:32:    etaMsOrNull: input.etaMsOrNull ?? null,
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:61:        id: 'filled-beta',
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:62:        importerName: 'Beta',
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:83:    expect(ascIds).toEqual(['filled-alpha', 'filled-beta', 'missing-empty', 'missing-null'])
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:84:    expect(descIds).toEqual(['missing-empty', 'missing-null', 'filled-beta', 'filled-alpha'])
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:96:        id: 'filled-zeta',
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:97:        carrier: 'Zeta',
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:118:    expect(ascIds).toEqual(['filled-alpha', 'filled-zeta', 'missing-empty', 'missing-null'])
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:119:    expect(descIds).toEqual(['missing-empty', 'missing-null', 'filled-zeta', 'filled-alpha'])
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:175:  it('keeps null eta values at the end in both directions', () => {
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:177:      createProcess({ id: 'missing-eta', reference: 'REF-1', etaMsOrNull: null }),
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:178:      createProcess({ id: 'eta-old', reference: 'REF-2', etaMsOrNull: 1735689600000 }),
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:179:      createProcess({ id: 'eta-new', reference: 'REF-3', etaMsOrNull: 1740787200000 }),
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:182:    const ascIds = sortIds(baseline, 'eta', 'asc')
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:183:    const descIds = sortIds(baseline, 'eta', 'desc')
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:185:    expect(ascIds).toEqual(['eta-old', 'eta-new', 'missing-eta'])
src/modules/process/ui/viewmodels/tests/dashboard-sort-null-policy.vm.test.ts:186:    expect(descIds).toEqual(['eta-new', 'eta-old', 'missing-eta'])
src/modules/process/ui/viewmodels/alert.vm.ts:3:  readonly type: 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'
src/modules/process/ui/components/OperationalSummaryStrip.tsx:4:import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
src/modules/process/ui/components/OperationalSummaryStrip.tsx:9:  readonly data: ShipmentDetailVM
src/modules/process/ui/components/OperationalSummaryStrip.tsx:10:  readonly alerts: ShipmentDetailVM['alerts']
src/modules/process/ui/components/OperationalSummaryStrip.tsx:32:function findLatestAlertTimestamp(alerts: ShipmentDetailVM['alerts']): string | null {
src/modules/process/ui/components/OperationalSummaryStrip.tsx:75:          {t(keys.shipmentView.summaryStrip.eta)}
src/modules/process/ui/components/OperationalSummaryStrip.tsx:78:          {props.data.eta ?? t(keys.shipmentView.summaryStrip.unknown)}
src/modules/process/ui/viewmodels/shipment.vm.ts:15:export type ContainerEtaDetailVM = {
src/modules/process/ui/viewmodels/shipment.vm.ts:53:export type ContainerDetailVM = {
src/modules/process/ui/viewmodels/shipment.vm.ts:60:  readonly eta: string | null
src/modules/process/ui/viewmodels/shipment.vm.ts:61:  readonly etaChipVm: ContainerEtaChipVM
src/modules/process/ui/viewmodels/shipment.vm.ts:62:  readonly selectedEtaVm: ContainerEtaDetailVM
src/modules/process/ui/viewmodels/shipment.vm.ts:77:export type ShipmentDetailVM = {
src/modules/process/ui/viewmodels/shipment.vm.ts:95:  readonly eta: string | null
src/modules/process/ui/viewmodels/shipment.vm.ts:97:  readonly containers: readonly ContainerDetailVM[]
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:25:    readonly eta?: string | null
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:26:    readonly etaMsOrNull?: number | null
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:30:  const eta = input.eta ?? null
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:31:  const etaMsOrNull = input.etaMsOrNull ?? toTimestampOrNull(eta)
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:45:    eta,
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:46:    etaMsOrNull,
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:106:    expect(nextDashboardSortSelection(activeProvider, 'eta')).toEqual({
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:107:      field: 'eta',
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:132:      createProcess({ id: 'A', importerName: 'Zeta' }),
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:167:      createProcess({ id: 'A', carrier: 'zeta' }),
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:205:  it('sorts ETA by etaMsOrNull and keeps null values at the end in both directions', () => {
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:207:      createProcess({ id: 'A', eta: '2025-03-01T00:00:00.000Z', etaMsOrNull: 1740787200000 }),
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:208:      createProcess({ id: 'B', eta: null, etaMsOrNull: null }),
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:209:      createProcess({ id: 'C', eta: '2025-02-01T00:00:00.000Z', etaMsOrNull: 1738368000000 }),
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:212:    const ascResult = sortDashboardProcesses(baseline, { field: 'eta', direction: 'asc' })
src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts:213:    const descResult = sortDashboardProcesses(baseline, { field: 'eta', direction: 'desc' })
src/modules/process/ui/components/ContainerSelector.tsx:5:import { toContainerEtaChipLabel } from '~/modules/process/ui/utils/eta-labels'
src/modules/process/ui/components/ContainerSelector.tsx:6:import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
src/modules/process/ui/components/ContainerSelector.tsx:12:function etaChipClass(tone: ContainerDetailVM['etaChipVm']['tone'], selected: boolean): string {
src/modules/process/ui/components/ContainerSelector.tsx:30:  readonly etaArrived: string
src/modules/process/ui/components/ContainerSelector.tsx:31:  readonly etaExpectedPrefix: string
src/modules/process/ui/components/ContainerSelector.tsx:32:  readonly etaDelayed: string
src/modules/process/ui/components/ContainerSelector.tsx:33:  readonly etaMissing: string
src/modules/process/ui/components/ContainerSelector.tsx:58:  readonly container: ContainerDetailVM
src/modules/process/ui/components/ContainerSelector.tsx:110:              data-testid={`container-eta-chip-${props.container.id}`}
src/modules/process/ui/components/ContainerSelector.tsx:111:              class={`inline-flex rounded px-1 py-px text-[9px] font-medium leading-none ${etaChipClass(
src/modules/process/ui/components/ContainerSelector.tsx:112:                props.container.etaChipVm.tone,
src/modules/process/ui/components/ContainerSelector.tsx:116:              {toContainerEtaChipLabel(props.container.etaChipVm, {
src/modules/process/ui/components/ContainerSelector.tsx:117:                arrived: props.labels.etaArrived,
src/modules/process/ui/components/ContainerSelector.tsx:118:                expectedPrefix: props.labels.etaExpectedPrefix,
src/modules/process/ui/components/ContainerSelector.tsx:119:                delayed: props.labels.etaDelayed,
src/modules/process/ui/components/ContainerSelector.tsx:120:                missing: props.labels.etaMissing,
src/modules/process/ui/components/ContainerSelector.tsx:163:  containers: readonly ContainerDetailVM[]
src/modules/process/ui/components/ContainerSelector.tsx:170:    etaArrived: t(keys.shipmentView.operational.chips.etaArrived),
src/modules/process/ui/components/ContainerSelector.tsx:171:    etaExpectedPrefix: t(keys.shipmentView.operational.chips.etaExpected),
src/modules/process/ui/components/ContainerSelector.tsx:172:    etaDelayed: t(keys.shipmentView.operational.header.selectedExpectedDelayed),
src/modules/process/ui/components/ContainerSelector.tsx:173:    etaMissing: t(keys.shipmentView.operational.chips.etaMissing),
src/modules/process/ui/components/AlertsPanel.tsx:36:        <details class="rounded-lg border border-slate-200 bg-slate-50/80 p-1.5">
src/modules/process/ui/components/AlertsPanel.tsx:50:        </details>
src/modules/process/ui/components/TimelinePanel.tsx:20:import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
src/modules/process/ui/components/TimelinePanel.tsx:26:  selectedContainer: ContainerDetailVM | null
src/modules/process/ui/components/TimelinePanel.tsx:56:function deriveCurrentVessel(container: ContainerDetailVM | null): string | null {
src/modules/process/ui/components/TimelinePanel.tsx:75:function derivePortsRoute(container: ContainerDetailVM | null): string | null {
src/modules/process/ui/components/TimelinePanel.tsx:125:  container: ContainerDetailVM
src/modules/process/ui/viewmodels/tests/dashboard-filter-interaction.vm.test.ts:35:    eta: null,
src/modules/process/ui/viewmodels/tests/dashboard-filter-interaction.vm.test.ts:36:    etaMsOrNull: null,
src/modules/process/ui/viewmodels/tests/dashboard-filter-interaction.vm.test.ts:303:        importerName: 'Empresa Beta',
src/modules/process/ui/components/ShipmentInfoCard.tsx:3:import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
src/modules/process/ui/components/ShipmentInfoCard.tsx:8:  readonly data: ShipmentDetailVM
src/modules/process/ui/components/AlertsList.tsx:7:type AlertCategoryChipType = 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'
src/modules/process/ui/components/AlertsList.tsx:17:    case 'missing-eta':
src/modules/process/ui/components/AlertsList.tsx:18:      return t(keys.shipmentView.alerts.category.eta)
src/modules/process/ui/components/AlertsList.tsx:31:    case 'missing-eta':
src/modules/process/ui/components/ContainersPanel.tsx:3:import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
src/modules/process/ui/components/ContainersPanel.tsx:8:  containers: readonly ContainerDetailVM[]
src/modules/process/ui/components/TimelineNode.tsx:194:  const etaChipLabel = createMemo(() => {
src/modules/process/ui/components/TimelineNode.tsx:218:        etaChipLabel={etaChipLabel()}
src/modules/process/ui/viewmodels/dashboard-sort.vm.ts:6:  'eta',
src/modules/process/ui/components/Icons.tsx:73:      case 'missing-eta':
src/modules/process/ui/components/Icons.tsx:82:  // Clock icon for delay / missing-eta
src/modules/process/ui/components/Icons.tsx:96:      case 'missing-eta':
src/modules/process/ui/components/ShipmentHeader.tsx:10:import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
src/modules/process/ui/components/ShipmentHeader.tsx:16:  data: ShipmentDetailVM
src/modules/process/ui/components/ShipmentHeader.tsx:231:  readonly processEtaSecondaryVm: ShipmentDetailVM['processEtaSecondaryVm']
src/modules/process/ui/components/ShipmentHeader.tsx:239:        data-testid="process-eta-summary"
src/modules/process/ui/components/ShipmentHeader.tsx:243:        <span data-testid="process-eta-date" class="font-medium text-slate-500">
src/modules/process/ui/components/ShipmentHeader.tsx:246:        <span data-testid="process-eta-coverage" class="tabular-nums text-slate-400">
src/modules/process/ui/components/ShipmentHeader.tsx:251:            data-testid="process-eta-incomplete"
src/modules/process/ui/viewmodels/dashboard-sort-interaction.vm.ts:136:    case 'eta':
src/modules/process/ui/viewmodels/dashboard-sort-interaction.vm.ts:137:      return compareNullableDateValues(left.etaMsOrNull, right.etaMsOrNull, direction)

```



# Search: small typography usage

Command executed:
```bash
rg -n "text-\[(10|11|12|13|14)px\]" src/modules/process/ui
```

Output:
```

src/modules/process/ui/TimelineNode.layout.tsx:98:              <p class={`text-[12px] leading-tight ${props.textClass}`}>{props.label}</p>
src/modules/process/ui/TimelineNode.layout.tsx:151:                <p class="mt-px text-[10px] leading-tight text-gray-500 truncate">{location()}</p>
src/modules/process/ui/ShipmentView.tsx:818:          class="mb-1.5 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700"
src/modules/process/ui/timeline/TimelineBlocks.tsx:35:        <span class="text-[13px] font-semibold text-slate-900">
src/modules/process/ui/timeline/TimelineBlocks.tsx:41:          <p class="mt-0.5 text-[10px] font-medium text-slate-500">
src/modules/process/ui/timeline/TimelineBlocks.tsx:47:        {(routeStr) => <p class="mt-0.5 text-[10px] text-slate-500">{routeStr()}</p>}
src/modules/process/ui/timeline/TimelineBlocks.tsx:90:        <span class="text-[12px] font-semibold text-slate-700">{title()}</span>
src/modules/process/ui/timeline/TimelineBlocks.tsx:93:        {(loc) => <p class="mt-0.5 text-[10px] text-slate-400">{loc()}</p>}
src/modules/process/ui/timeline/TimelineBlocks.tsx:112:        <span class="text-[12px] font-semibold text-amber-900">
src/modules/process/ui/timeline/TimelineBlocks.tsx:117:        {(port) => <p class="mt-0.5 text-[10px] font-medium text-amber-800">{port()}</p>}
src/modules/process/ui/timeline/TimelineBlocks.tsx:120:        {(reason) => <p class="mt-0.5 text-[10px] text-amber-700">{reason()}</p>}
src/modules/process/ui/timeline/TimelineBlocks.tsx:150:      <p class="text-[10px] italic text-slate-600">⏳ {label()}</p>
src/modules/process/ui/timeline/TimelineBlocks.tsx:200:        <span class="text-[10px]" aria-hidden="true">
src/modules/process/ui/timeline/TimelineBlocks.tsx:203:        <p class="text-[10px] font-medium">{label()}</p>
src/modules/process/ui/components/AlertsList.tsx:139:                    class={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none ${toSeverityBadgeClasses(alert.severity, props.mode)}`}
src/modules/process/ui/components/AlertsList.tsx:144:                  <span class="text-[10px] font-medium tabular-nums text-slate-500">
src/modules/process/ui/components/AlertsList.tsx:148:                <p class="mt-0.5 text-[11px] leading-tight text-slate-600">{alert.message}</p>
src/modules/process/ui/components/AlertsList.tsx:156:                    class="inline-flex h-6 items-center justify-center rounded border border-slate-300 bg-white px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
src/modules/process/ui/components/AlertsPanel.tsx:37:          <summary class="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wider text-slate-500">
src/modules/process/ui/components/AlertsPanel.tsx:54:        <div class="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-500">
src/modules/process/ui/components/DashboardProcessTable.tsx:87:        class="inline-flex h-4 w-4 items-center justify-center text-[11px] leading-none text-slate-600"
src/modules/process/ui/components/DashboardProcessTable.tsx:216:          <span class="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-slate-500">
src/modules/process/ui/components/DashboardProcessTable.tsx:223:        <span class="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-slate-400">
src/modules/process/ui/components/DashboardProcessTable.tsx:301:              <span class="text-[11px] text-slate-400">{severityLabel()}</span>
src/modules/process/ui/components/DashboardProcessTable.tsx:307:              class={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide leading-none ${toSeverityBadgeClasses(
src/modules/process/ui/components/DashboardProcessTable.tsx:313:            <span class="text-[10px] font-medium tabular-nums text-slate-500">{ageLabel()}</span>
src/modules/process/ui/components/DashboardProcessTable.tsx:320:          class="text-[14px] font-semibold text-slate-900 hover:text-blue-600 hover:underline"
src/modules/process/ui/components/DashboardProcessTable.tsx:327:          <div class="flex items-center gap-1.5 text-[14px] text-slate-700">
src/modules/process/ui/components/DashboardProcessTable.tsx:333:            <span class="text-[12px] text-slate-400">
src/modules/process/ui/components/DashboardProcessTable.tsx:346:        <Show when={props.process.eta} fallback={<span class="text-[14px] text-slate-300">—</span>}>
src/modules/process/ui/components/DashboardProcessTable.tsx:347:          <span class="text-[14px] font-bold tabular-nums text-slate-600">
src/modules/process/ui/components/DashboardProcessTable.tsx:363:          <span class="text-[14px] font-medium text-slate-900 truncate max-w-[180px]">
src/modules/process/ui/components/DashboardProcessTable.tsx:376:        <span class="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 px-1.5 text-[11px] font-bold tabular-nums text-slate-700">
src/modules/process/ui/components/DashboardProcessTable.tsx:392:        <span class={`text-[10px] font-bold uppercase tracking-wider ${props.labelClass}`}>
src/modules/process/ui/components/DashboardProcessTable.tsx:413:      <tr class="border-b border-slate-200 text-left text-[12px] font-semibold uppercase tracking-wider text-slate-400">
src/modules/process/ui/components/DashboardProcessTable.tsx:511:        <div class="px-4 py-8 text-center text-[14px] text-slate-400">
src/modules/process/ui/components/DashboardProcessTable.tsx:519:        <div class="px-4 py-8 text-center text-[14px] text-red-500">
src/modules/process/ui/components/DashboardProcessTable.tsx:560:            <p class="text-[12px] text-slate-400">
src/modules/process/ui/components/DashboardProcessTable.tsx:580:          <div class="text-[14px] font-semibold text-slate-700">
src/modules/process/ui/components/DashboardProcessTable.tsx:585:              class={`px-3 py-1.5 text-[14px] rounded-full ${selectedSeverity() === 'all' ? 'bg-slate-100' : 'bg-white'}`}
src/modules/process/ui/components/DashboardProcessTable.tsx:593:              class={`px-3 py-1.5 text-[14px] rounded-full ${selectedSeverity() === 'danger' ? 'bg-red-100' : 'bg-white'}`}
src/modules/process/ui/components/DashboardProcessTable.tsx:601:              class={`px-3 py-1.5 text-[14px] rounded-full ${selectedSeverity() === 'warning' ? 'bg-yellow-100' : 'bg-white'}`}
src/modules/process/ui/components/DashboardProcessTable.tsx:609:          <div class="ml-auto text-[14px] text-slate-500">
src/modules/process/ui/components/DashboardProcessTable.tsx:627:        <h2 class="text-[14px] font-semibold text-slate-900">{t(keys.dashboard.table.title)}</h2>
src/modules/process/ui/components/ContainersPanel.tsx:18:      <p class="px-2.5 pt-1 text-[10px] text-slate-400">
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:53:      <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50">
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:61:        <span class="shrink-0 tabular-nums text-[11px] text-slate-400">{props.option.count}</span>
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:79:        class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors ${
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:85:        <span class="shrink-0 tabular-nums text-[11px] text-slate-400">{props.option.count}</span>
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:109:        <span class="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:112:        <span class="max-w-[65%] truncate text-[12px] text-slate-700">{summaryLabel()}</span>
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:118:          fallback={<p class="px-3 py-2 text-[12px] text-slate-500">{props.emptyLabel}</p>}
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:236:        <span class="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:239:        <span class="max-w-[65%] truncate text-[12px] text-slate-700">{summaryLabel()}</span>
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:246:            class="w-full rounded border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700 outline-none transition-colors focus:border-blue-400"
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:253:          <p class="px-3 py-2 text-[12px] text-slate-500">{props.emptyLabel}</p>
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:256:          <p class="px-3 py-2 text-[12px] text-slate-500">{props.noMatchesLabel}</p>
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:326:        <span class="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:365:          class="self-start rounded border border-slate-200 px-2.5 py-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:377:          <span class="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:387:                  class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-200"
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:405:                  class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-200"
src/modules/process/ui/components/DashboardProcessFiltersBar.tsx:422:                  class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-200"
src/modules/process/ui/components/ShipmentHeader.tsx:240:        class="inline-flex items-center gap-1 text-[10px] text-slate-400"
src/modules/process/ui/components/ShipmentHeader.tsx:323:          <span class="hidden text-[11px] text-slate-400 sm:inline-flex sm:items-center sm:gap-0.5">
src/modules/process/ui/components/ShipmentHeader.tsx:335:          <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
src/modules/process/ui/components/ShipmentHeader.tsx:349:                <span class="text-[10px] text-slate-500">
src/modules/process/ui/components/ShipmentHeader.tsx:358:              {(refreshHint) => <span class="text-[10px] text-slate-500">{refreshHint()}</span>}
src/modules/process/ui/components/ShipmentHeader.tsx:383:        <div class="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
src/modules/process/ui/components/ShipmentHeader.tsx:408:        <div class="inline-flex items-center gap-2 text-[10px] text-slate-400">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:53:        <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:64:        <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:67:        <span class="text-[11px] font-semibold uppercase text-slate-700">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:74:        <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:77:        <span class="text-[11px] font-semibold tabular-nums text-slate-700">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:84:        <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:87:        <span class="text-[11px] font-bold tabular-nums text-slate-700">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:94:        <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:100:            <span class="text-[11px] text-slate-400">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:105:          <span class="inline-flex items-center rounded bg-red-50 px-1.5 py-px text-[11px] font-bold tabular-nums text-red-700">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:113:        <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">
src/modules/process/ui/components/OperationalSummaryStrip.tsx:116:        <span class="text-[11px] tabular-nums text-slate-500">
src/modules/process/ui/components/ShipmentInfoCard.tsx:20:        <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400 shrink-0">
src/modules/process/ui/components/ShipmentInfoCard.tsx:23:        <span class="text-[11px] font-medium text-slate-700 text-right truncate">
src/modules/process/ui/components/DashboardMetricsGrid.tsx:70:    <span class="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
src/modules/process/ui/components/DashboardMetricsGrid.tsx:225:        <div class="px-4 py-8 text-center text-[14px] text-slate-400">
src/modules/process/ui/components/DashboardMetricsGrid.tsx:233:        <div class="px-4 py-8 text-center text-[14px] text-red-500">
src/modules/process/ui/components/DashboardMetricsGrid.tsx:249:            <span class="text-[12px] font-medium text-slate-500">
src/modules/process/ui/components/DashboardMetricsGrid.tsx:258:                <span class={`text-[14px] font-bold tabular-nums ${item.valueClass}`}>
src/modules/process/ui/components/DashboardMetricsGrid.tsx:261:                <span class={`text-[12px] font-medium ${item.labelClass}`}>{item.label}</span>
src/modules/process/ui/components/DashboardMetricsGrid.tsx:275:          <p class="mt-2 text-center text-[13px] text-slate-500">
src/modules/process/ui/components/DashboardMetricsGrid.tsx:286:        <h2 class="text-[14px] font-semibold text-slate-900">
src/modules/process/ui/components/ContainerSelector.tsx:101:          <span class="font-semibold tracking-wide text-[11px] leading-tight">
src/modules/process/ui/components/TimelineNode.tsx:51:              <span class="text-[10px] text-slate-500 leading-tight mt-0.5">
src/modules/process/ui/components/TimelineNode.tsx:61:          class="text-[10px] tabular-nums text-slate-500"
src/modules/process/ui/components/TimelinePanel.tsx:106:            <p class="py-3 text-center text-[11px] text-slate-400">
src/modules/process/ui/components/TimelinePanel.tsx:136:        <span class="text-[11px] font-semibold tracking-wide text-slate-700">
src/modules/process/ui/components/TimelinePanel.tsx:148:            <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">
src/modules/process/ui/components/TimelinePanel.tsx:151:            <span class="text-[10px] font-semibold text-slate-600">{vessel()}</span>
src/modules/process/ui/components/TimelinePanel.tsx:159:            <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">
src/modules/process/ui/components/TimelinePanel.tsx:162:            <span class="text-[10px] font-medium tabular-nums text-slate-500">{route()}</span>

```



# File dump: DashboardRefreshButton.tsx

Command executed:
```bash
sed -n '1,220p' src/modules/process/ui/components/DashboardRefreshButton.tsx
```

Output:
```

import type { JSX } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'

export type RefreshVisualState = 'idle' | 'loading' | 'error'

export type RefreshButtonProps = {
  readonly onRefresh: () => Promise<void>
}

export const DASHBOARD_REFRESH_COOLDOWN_MS = 2_000

export function toDashboardRefreshCooldownUntilMs(
  clickStartedAtMs: number,
  cooldownMs: number = DASHBOARD_REFRESH_COOLDOWN_MS,
): number {
  return clickStartedAtMs + cooldownMs
}

export function isDashboardRefreshBlocked(command: {
  readonly isLoading: boolean
  readonly cooldownUntilMs: number | null
  readonly nowMs: number
}): boolean {
  if (command.isLoading) return true
  if (command.cooldownUntilMs === null) return false
  return command.nowMs < command.cooldownUntilMs
}

function RefreshIcon(props: {
  readonly spinning: boolean
  readonly title: string
  readonly error: boolean
}): JSX.Element {
  const iconClass = () => {
    const baseClass = props.spinning ? 'h-4 w-4 animate-spin' : 'h-4 w-4'
    if (props.error) return `${baseClass} text-red-600`
    return `${baseClass} text-slate-600`
  }

  return (
    <svg
      class={iconClass()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <title>{props.title}</title>
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 4v6h6M20 20v-6h-6"
      />
    </svg>
  )
}

export function DashboardRefreshButton(props: RefreshButtonProps): JSX.Element {
  const { t, keys } = useTranslation()
  const [visualState, setVisualState] = createSignal<RefreshVisualState>('idle')
  const [isLoading, setIsLoading] = createSignal(false)
  const [cooldownUntilMs, setCooldownUntilMs] = createSignal<number | null>(null)

  let cooldownTimerId: ReturnType<typeof globalThis.setTimeout> | null = null

  const clearCooldownTimer = (): void => {
    if (cooldownTimerId === null) return
    globalThis.clearTimeout(cooldownTimerId)
    cooldownTimerId = null
  }

  const scheduleCooldownRelease = (untilMs: number): void => {
    clearCooldownTimer()
    const delayMs = Math.max(0, untilMs - Date.now())
    cooldownTimerId = globalThis.setTimeout(() => {
      setCooldownUntilMs((currentValue) => {
        if (currentValue === null) return currentValue
        if (Date.now() >= currentValue) return null
        return currentValue
      })
      cooldownTimerId = null
    }, delayMs)
  }

  onCleanup(() => {
    clearCooldownTimer()
  })

  const isBlocked = createMemo(() =>
    isDashboardRefreshBlocked({
      isLoading: isLoading(),
      cooldownUntilMs: cooldownUntilMs(),
      nowMs: Date.now(),
    }),
  )

  const buttonLabel = createMemo(() => {
    if (visualState() === 'loading') {
      return t(keys.dashboard.actions.syncing)
    }

    return t(keys.dashboard.actions.sync)
  })

  const buttonTitle = createMemo(() => {
    if (visualState() === 'error') {
      return t(keys.dashboard.actions.syncFailed)
    }
    if (visualState() === 'loading') {
      return t(keys.dashboard.actions.syncing)
    }
    return t(keys.dashboard.actions.sync)
  })

  const handleClick = async () => {
    if (isBlocked()) {
      return
    }

    const clickStartedAtMs = Date.now()
    const nextCooldownUntilMs = toDashboardRefreshCooldownUntilMs(clickStartedAtMs)
    setCooldownUntilMs(nextCooldownUntilMs)
    scheduleCooldownRelease(nextCooldownUntilMs)

    setIsLoading(true)
    setVisualState('loading')

    try {
      await props.onRefresh()
      setVisualState('idle')
    } catch (error) {
      console.error('Dashboard sync failed:', error)
      setVisualState('error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isBlocked()}
      aria-busy={isLoading()}
      title={buttonTitle()}
      class="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <RefreshIcon
        spinning={visualState() === 'loading'}
        title={buttonTitle()}
        error={visualState() === 'error'}
      />
      <span>{buttonLabel()}</span>
    </button>
  )
}

```



# File dump: ShipmentHeader.tsx

Command executed:
```bash
sed -n '1,260p' src/modules/process/ui/components/ShipmentHeader.tsx
```

Output:
```

import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { ArrowIcon } from '~/modules/process/ui/components/Icons'
import {
  resolveProcessSyncHeaderMode,
  toContainerSyncLabel,
  toProcessSyncHeaderEntries,
} from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type Props = {
  data: ShipmentDetailVM
  syncNow: Date
  isRefreshing: boolean
  refreshRetry: {
    readonly current: number
    readonly total: number
  } | null
  refreshHint: string | null
  activeAlertCount: number
  onTriggerRefresh: () => void
  // when called with 'reference' or 'carrier', the parent should focus that field when opening the edit dialog
  onOpenEdit: (focus?: 'reference' | 'carrier' | null | undefined) => void
}

type InternalIdHintProps = {
  readonly message: string
  readonly ctaLabel: string
  readonly onOpenReference: () => void
}

type UnknownCarrierDialogProps = {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly cancelLabel: string
  readonly editLabel: string
  readonly onClose: () => void
  readonly onEditCarrier: () => void
}

type RefreshButtonProps = {
  readonly isRefreshing: boolean
  readonly title: string
  readonly carrier: string | null | undefined
  readonly onTriggerRefresh: () => void
  readonly onUnknownCarrier: () => void
}

type EditButtonProps = {
  readonly title: string
  readonly onClick: () => void
}

function InternalIdHint(props: InternalIdHintProps): JSX.Element {
  const [open, setOpen] = createSignal(false)

  return (
    <span class="relative ml-2 inline-block align-middle">
      <button
        type="button"
        aria-label={props.message}
        class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-blue-600 transition-transform hover:cursor-pointer hover:scale-110 hover:bg-slate-200"
        onClick={() => setOpen((current) => !current)}
      >
        i
      </button>
      <Show when={open()}>
        <InternalIdPopover
          message={props.message}
          ctaLabel={props.ctaLabel}
          onOpenReference={() => {
            props.onOpenReference()
            setOpen(false)
          }}
        />
      </Show>
    </span>
  )
}

function InternalIdPopover(props: InternalIdHintProps): JSX.Element {
  return (
    <div
      class="absolute right-0 z-10 mt-2 w-64 rounded border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-lg"
      role="dialog"
      aria-hidden="false"
    >
      <p class="text-xs text-slate-700">{props.message}</p>
      <div class="mt-2 text-right">
        <button
          type="button"
          class="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 outline hover:bg-blue-100"
          onClick={() => props.onOpenReference()}
        >
          {props.ctaLabel}
        </button>
      </div>
    </div>
  )
}

function RefreshIcon(props: { readonly spinning: boolean; readonly title: string }): JSX.Element {
  return (
    <Show
      when={props.spinning}
      fallback={
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <title>{props.title}</title>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v6h6M20 20v-6h-6"
          />
        </svg>
      }
    >
      <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <title>{props.title}</title>
        <circle cx="12" cy="12" r="10" stroke-width="2" stroke-opacity="0.2" />
        <path d="M22 12a10 10 0 00-10-10" stroke-width="2" stroke-linecap="round" />
      </svg>
    </Show>
  )
}

function RefreshButton(props: RefreshButtonProps): JSX.Element {
  const handleClick = () => {
    if (props.carrier === 'unknown') {
      props.onUnknownCarrier()
      return
    }
    props.onTriggerRefresh()
  }

  const disabledClass = () => (props.isRefreshing ? 'opacity-60 pointer-events-none' : '')

  return (
    <button
      type="button"
      onClick={handleClick}
      class={`rounded-md p-2 text-slate-500 hover:bg-slate-100 ${disabledClass()}`}
      title={props.title}
      aria-busy={props.isRefreshing}
      disabled={props.isRefreshing}
    >
      <RefreshIcon spinning={props.isRefreshing} title={props.title} />
    </button>
  )
}

function UnknownCarrierActions(props: {
  readonly cancelLabel: string
  readonly editLabel: string
  readonly onCancel: () => void
  readonly onEdit: () => void
}): JSX.Element {
  return (
    <div class="flex justify-end gap-3">
      <button
        type="button"
        class="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        onClick={() => props.onCancel()}
      >
        {props.cancelLabel}
      </button>
      <button
        type="button"
        class="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        onClick={() => props.onEdit()}
      >
        {props.editLabel}
      </button>
    </div>
  )
}

function UnknownCarrierDialog(props: UnknownCarrierDialogProps): JSX.Element {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      description={props.description}
    >
      <UnknownCarrierActions
        cancelLabel={props.cancelLabel}
        editLabel={props.editLabel}
        onCancel={props.onClose}
        onEdit={props.onEditCarrier}
      />
    </Dialog>
  )
}

function EditButton(props: EditButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      class="rounded-md p-2 text-slate-500 hover:bg-slate-100"
      title={props.title}
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <title>{props.title}</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15.232 5.232l3.536 3.536M4 20l7.5-1.5L20 9l-7.5-7.5L4 20z"
        />
      </svg>
    </button>
  )
}

function SyncSeparator(props: { readonly visible: boolean }): JSX.Element | null {
  return (
    <Show when={props.visible}>
      <span class="text-slate-300">•</span>
    </Show>
  )
}

function ProcessEtaSummary(props: {
  readonly processEtaSecondaryVm: ShipmentDetailVM['processEtaSecondaryVm']
  readonly processEtaTitle: string
  readonly noEta: string
  readonly incomplete: string
}): JSX.Element {
  return (
    <Show when={props.processEtaSecondaryVm.visible}>
      <div
        data-testid="process-eta-summary"
        class="inline-flex items-center gap-1 text-[10px] text-slate-400"
      >
        <span class="font-medium">{props.processEtaTitle}:</span>
        <span data-testid="process-eta-date" class="font-medium text-slate-500">
          {props.processEtaSecondaryVm.date ?? props.noEta}
        </span>
        <span data-testid="process-eta-coverage" class="tabular-nums text-slate-400">
          ({props.processEtaSecondaryVm.withEta}/{props.processEtaSecondaryVm.total})
        </span>
        <Show when={props.processEtaSecondaryVm.incomplete}>
          <span
            data-testid="process-eta-incomplete"
            class="rounded bg-slate-100/80 px-1 py-px text-[9px] font-medium text-slate-400"
          >
            {props.incomplete}
          </span>
        </Show>
      </div>
    </Show>
  )
}

```



# File dump: AlertsList.tsx

Command executed:
```bash
sed -n '1,260p' src/modules/process/ui/components/AlertsList.tsx
```

Output:
```

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { AlertIcon } from '~/modules/process/ui/components/Icons'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import { useTranslation } from '~/shared/localization/i18n'

type AlertCategoryChipType = 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'
type AlertsListMode = 'active' | 'archived'

function toAlertCategoryLabel(
  type: AlertCategoryChipType,
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  switch (type) {
    case 'delay':
    case 'missing-eta':
      return t(keys.shipmentView.alerts.category.eta)
    case 'customs':
      return t(keys.shipmentView.alerts.category.customs)
    case 'transshipment':
      return t(keys.shipmentView.alerts.category.movement)
    default:
      return t(keys.shipmentView.alerts.category.data)
  }
}

function toAlertCategoryIcon(type: AlertCategoryChipType): string {
  switch (type) {
    case 'delay':
    case 'missing-eta':
      return '\u23F1'
    case 'customs':
      return '\uD83D\uDEC3'
    case 'transshipment':
      return '\u21C4'
    default:
      return '\uD83D\uDDC4'
  }
}

function toSeverityBadgeClasses(
  severity: AlertDisplayVM['severity'],
  mode: AlertsListMode,
): string {
  if (mode === 'archived') {
    return 'border-slate-200 bg-slate-100 text-slate-500'
  }
  if (severity === 'danger') return 'border-red-200 bg-red-50 text-red-700'
  if (severity === 'warning') return 'border-yellow-200 bg-yellow-50 text-yellow-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

function formatAlertAge(
  triggeredAtIso: string,
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  const date = new Date(triggeredAtIso)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return t(keys.shipmentView.alerts.aging.now)
  const m = Math.floor(s / 60)
  if (m < 60) return t(keys.shipmentView.alerts.aging.minutes, { count: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t(keys.shipmentView.alerts.aging.hours, { count: h })
  const d = Math.floor(h / 24)
  return t(keys.shipmentView.alerts.aging.days, { count: d })
}

function toSeverityLabel(
  severity: AlertDisplayVM['severity'],
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (severity === 'danger') return t(keys.shipmentView.alerts.severity.danger)
  if (severity === 'warning') return t(keys.shipmentView.alerts.severity.warning)
  return t(keys.shipmentView.alerts.severity.info)
}

function toAlertCardClasses(severity: AlertDisplayVM['severity'], mode: AlertsListMode): string {
  if (mode === 'archived') return 'border-slate-200 bg-slate-100/80 border-l-slate-300 border-l-2'
  if (severity === 'danger') return 'border-red-200 bg-red-50/85 border-l-red-500 border-l-4'
  if (severity === 'warning') return 'border-amber-200 bg-amber-50/85 border-l-amber-400 border-l-4'
  return 'border-blue-100 bg-blue-50/70 border-l-blue-300 border-l-4'
}

function AlertCategoryChip(props: {
  type: AlertCategoryChipType
  mode: AlertsListMode
  t: ReturnType<typeof useTranslation>['t']
  keys: ReturnType<typeof useTranslation>['keys']
}): JSX.Element {
  return (
    <span
      class={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-medium leading-none ${
        props.mode === 'archived' ? 'bg-slate-200 text-slate-500' : 'bg-slate-100 text-slate-500'
      }`}
    >
      <span aria-hidden="true">{toAlertCategoryIcon(props.type)}</span>
      {toAlertCategoryLabel(props.type, props.t, props.keys)}
    </span>
  )
}

export function AlertsList(props: {
  alerts: readonly AlertDisplayVM[]
  mode: AlertsListMode
  busyAlertIds: ReadonlySet<string>
  collapsingAlertIds: ReadonlySet<string>
  onAcknowledge: (alertId: string) => void
  onUnacknowledge: (alertId: string) => void
}): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="flex flex-col gap-1">
      <For each={props.alerts}>
        {(alert) => {
          const isBusy = () => props.busyAlertIds.has(alert.id)
          const isCollapsing = () => props.collapsingAlertIds.has(alert.id)
          const actionDateIso = () => alert.ackedAtIso ?? alert.triggeredAtIso
          return (
            <li
              class={`list-none rounded border px-2 py-1.5 transition-all duration-200 ease-out overflow-hidden ${toAlertCardClasses(
                alert.severity,
                props.mode,
              )} ${
                isCollapsing()
                  ? 'max-h-0 translate-y-[-4px] border-transparent py-0 opacity-0'
                  : 'max-h-40 opacity-100'
              } flex gap-1.5`}
            >
              <AlertIcon type={alert.type} />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1 flex-wrap">
                  <span
                    class={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none ${toSeverityBadgeClasses(alert.severity, props.mode)}`}
                  >
                    {toSeverityLabel(alert.severity, t, keys)}
                  </span>
                  <AlertCategoryChip type={alert.type} mode={props.mode} t={t} keys={keys} />
                  <span class="text-[10px] font-medium tabular-nums text-slate-500">
                    {formatAlertAge(actionDateIso(), t, keys)}
                  </span>
                </div>
                <p class="mt-0.5 text-[11px] leading-tight text-slate-600">{alert.message}</p>
              </div>
              <Show
                when={props.mode === 'active'}
                fallback={
                  <button
                    type="button"
                    disabled={isBusy()}
                    class="inline-flex h-6 items-center justify-center rounded border border-slate-300 bg-white px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={t(keys.shipmentView.alerts.action.unacknowledgeAria)}
                    onClick={() => props.onUnacknowledge(alert.id)}
                  >
                    {t(keys.shipmentView.alerts.action.unacknowledge)}
                  </button>
                }
              >
                <button
                  type="button"
                  disabled={isBusy()}
                  class="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={t(keys.shipmentView.alerts.action.acknowledgeAria)}
                  onClick={() => props.onAcknowledge(alert.id)}
                >
                  X
                </button>
              </Show>
            </li>
          )
        }}
      </For>
    </div>
  )
}

```



# File dump: DashboardProcessTable.tsx

Command executed:
```bash
sed -n '1,260p' src/modules/process/ui/components/DashboardProcessTable.tsx
```

Output:
```

import { A, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { ProcessSyncButton } from '~/modules/process/ui/components/ProcessSyncButton'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type {
  DashboardSortDirection,
  DashboardSortField,
  DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import { getActiveDashboardSortDirection } from '~/modules/process/ui/viewmodels/dashboard-sort-interaction.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { EmptyState } from '~/shared/ui/EmptyState'
import { StatusBadge } from '~/shared/ui/StatusBadge'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type DashboardProcessSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'
type SeverityFilter = 'all' | 'danger' | 'warning'

type Props = {
  readonly processes: readonly ProcessSummaryVM[]
  readonly loading: boolean
  readonly hasError: boolean
  readonly hasActiveFilters: boolean
  readonly onCreateProcess: () => void
  readonly onClearFilters: () => void
  readonly sortSelection: DashboardSortSelection
  readonly onSortToggle: (field: DashboardSortField) => void
  readonly onProcessSync: (processId: string) => Promise<void>
}

type RowProps = {
  readonly process: ProcessSummaryVM
  readonly index: number
  readonly onProcessSync: (processId: string) => Promise<void>
}

type TableRowsProps = {
  readonly processes: readonly ProcessSummaryVM[]
  readonly sortSelection: DashboardSortSelection
  readonly onSortToggle: (field: DashboardSortField) => void
  readonly onProcessSync: (processId: string) => Promise<void>
}

type SortHeaderProps = {
  readonly field: DashboardSortField
  readonly label: string
  readonly direction: DashboardSortDirection | null
  readonly onToggle: (field: DashboardSortField) => void
  readonly align?: 'left' | 'right'
}

function ArrowIcon(): JSX.Element {
  return (
    <svg
      class="h-3 w-3 text-slate-300"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M17 8l4 4m0 0l-4 4m4-4H3"
      />
    </svg>
  )
}

function toAriaSort(direction: DashboardSortDirection | null): 'none' | 'ascending' | 'descending' {
  if (direction === 'asc') return 'ascending'
  if (direction === 'desc') return 'descending'
  return 'none'
}

function SortDirectionIcon(props: {
  readonly direction: DashboardSortDirection | null
}): JSX.Element {
  const arrow = () => (props.direction === 'asc' ? '↑' : '↓')

  return (
    <Show when={props.direction !== null}>
      <span
        class="inline-flex h-4 w-4 items-center justify-center text-[11px] leading-none text-slate-600"
        aria-hidden="true"
      >
        {arrow()}
      </span>
    </Show>
  )
}

function SortHeaderButton(props: SortHeaderProps): JSX.Element {
  const isActive = () => props.direction !== null
  const justifyClass = () => (props.align === 'right' ? 'justify-end' : 'justify-start')

  return (
    <button
      type="button"
      class={`inline-flex w-full items-center ${justifyClass()} gap-1 transition-colors focus-visible:outline-none ${
        isActive() ? 'text-slate-700' : 'hover:text-slate-600 focus-visible:text-slate-700'
      }`}
      onClick={() => props.onToggle(props.field)}
    >
      <span>{props.label}</span>
      <SortDirectionIcon direction={props.direction} />
    </button>
  )
}

function displayProcessRef(process: ProcessSummaryVM): string {
  if (process.reference) return process.reference
  return `<${process.id.slice(0, 8)}>`
}

function displayRoute(process: ProcessSummaryVM): {
  origin: string
  destination: string
} {
  return {
    origin: process.origin?.display_name ?? '—',
    destination: process.destination?.display_name ?? '—',
  }
}

function displayEta(eta: string | null): string {
  if (!eta) return '—'
  return formatDateForLocale(eta)
}

function toDominantSeverity(process: ProcessSummaryVM): DashboardProcessSeverity {
  const highestSeverity = process.highestAlertSeverity
  if (highestSeverity === 'danger') return 'danger'
  if (highestSeverity === 'warning') return 'warning'
  if (highestSeverity === 'info') return 'info'
  if (process.alertsCount > 0) return 'info'
  return 'none'
}

function toDominantAlertLabel(
  process: ProcessSummaryVM,
  t: (key: string, opts?: Record<string, unknown>) => string,
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (process.alertsCount === 0) return t(keys.dashboard.table.dominantAlertLabel.noAlerts)
  if (process.hasTransshipment) return t(keys.dashboard.table.dominantAlertLabel.transshipment)
  return t(keys.dashboard.table.dominantAlertLabel.alertsPresent, { count: process.alertsCount })
}

type AlertCategoryChip = 'eta' | 'movement' | 'data' | 'customs'

function toDerivedCategories(process: ProcessSummaryVM): readonly AlertCategoryChip[] {
  const cats: AlertCategoryChip[] = []
  if (process.highestAlertSeverity === 'danger' || process.highestAlertSeverity === 'warning') {
    cats.push('eta')
  }
  if (process.hasTransshipment) {
    cats.push('movement')
  }
  if (process.alertsCount > 0 && cats.length === 0) {
    cats.push('data')
  }
  return cats
}

const MAX_VISIBLE_CHIPS = 2

const CATEGORY_ICON: Record<AlertCategoryChip, string> = {
  eta: '⏱',
  movement: '⇄',
  data: '🗄',
  customs: '🛃',
}

function toSeverityBadgeClasses(severity: DashboardProcessSeverity): string {
  if (severity === 'danger') return 'border-red-200 bg-red-50 text-red-700'
  if (severity === 'warning') return 'border-yellow-200 bg-yellow-50 text-yellow-700'
  if (severity === 'info') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (severity === 'success') return 'border-green-200 bg-green-50 text-green-700'
  return 'border-slate-200 bg-slate-50 text-slate-500'
}

function getSeverityBorderClass(severity: DashboardProcessSeverity): string {
  if (severity === 'danger') return 'border-l-4 border-l-red-500'
  if (severity === 'warning') return 'border-l-4 border-l-amber-400'
  if (severity === 'info') return 'border-l-4 border-l-blue-300'
  return ''
}

function CheckIcon(): JSX.Element {
  return (
    <svg
      class="h-3 w-3 text-emerald-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function AlertChipList(props: {
  readonly chips: readonly AlertCategoryChip[]
  readonly overflowCount: number
  readonly overflowLabel: string
}): JSX.Element {
  return (
    <div class="flex items-center gap-1">
      <For each={props.chips}>
        {(chip) => (
          <span class="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-slate-500">
            <span aria-hidden="true">{CATEGORY_ICON[chip]}</span>
            {chip}
          </span>
        )}
      </For>
      <Show when={props.overflowCount > 0}>
        <span class="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-slate-400">
          {props.overflowLabel}
        </span>
      </Show>
    </div>
  )
}

function DashboardProcessRow(props: RowProps): JSX.Element {
  const { t, keys } = useTranslation()
  const navigate = useNavigate()
  const route = () => displayRoute(props.process)

  function formatAge(ts: string | Date | null | undefined): string {
    if (!ts) return t(keys.dashboard.table.age.missing)
    const date = typeof ts === 'string' ? new Date(ts) : ts
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—'
    const diff = Date.now() - date.getTime()
    const s = Math.floor(diff / 1000)
    if (s < 60) return t(keys.dashboard.table.age.now)
    const m = Math.floor(s / 60)
    if (m < 60) return t(keys.dashboard.table.age.minutes, { count: m })
    const h = Math.floor(m / 60)
    if (h < 24) return t(keys.dashboard.table.age.hours, { count: h })
    const d = Math.floor(h / 24)
    return t(keys.dashboard.table.age.days, { count: d })
  }

  const dominantSeverity = () => toDominantSeverity(props.process)
  const dominantAlertLabel = () => toDominantAlertLabel(props.process, t, keys)
  const categories = () => toDerivedCategories(props.process)
  const visibleChips = () => categories().slice(0, MAX_VISIBLE_CHIPS)
  const overflowCount = () => Math.max(0, categories().length - MAX_VISIBLE_CHIPS)

  const severityLabel = () => {
    if (dominantSeverity() === 'danger') {
      return t(keys.dashboard.alertIndicators.severity.danger).toUpperCase()
    }

```



# File dump: processList.ui-mapper.ts

Command executed:
```bash
sed -n '1,220p' src/modules/process/ui/mappers/processList.ui-mapper.ts
```

Output:
```

import {
  toTrackingStatusCode,
  trackingStatusToRank,
  trackingStatusToVariant,
} from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { TRACKING_STATUS_CODES } from '~/modules/tracking/application/projection/tracking.status.projection'

export type ProcessListItemSource = {
  id: string
  reference?: string | null
  origin?: { display_name?: string | null } | null
  destination?: { display_name?: string | null } | null
  carrier?: string | null
  importer_id?: string | null
  importer_name?: string | null
  bill_of_lading?: string | null
  booking_number?: string | null
  source: string
  created_at: string
  updated_at: string
  containers: Array<{
    id: string
    container_number: string
    carrier_code?: string | null
  }>
  process_status?: string | null
  eta?: string | null
  alerts_count?: number
  highest_alert_severity?: 'info' | 'warning' | 'danger' | null
  has_transshipment?: boolean
  last_event_at?: string | null
  redestination_number?: string | null
  last_sync_status?: 'DONE' | 'FAILED' | 'RUNNING' | 'UNKNOWN'
  last_sync_at?: string | null
}

function toOptionalNonBlankString(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? value : null
}

function normalizeContainerNumber(containerNumber: string): string {
  return containerNumber.trim().toUpperCase()
}

function toTimestampOrNull(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function toProcessSyncStatus(
  status: ProcessListItemSource['last_sync_status'],
): ProcessSummaryVM['syncStatus'] {
  // Success/error are intentionally ephemeral in dashboard realtime state.
  // After reload we only keep "syncing" when backend still reports active work.
  if (status === 'RUNNING') return 'syncing'
  return 'idle'
}

export function toProcessSummaryVMs(
  data: readonly ProcessListItemSource[],
): readonly ProcessSummaryVM[] {
  return data.map((process) => {
    // Preserve the aggregated process status when present (e.g. PARTIALLY_DELIVERED)
    const rawStatus = process.process_status ?? null
    const eta = process.eta ?? null
    // canonical statusCode used by most UI mappers (falls back to UNKNOWN)
    const statusCode = toTrackingStatusCode(rawStatus)
    const aggregatedStatus = rawStatus === 'PARTIALLY_DELIVERED' ? 'PARTIALLY_DELIVERED' : null

    const statusRank = (() => {
      if (TRACKING_STATUS_CODES.includes(statusCode)) return trackingStatusToRank(statusCode)
      if (aggregatedStatus === 'PARTIALLY_DELIVERED') return trackingStatusToRank('DELIVERED')
      return 0
    })()

    return {
      id: process.id,
      reference: process.reference ?? null,
      origin: process.origin,
      destination: process.destination,
      importerId: toOptionalNonBlankString(process.importer_id),
      importerName: toOptionalNonBlankString(process.importer_name),
      containerCount: process.containers.length,
      containerNumbers: process.containers.map((container) =>
        normalizeContainerNumber(container.container_number),
      ),
      status: trackingStatusToVariant(aggregatedStatus ?? statusCode),
      statusCode,
      aggregatedStatus,
      // compute a sensible rank: use the canonical tracking rank when the code
      // is one of the container statuses; for PARTIALLY_DELIVERED use the same
      // rank as DELIVERED to position it appropriately in sorted lists.
      statusRank,
      eta,
      etaMsOrNull: toTimestampOrNull(eta),
      carrier: toOptionalNonBlankString(process.carrier),
      alertsCount: process.alerts_count ?? 0,
      highestAlertSeverity: process.highest_alert_severity ?? null,
      redestinationNumber: process.redestination_number ?? null,
      hasTransshipment: process.has_transshipment ?? false,
      lastEventAt: process.last_event_at ?? null,
      syncStatus: toProcessSyncStatus(process.last_sync_status),
      lastSyncAt: process.last_sync_at ?? null,
    }
  })
}

```



# File dump: process-summary.vm.ts

Command executed:
```bash
sed -n '1,220p' src/modules/process/ui/viewmodels/process-summary.vm.ts
```

Output:
```

import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type ProcessSyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export type ProcessSummaryVM = {
  readonly id: string
  readonly reference: string | null
  readonly origin?: { display_name?: string | null } | null
  readonly destination?: { display_name?: string | null } | null
  readonly importerId: string | null
  readonly importerName: string | null
  readonly containerCount: number
  readonly containerNumbers: readonly string[]
  readonly status: StatusVariant
  readonly statusCode: TrackingStatusCode
  /** When the API provides a process-level aggregated status (e.g. PARTIALLY_DELIVERED),
   * it's exposed here so the UI can render/process it without breaking existing
   * mappers that expect canonical container tracking codes.
   */
  readonly aggregatedStatus?: 'PARTIALLY_DELIVERED' | null
  readonly statusRank: number
  readonly eta: string | null
  readonly etaMsOrNull: number | null
  readonly carrier: string | null
  readonly alertsCount: number
  readonly highestAlertSeverity: 'info' | 'warning' | 'danger' | null
  readonly redestinationNumber?: string | null
  readonly hasTransshipment: boolean
  readonly lastEventAt: string | null
  readonly syncStatus: ProcessSyncStatus
  readonly lastSyncAt: string | null
}

```



# File dump: app.css

Command executed:
```bash
sed -n '1,220p' src/app.css
```

Output:
```

@import "tailwindcss";

/* https://base-ui-docs-solid.vercel.app/solid/overview/quick-start */
/* BaseUI Portals isolation (to be on top) */
.root {
  isolation: isolate;
}

/* CopyButton ripple animation */
@keyframes rippleExpand {
  from {
    transform: scale(0);
    opacity: 0.9;
  }

  to {
    transform: scale(6);
    opacity: 0;
  }
}

.copy-button-ripple {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 9999px;
  background: rgba(16, 185, 129, 0.18);
  width: 10px;
  height: 10px;
  animation: rippleExpand 650ms ease-out forwards;
}

/* Search overlay animations */
@keyframes search-overlay-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes search-modal-in {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-8px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

```

