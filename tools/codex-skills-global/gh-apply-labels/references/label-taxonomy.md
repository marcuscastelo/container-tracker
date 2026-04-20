# Label Taxonomy

Use the current repo labels as the source of truth.

## Primary labels

- `bug`: broken behavior, regression, wrong output, or incorrect runtime state.
- `feature`: a new capability, flow, or user-facing behavior.
- `improvement`: an incremental UX or behavior improvement.
- `refactor`: an internal change that preserves behavior.
- `task`: implementation work or maintenance that does not fit another type.
- `subissue`: a child issue split out from a larger item.
- `docs`: documentation-only work.
- `test`: automated tests or test infrastructure.
- `chore`: maintenance, cleanup, dependency updates, or bot/admin work.
- `perf`: performance improvement or optimization.
- `security`: security hardening or vulnerability follow-up.

## Area labels

- `area:tracking`: snapshots, observations, timeline, alerts, carrier integration.
- `area:process`: shipment or process grouping, read models, and related UI.
- `area:container`: container identity, association, and reconciliation.
- `area:ui`: SolidJS views, components, and presentation logic.
- `area:infra`: persistence, integrations, API wiring, and backend infrastructure.
- `area:ci`: build, lint, tests, release, and GitHub Actions.
- `area:docs`: product, domain, and technical documentation.
- `area:i18n`: translations, locale handling, and copy updates.

## Status labels

- `status:needs-triage`: needs review and classification.
- `status:needs-spec`: scope or acceptance criteria are unclear.
- `status:needs-design`: UI or product design alignment is required.
- `status:blocked`: blocked by a dependency or external constraint.
- `status:ready-for-dev`: ready for implementation.
- `status:in-progress`: work has started.
- `status:needs-review`: ready for code or product review.
- `status:needs-info`: more information is required.

## Complexity labels

- `complexity-low`: small, contained, low risk.
- `complexity-medium`: moderate scope or multiple touchpoints.
- `complexity-high`: broad or risky, likely needs decomposition.

## Selection rules

- Prefer one primary type label.
- Add one or more area labels when the impacted subsystem is clear.
- Add one status label only when it reflects the current lifecycle.
- Add one complexity label only when confidence is high.
- Preserve correct existing labels.
- Remove contradictory labels only when evidence is strong.
- For milestones, expand to the issues they contain; the milestone itself is not labeled.
- For PRs, use the same taxonomy, but prefer review-state status labels over issue-lifecycle labels.
