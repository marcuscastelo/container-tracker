# Project Overview: Container Tracker

## Purpose
A platform for tracking shipping containers across multiple carriers (CMA CGM, Maersk, MSC, etc.), focused on operational reliability, explainable UX, and robust normalization of inconsistent external data. The system does not trust raw API events; it collects immutable snapshots, derives normalized facts (Observations), and projects operational status and alerts internally.

## Domain Principles
- Snapshots are immutable and always persisted
- Observations are semantic, idempotent, deduplicable facts
- Status is a monotonic projection (never regresses)
- Alerts are derived, auditable, and explainable
- UI never derives domain logic
- Strong typing (no `any`, no `as`)

## Key Concepts
- Shipment: Aggregates containers, main dashboard unit
- Container: Physical entity, belongs to one shipment
- Snapshot: Raw API response, immutable
- Observation: Normalized fact, derived from snapshots
- Timeline: Ordered sequence of observations (can have cycles)
- Status: Collapsed projection from timeline (monotonic)
- Transshipment: Derived attribute, not a status
- Alerts: Fact-based (can be retroactive) and monitoring (time-based)

## Architecture
- Domain: Pure derivation rules, canonical types
- Application: Orchestrates pipelines, coordinates adapters, persists facts
- Infrastructure: Fetchers, connectors, raw payload adaptation
- UI: Presents projections and history, never calculates domain rules

## Immediate Priorities
1. Pure derivation engine
2. Alerts (fact + monitoring)
3. Email alerts MVP
4. Reliable timeline
5. Observability (Sentry/OTel)

## Roadmap
- Derivation engine
- Process fields + bug fixes
- Clear timeline
- Transshipment detection
- Strong alerts
- Automatic email notifications

## Reference Documents
- `docs/master-consolidated-0209.md` (canonical)
- `docs/roadmap-consolidated-0209.md` (roadmap)

---
This memory summarizes the high-level purpose, domain, and architecture of the Container Tracker project. For detailed rules and implementation, see the referenced documents.