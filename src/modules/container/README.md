# modules/container

Purpose: container domain (status derivation, canonical mapping, adapters).

Structure:
- domain/
- application/
- infrastructure/
- index.ts

Notes:
- Keep domain pure and fully typed.
- Adapters live under `infrastructure/adapters`.
- Read tests under `tests/`.
