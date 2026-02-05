# modules/dashboard

Purpose: read-models and presenters for dashboard UI.

Structure:
- domain/ (may be thin or empty)
- application/
- infrastructure/ (optional)
- ui/
- index.ts

Notes:
- Keep heavy logic in application/read-model builders.
- UI components must remain pure.
