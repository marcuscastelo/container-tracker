# modules/container

Purpose: container entity types and persistence (CRUD).

Structure:
- domain/container.ts — Container & NewContainer types
- infrastructure/persistence/ — Supabase repository & mapper

Notes:
- Tracking logic (snapshots, observations, alerts, status derivation) lives in `modules/tracking`.
- Carrier API schemas and normalizers also live in `modules/tracking`.
