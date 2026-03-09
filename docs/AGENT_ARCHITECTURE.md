# Container Tracker Agent Architecture

This document describes the architecture, runtime model, and operational integration of the Container Tracker Agent system.

Note: for current source-of-truth sync documentation, prefer `docs/SYNC_OVERVIEW.md`, `docs/SYNC_FLOWS.md`, `docs/SYNC_RUNTIME_MODEL.md`, `docs/SYNC_REQUESTS_MODEL.md`, `docs/SYNC_ARCHITECTURE_BOUNDARIES.md`, `docs/SYNC_FAQ.md`, `docs/SYNC_GAPS_AND_ROADMAP.md`, and `docs/SYNC_CODEMAP.md`.

## 0. System Overview

                +----------------+
                |      UI        |
                | (Dashboard)    |
                +--------+-------+
                         |
                         v
                +----------------+
                | HTTP Server    |
                | (Monolith)     |
                +--------+-------+
                         |
                         v
                +----------------+
                | sync_requests  |
                |  (DB Queue)    |
                +--------+-------+
                         |
             +-----------+-----------+
             |                       |
             v                       v
       +-----------+          +-----------+
       | Agent A   |          | Agent B   |
       | hostname1 |          | hostname2 |
       +-----+-----+          +-----+-----+
             |                      |
             v                      v
       Carrier APIs           Carrier APIs

## 1. Agent Runtime Model

The agent is a standalone Node.js application responsible for executing tracking sync requests (scraping) on behalf of tenants.

### 1.1 Core Components
- **Entrypoint**: `tools/agent/agent.ts`
- **Scheduler**: `tools/agent/agent.scheduler.ts` (handles interval polling and realtime wakes).
- **Backoff**: `tools/agent/backoff.ts` (implements exponential backoff for enrollment).
- **Runner**: Executes under Node.js (using `--experimental-strip-types` for direct TypeScript execution).

### 1.2 Execution Modes
The agent operates in two distinct modes:

1.  **Bootstrap Mode**: 
    - Triggered if `config.env` is missing or invalid.
    - Reads `bootstrap.env` (containing a one-time `INSTALLER_TOKEN`).
    - Calls `POST /api/agent/enroll` to exchange the bootstrap token for a persistent `AGENT_TOKEN` and runtime configuration.
    - Persists configuration to `config.env` and marks `bootstrap.env` as consumed.
2.  **Normal Mode**:
    - Reads `config.env`.
    - Starts the sync cycle (immediate run on startup).
    - Polling: Runs every `INTERVAL_SEC` (default 60s).
    - Realtime: Subscribes to Supabase Realtime for immediate wakes on new `PENDING` requests.

## 2. Queue Architecture

The system uses a **database-as-a-queue** pattern powered by PostgreSQL and Supabase.

### 2.1 Infrastructure
- **Queue Table**: `sync_requests` (stores targets with status `PENDING`, `LEASED`, `DONE`, `FAILED`).
- **Atomic Leasing**: `public.lease_sync_requests` (RPC) - Ensures multiple agents can safely lease different targets using `FOR UPDATE SKIP LOCKED`.
- **Atomic Enqueueing**: `public.enqueue_sync_request` (RPC) - Handles deduplication of open requests for the same target.

### 2.2 Job Schema
Sync requests are defined by:
- `tenant_id`: The organization owning the request.
- `provider`: One of `maersk`, `msc`, `cmacgm`.
- `ref_type`: Currently only `container`.
- `ref_value`: The container number.
- `priority`: Integer for ordering.

## 3. Sync Pipeline

The full lifecycle of a sync request:

1.  **Trigger**: User clicks "Refresh" in the UI.
2.  **Enqueue**: UI calls `POST /api/refresh`, which executes `enqueue_sync_request` RPC.
3.  **Notification**: Supabase Realtime broadcasts the new row to connected agents.
4.  **Lease**: Agent calls `GET /api/agent/targets`, which executes `lease_sync_requests` RPC.
5.  **Execution**: 
    - Agent identifies the provider.
    - Executes carrier-specific fetcher (Puppeteer for Maersk, HTTP for others).
6.  **Ingest**: Agent calls `POST /api/tracking/snapshots/ingest` with the raw payload.
7.  **Finalize**: Server saves the snapshot to `container_snapshots`, processes it, and marks the `sync_request` as `DONE`.

## Domain Responsibility

Agents are responsible only for **data collection and delivery**.

Agents DO:

- execute carrier-specific fetchers
- collect raw carrier payloads
- send snapshots to the server

Agents do NOT:

- derive observations
- derive timeline
- derive container status
- derive alerts

All domain interpretation happens inside the **Tracking bounded context** on the server.

The agent acts purely as a **data acquisition worker**.

## 4. Code Sharing

The agent is designed to minimize logic duplication by directly reusing modules from the main repository:

- **Fetchers**: Reuses `src/modules/tracking/infrastructure/carriers/fetchers/`.
- **Realtime**: Reuses `src/shared/supabase/sync-requests.realtime.ts`.
- **Schemas**: Reuses Zod schemas for API contracts.

This ensures that scraping logic and carrier integrations remain consistent between the monolith and the agents.

## 5. Tenant Model

- **Isolation**: Every `sync_request` and `tracking_agent` is scoped to a `tenant_id`.
- **Authentication**: Agents use a Bearer `AGENT_TOKEN` issued during enrollment. The server validates that the agent belongs to the tenant it is requesting targets for.
- **Config**: Tenants can have different polling intervals and provider settings (e.g., Maersk enabled/disabled).

## 6. Failure Handling

- **Lease Timeout**: If an agent crashes during execution, the lease expires after `AGENT_LEASE_MINUTES` (default 5), and the target becomes available for leasing again.
- **Retries**: Enrollment and API calls use exponential backoff with jitter.
- **Dead Lettering**: Failed requests are marked with `status=FAILED` and the `last_error` is recorded for UI observability.
- **Conflicts**: If an agent tries to ingest a snapshot for an expired or stolen lease, the server returns `409 Conflict`.

## 7. Observability

- **Agent Identity**: Every request includes an `x-agent-id` header (usually the hostname).
- **Audit Logs**: `agent_enrollment_audit_events` table tracks every enrollment attempt, success, and failure.
- **Request Metadata**: `sync_requests` tracks `attempts`, `leased_by`, `leased_until`, and `last_error`.
- **Realtime Status**: The agent logs its subscription state (`SUBSCRIBED`, `CHANNEL_ERROR`).

### tracking_agents Table

Agents are registered in the `tracking_agents` table.

Fields typically include:

```
agent_id
tenant_id
hostname
version
enrolled_at
last_seen_at
status
```

This table allows the system to:

- list active agents
- detect disconnected agents
- audit agent enrollments
- support future operational dashboards.

## 8. Operational Risks

- **Token Exposure**: `AGENT_TOKEN` is stored in plaintext in `config.env`. Local file system permissions are critical.
- **Provider Rate Limiting**: Multiple agents running for the same tenant could trigger carrier rate limits if `LIMIT` is too high.
- **Database Load**: Frequent polling from a large fleet of agents could stress the `sync_requests` table (mitigated by indexing and Realtime).

## Scalability Model

The system scales horizontally by increasing the number of agents.

Multiple agents may run concurrently for the same tenant.

Concurrency safety is guaranteed by the leasing mechanism:

```
FOR UPDATE SKIP LOCKED
```

This ensures that:

- multiple agents can request targets simultaneously
- each sync request is processed by only one agent
- no central coordinator is required

The queue therefore supports **horizontal worker scaling** without coordination.
