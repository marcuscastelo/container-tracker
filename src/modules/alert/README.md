# modules/alert

Purpose: domain and application logic for alerts generation and lifecycle.

Structure:

- domain/
  - alert.ts
  - alertRepository.ts
- application/
  - alertUseCases.ts
- infrastructure/
  - supabaseAlertRepository.ts
- index.ts

Notes:
- Domain contains the canonical `Alert` entity and invariants.
- Application exposes use-cases (generate, ack, expire alerts).
- Infrastructure contains persistence adapters.
