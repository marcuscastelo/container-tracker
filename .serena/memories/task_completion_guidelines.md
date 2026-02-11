# Task Completion Guidelines: Container Tracker

## Checklist for Completing a Task
1. Ensure domain rules are respected (see `.github/copilot-instructions.md`)
2. Run `pnpm run check` (lint, type-check, test)
3. Run `pnpm run i18n:check` if i18n keys were added/changed
4. Validate UI states: loading, empty, error, ready
5. Confirm no domain logic in UI components
6. Ensure new code uses strict typing, no `any`, no `as` (except `as const`)
7. Add new i18n keys to all locale files
8. Update tests for new domain rules or edge cases
9. Document changes in relevant files (README, docs)

## After Completion
- Commit changes with clear, operational message
- Push branch and open PR if required
- Reference relevant roadmap or master doc for context

---
This memory provides a checklist for task completion, ensuring domain, code style, and operational requirements are met.