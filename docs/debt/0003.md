# Technical Debt - Container Tracker Agent (MVP One-Click Runtime Enrolment)

This file tracks explicit MVP debts after moving to installer-offline + runtime enrolment.

## 1) Token embedded in installer (`INSTALLER_TOKEN`)

Current state:

- bootstrap token ships with installer/bundle and is written to `bootstrap.env`

Risk:

- token extraction from installer or local disk
- abusive enrolment if leaked

MVP mitigation:

- token scoped per tenant/distribution
- token revocable and rotatable
- rotate on incident
- remove/rename `bootstrap.env` after successful enrolment

Next step:

- move to stronger bootstrap auth (device flow or signed short-lived claim)

## 2) No code signing

Current state:

- installer and binaries are unsigned

Risk:

- SmartScreen warnings
- AV friction in corporate environments

Next step:

- Authenticode signing + timestamping in release pipeline

## 3) Updater is still stub

Current state:

- updater task runs but only logs "NO UPDATES (stub mode)"

Risk:

- manual version drift
- no autonomous patching

Next step:

- signed manifest
- secure download
- atomic swap + controlled restart + rollback

## 4) Secrets stored in ProgramData (`config.env`)

Current state:

- `AGENT_TOKEN` and runtime config are stored in plaintext file under ProgramData

Risk:

- local token exposure by privileged users/processes

MVP mitigation:

- lock down ACL to `SYSTEM` + `Administrators`
- never print secrets in logs

Next step:

- DPAPI/Credential Manager backed secret storage

## 5) No local diagnostics UI

Current state:

- troubleshooting is log-based only

Risk:

- higher support effort for non-technical operators

Next step:

- minimal local status surface (CLI or read-only UI)

## 6) Enrolment idempotency and lifecycle hardening

Current state:

- backend enrolment is idempotent by (`tenant_id`, `machine_fingerprint`)
- existing fingerprints update volatile metadata instead of duplicating logical agent

Risk:

- stale/compromised runtime token lifecycle (revocation/rotation process maturity)

Next step:

- define explicit runtime token rotation/revocation operations
- add operator runbook for incident token rollover

## 7) Retry policy is documented but needs hard guarantees

Current state:

- retry policy enforced in runtime code: base `5s`, factor `2`, cap `300s`, jitter `20%`, infinite retry
- backoff behavior covered by automated unit test

Risk:

- limited observability of retry metrics at fleet scale

Next step:

- add structured retry counters/telemetry for fleet monitoring

## 8) ProgramData ACL policy must be enforced by installer code

Current state:

- installer applies ACL hardening in `[Code]` post-install step
- install aborts when ACL hardening fails

Risk:

- hosts with custom policy can still block ACL command execution

Next step:

- add dedicated install smoke check in CI/QA matrix to validate ACL commands on target OS builds

## 9) Strategic items intentionally deferred

- multi-channel release management
- structured heartbeat/offline agent alerting
- backend-driven remote config UI
- full updater trust chain

## Executive summary

Critical before scale:

- embedded bootstrap token controls
- code signing
- ProgramData ACL enforcement
- enrolment idempotency

Important after MVP:

- real updater
- heartbeat/health reporting
- stronger secret storage
- local diagnostics surface
