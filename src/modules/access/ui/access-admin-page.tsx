import type { JSX } from 'solid-js'
import { createMemo, createResource, createSignal, For, Show } from 'solid-js'
import type { AccessOverviewResponse } from '~/modules/access/ui/access-admin.api'
import {
  createAccessImporter,
  createAccessTenant,
  fetchAccessOverview,
  upsertAccessMembership,
} from '~/modules/access/ui/access-admin.api'
import { AppHeader } from '~/shared/ui/AppHeader'

type UiState = 'loading' | 'empty' | 'error' | 'ready'

function deriveUiState(loading: boolean, error: unknown, hasData: boolean): UiState {
  if (loading) return 'loading'
  if (error) return 'error'
  if (!hasData) return 'empty'
  return 'ready'
}

function FeedbackBanners(props: {
  readonly feedback: string | null
  readonly busyMessage: string | null
}): JSX.Element {
  return (
    <>
      <Show when={props.feedback}>
        {(message) => (
          <div class="mt-4 rounded border border-border bg-surface p-3 text-sm-ui text-text">
            {message()}
          </div>
        )}
      </Show>

      <Show when={props.busyMessage}>
        {(message) => (
          <div class="mt-3 rounded border border-border bg-surface-muted p-3 text-sm-ui text-text-muted">
            {message()}
          </div>
        )}
      </Show>
    </>
  )
}

function TenantCreateSection(props: {
  readonly tenantSlug: string
  readonly tenantName: string
  readonly onTenantSlugInput: (value: string) => void
  readonly onTenantNameInput: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
}): JSX.Element {
  return (
    <section class="mt-6 rounded border border-border bg-surface p-4">
      <h2 class="text-base-ui font-medium text-text">Create Tenant</h2>
      <form class="mt-3 grid gap-3 md:grid-cols-2" onSubmit={(event) => props.onSubmit(event)}>
        <input
          class="rounded border border-border bg-surface px-3 py-2 text-sm-ui"
          value={props.tenantSlug}
          onInput={(event) => props.onTenantSlugInput(event.currentTarget.value)}
          placeholder="tenant slug"
        />
        <input
          class="rounded border border-border bg-surface px-3 py-2 text-sm-ui"
          value={props.tenantName}
          onInput={(event) => props.onTenantNameInput(event.currentTarget.value)}
          placeholder="tenant name"
        />
        <button
          class="rounded border border-border bg-primary px-3 py-2 text-sm-ui font-medium text-white md:col-span-2"
          type="submit"
        >
          Create tenant
        </button>
      </form>
    </section>
  )
}

function TenantSelectorSection(props: {
  readonly selectedTenantId: string | undefined
  readonly tenants: readonly AccessOverviewResponse['tenants'][number][]
  readonly onSelectTenant: (value: string | undefined) => void
}): JSX.Element {
  return (
    <section class="mt-6 rounded border border-border bg-surface p-4">
      <h2 class="text-base-ui font-medium text-text">Tenant Scope</h2>
      <div class="mt-3">
        <select
          class="w-full rounded border border-border bg-surface px-3 py-2 text-sm-ui"
          value={props.selectedTenantId ?? ''}
          onChange={(event) => {
            const value = event.currentTarget.value
            props.onSelectTenant(value.length > 0 ? value : undefined)
          }}
        >
          <option value="">Select tenant</option>
          <For each={props.tenants}>
            {(tenant) => (
              <option value={tenant.id}>
                {tenant.name} ({tenant.slug})
              </option>
            )}
          </For>
        </select>
      </div>
    </section>
  )
}

function ImporterCreateSection(props: {
  readonly importerName: string
  readonly importerTaxId: string
  readonly onImporterNameInput: (value: string) => void
  readonly onImporterTaxIdInput: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
}): JSX.Element {
  return (
    <section class="mt-6 rounded border border-border bg-surface p-4">
      <h2 class="text-base-ui font-medium text-text">Create Importer</h2>
      <form class="mt-3 grid gap-3 md:grid-cols-2" onSubmit={(event) => props.onSubmit(event)}>
        <input
          class="rounded border border-border bg-surface px-3 py-2 text-sm-ui"
          value={props.importerName}
          onInput={(event) => props.onImporterNameInput(event.currentTarget.value)}
          placeholder="Importer name"
        />
        <input
          class="rounded border border-border bg-surface px-3 py-2 text-sm-ui"
          value={props.importerTaxId}
          onInput={(event) => props.onImporterTaxIdInput(event.currentTarget.value)}
          placeholder="Tax ID (optional)"
        />
        <button
          class="rounded border border-border bg-primary px-3 py-2 text-sm-ui font-medium text-white md:col-span-2"
          type="submit"
        >
          Create importer
        </button>
      </form>
    </section>
  )
}

function MembershipSection(props: {
  readonly workosUserId: string
  readonly userEmail: string
  readonly roleCode: string
  readonly importerIds: string
  readonly roleOptions: readonly string[]
  readonly onWorkosUserIdInput: (value: string) => void
  readonly onUserEmailInput: (value: string) => void
  readonly onRoleCodeChange: (value: string) => void
  readonly onImporterIdsInput: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
}): JSX.Element {
  return (
    <section class="mt-6 rounded border border-border bg-surface p-4">
      <h2 class="text-base-ui font-medium text-text">Upsert Membership</h2>
      <form class="mt-3 grid gap-3 md:grid-cols-2" onSubmit={(event) => props.onSubmit(event)}>
        <input
          class="rounded border border-border bg-surface px-3 py-2 text-sm-ui"
          value={props.workosUserId}
          onInput={(event) => props.onWorkosUserIdInput(event.currentTarget.value)}
          placeholder="WorkOS user ID"
        />
        <input
          class="rounded border border-border bg-surface px-3 py-2 text-sm-ui"
          value={props.userEmail}
          onInput={(event) => props.onUserEmailInput(event.currentTarget.value)}
          placeholder="User email"
          type="email"
        />
        <select
          class="rounded border border-border bg-surface px-3 py-2 text-sm-ui"
          value={props.roleCode}
          onChange={(event) => props.onRoleCodeChange(event.currentTarget.value)}
        >
          <For each={props.roleOptions}>
            {(roleCode) => <option value={roleCode}>{roleCode}</option>}
          </For>
        </select>
        <input
          class="rounded border border-border bg-surface px-3 py-2 text-sm-ui"
          value={props.importerIds}
          onInput={(event) => props.onImporterIdsInput(event.currentTarget.value)}
          placeholder="Importer IDs (comma-separated)"
        />
        <button
          class="rounded border border-border bg-primary px-3 py-2 text-sm-ui font-medium text-white md:col-span-2"
          type="submit"
        >
          Save membership
        </button>
      </form>
    </section>
  )
}

function ImporterListSection(props: {
  readonly uiState: UiState
  readonly importers: readonly AccessOverviewResponse['importers'][number][]
}): JSX.Element {
  return (
    <section class="mt-6 rounded border border-border bg-surface p-4">
      <h2 class="text-base-ui font-medium text-text">Current Tenant Importers</h2>
      <Show when={props.uiState === 'loading'}>
        <p class="mt-3 text-sm-ui text-text-muted">Loading...</p>
      </Show>
      <Show when={props.uiState === 'error'}>
        <p class="mt-3 text-sm-ui text-danger">Failed loading access overview.</p>
      </Show>
      <Show when={props.uiState === 'empty'}>
        <p class="mt-3 text-sm-ui text-text-muted">No data yet.</p>
      </Show>
      <Show when={props.uiState === 'ready'}>
        <ul class="mt-3 space-y-2">
          <For each={props.importers}>
            {(importer) => (
              <li class="rounded border border-border p-2 text-sm-ui text-text">
                {importer.name} - {importer.id}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}

export function AccessAdminPage(): JSX.Element {
  const [selectedTenantId, setSelectedTenantId] = createSignal<string | undefined>(undefined)
  const [tenantSlug, setTenantSlug] = createSignal('tenant-new')
  const [tenantName, setTenantName] = createSignal('New Tenant')
  const [importerName, setImporterName] = createSignal('')
  const [importerTaxId, setImporterTaxId] = createSignal('')
  const [workosUserId, setWorkosUserId] = createSignal('')
  const [userEmail, setUserEmail] = createSignal('')
  const [membershipRoleCode, setMembershipRoleCode] = createSignal('IMPORTER')
  const [membershipImporterIds, setMembershipImporterIds] = createSignal('')
  const [busyMessage, setBusyMessage] = createSignal<string | null>(null)
  const [feedback, setFeedback] = createSignal<string | null>(null)

  const [overviewResource, { refetch }] = createResource(selectedTenantId, fetchAccessOverview)
  const uiState = createMemo(() =>
    deriveUiState(
      Boolean(overviewResource.loading),
      overviewResource.error,
      !!overviewResource()?.tenants.length,
    ),
  )

  const roleOptions = createMemo(() => {
    const tenantId = selectedTenantId()
    if (!tenantId) return ['ADMIN', 'IMPORTER']
    const tenantRoleCodes = (overviewResource()?.roleDefinitions ?? [])
      .filter((row) => row.platformTenantId === tenantId)
      .map((row) => row.code)
    return tenantRoleCodes.length > 0 ? Array.from(new Set(tenantRoleCodes)) : ['ADMIN', 'IMPORTER']
  })

  const selectedTenantImporters = createMemo(() => {
    const tenantId = selectedTenantId()
    if (!tenantId) return []
    return (overviewResource()?.importers ?? []).filter((row) => row.platformTenantId === tenantId)
  })

  function handleCreateTenantSubmit(event: SubmitEvent): void {
    event.preventDefault()
    setBusyMessage('Creating tenant...')
    setFeedback(null)
    void createAccessTenant({ slug: tenantSlug(), name: tenantName() })
      .then(() => refetch())
      .then(() => setFeedback('Tenant created'))
      .catch((error: unknown) => {
        setFeedback(error instanceof Error ? error.message : 'Request failed')
      })
      .finally(() => {
        setBusyMessage(null)
      })
  }

  function handleCreateImporterSubmit(event: SubmitEvent): void {
    event.preventDefault()
    const tenantId = selectedTenantId()
    if (!tenantId) {
      setFeedback('Select tenant first')
      return
    }
    setBusyMessage('Creating importer...')
    setFeedback(null)
    void createAccessImporter({
      platformTenantId: tenantId,
      name: importerName(),
      taxId: importerTaxId().trim().length > 0 ? importerTaxId().trim() : null,
    })
      .then(() => {
        setImporterName('')
        setImporterTaxId('')
        return refetch()
      })
      .then(() => setFeedback('Importer created'))
      .catch((error: unknown) => {
        setFeedback(error instanceof Error ? error.message : 'Request failed')
      })
      .finally(() => {
        setBusyMessage(null)
      })
  }

  function handleUpsertMembershipSubmit(event: SubmitEvent): void {
    event.preventDefault()
    const tenantId = selectedTenantId()
    if (!tenantId) {
      setFeedback('Select tenant first')
      return
    }
    const importerIds = membershipImporterIds()
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
    setBusyMessage('Saving membership...')
    setFeedback(null)
    void upsertAccessMembership({
      workosUserId: workosUserId(),
      email: userEmail(),
      platformTenantId: tenantId,
      roleCode: membershipRoleCode(),
      importerIds,
    })
      .then(() => refetch())
      .then(() => setFeedback('Membership saved'))
      .catch((error: unknown) => {
        setFeedback(error instanceof Error ? error.message : 'Request failed')
      })
      .finally(() => {
        setBusyMessage(null)
      })
  }

  return (
    <div class="min-h-screen bg-dashboard-canvas">
      <AppHeader />
      <main class="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        <h1 class="text-2xl-ui font-semibold text-text">Access Admin</h1>
        <p class="mt-2 text-sm-ui text-text-muted">
          Manage tenant, importer scope, and memberships for V1 multi-tenancy.
        </p>

        <FeedbackBanners feedback={feedback()} busyMessage={busyMessage()} />

        <TenantCreateSection
          tenantSlug={tenantSlug()}
          tenantName={tenantName()}
          onTenantSlugInput={setTenantSlug}
          onTenantNameInput={setTenantName}
          onSubmit={handleCreateTenantSubmit}
        />

        <TenantSelectorSection
          selectedTenantId={selectedTenantId()}
          tenants={overviewResource()?.tenants ?? []}
          onSelectTenant={setSelectedTenantId}
        />

        <ImporterCreateSection
          importerName={importerName()}
          importerTaxId={importerTaxId()}
          onImporterNameInput={setImporterName}
          onImporterTaxIdInput={setImporterTaxId}
          onSubmit={handleCreateImporterSubmit}
        />

        <MembershipSection
          workosUserId={workosUserId()}
          userEmail={userEmail()}
          roleCode={membershipRoleCode()}
          importerIds={membershipImporterIds()}
          roleOptions={roleOptions()}
          onWorkosUserIdInput={setWorkosUserId}
          onUserEmailInput={setUserEmail}
          onRoleCodeChange={setMembershipRoleCode}
          onImporterIdsInput={setMembershipImporterIds}
          onSubmit={handleUpsertMembershipSubmit}
        />

        <ImporterListSection uiState={uiState()} importers={selectedTenantImporters()} />
      </main>
    </div>
  )
}
