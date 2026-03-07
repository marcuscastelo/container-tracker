# Typography audit & proposed hierarchy — Container Tracker

Date: 2026-03-07

This document contains the inventory of font-size usages across the UI, a compact semantic scale proposal, an implementation foundation (tokens added to `src/app.css`) and a migration table with recommendations for an incremental rollout.

## 1) Font Size Inventory

Summary: searches across `src/` show many distinct literal font-size uses (arbitrary px classes and Tailwind named sizes). The codebase already declared a small set of numeric variables in `src/app.css` but components use both those tokens and many ad-hoc classes such as `text-[10px]`, `text-[13px]`, `text-micro`, `text-label`, `text-sm`, `text-xs`, `text-[9px]`, `text-[22px]` and more. Below are the primary tokens/classes found, approximate frequency (from repo search), representative files and notes.

| current token/class                        |                              approx px |        approx rem |     occurrences (approx) | main files where found                                                                     | notes                                                                        |
| ------------------------------------------ | -------------------------------------: | ----------------: | -----------------------: | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `text-micro`                               |                                   10px |          0.625rem |                      ~31 | many: `TimelineNode`, `ShipmentHeader`, `DashboardProcessTable`, `OperationalSummaryStrip` | used for compact uppercase labels, chips, small badges; frequent             |
| `text-[10px]` (literal)                    |                                   10px |          0.625rem |                      ~12 | `Panel`, `TimelineBlocks`, `SearchOverlay`                                                 | ad-hoc duplicates `text-micro` semantics                                     |
| `text-label`                               |                                   11px |         0.6875rem |                      ~18 | `DashboardProcessTable`, `OperationalSummaryStrip`, `ShipmentHeader`                       | used for small label text in lists and tables                                |
| `text-[11px]`                              |                                   11px |         0.6875rem |                       ~9 | `MetricCard`, `StatusBadge`, `SearchOverlay`                                               | small numeric and badge text                                                 |
| `text-caption`                             |                                   12px |           0.75rem |                       ~3 | `DashboardMetricsGrid`                                                                     | less frequent but used for small descriptive labels                          |
| `text-[12px]`                              |                                   12px |           0.75rem |                       ~5 | `Timeline`, `ActiveFilterChip`                                                             | ad-hoc 12px usage                                                            |
| `text-sm`                                  | 14px-ish (Tailwind default = 0.875rem) |              14px |                      ~50 | forms, buttons, many components (`FormFields`, `Dialog`, `CreateProcessDialog`, nav)       | default small body text and many interactive elements                        |
| `text-[13px]`                              |                                   13px |         0.8125rem |                      ~15 | dropdowns, multi-selects, filters (`ImporterChipDropdown`, `UnifiedDashboardFilters`)      | common for compact inputs/lists                                              |
| `text-body` / `text-body-sm` (custom vars) |                            14px / 13px | 0.875 / 0.8125rem | ~11 (body), ~1 (body-sm) | `DashboardMetricsGrid`, `DashboardProcessTable`                                            | custom variables exist in `src/app.css` but not consistently used everywhere |
| `text-[9px]`                               |                                    9px |         0.5625rem |                       ~9 | `TimelineNode`, small chips, kbd hints                                                     | extremely small; used for micro badges/kbd text                              |
| `text-[22px]`                              |                                   22px |          1.375rem |                       ~2 | `MetricCard`, `DashboardMetricsGrid`                                                       | metric large numbers; limited usage                                          |
| `text-xs`                                  |           12px (Tailwind xs = 0.75rem) |              12px |                      ~27 | tables headers, helper text, chips                                                         | used for helper and uppercase table headers                                  |
| `text-lg` / `text-6xl`                     |                            18px / 32px |      ~1rem / 2rem |              few (4 / 1) | headings, empty state, 404 page                                                            | large headings are present but limited to page titles / 404                  |

Notes & inconsistencies
- There is a mixture of semantic tokens (`text-micro`, `text-label`, `text-caption`, `text-body`) and literal/ad-hoc classes (`text-[10px]`, `text-[13px]`, `text-[9px]`, `text-[22px]`).
- `text-sm` is heavily used as a default small body size, but multiple components use 13px or 14px as their compact size instead of a single `text-sm-ui` token.
- Numeric differences between 11px / 12px / 13px / 14px are often visually irrelevant in a dense UI. Many adjacent tokens can be collapsed.
- Micro badges use both `text-[9px]` and `text-[10px]`/`text-micro` inconsistently.

## 2) Proposed hierarchy (semantic, compact)

Goal: collapse redundant levels into an operational scale with clear semantics for migration. I propose a 6-level core scale plus an optional hero size for rare page headings.

Core tokens (to implement in `@theme`):

1. `text-micro` — 0.625rem (10px) — line-height: 1rem
   - Uses: tiny UI labels, compact uppercase chips, inline badges, timestamp/meta in dense lists, tracker micro-chips.
   - Migrate: `text-[9px]`, `text-[10px]`, many `text-micro` usages that differ by 1px.

2. `text-label` — 0.6875rem (11px) — line-height: 1rem
   - Uses: small badge text, tab labels, compact numeric labels in cards.
   - Migrate: `text-[11px]`, some `text-[12px]` where only slight visual difference exists.

3. `text-caption` — 0.75rem (12px) — line-height: 1rem
   - Uses: table captions, helper text in compact flows, kbd text.
   - Migrate: `text-xs` when used as caption, some `text-[12px]` occurrences.

4. `text-sm-ui` — 0.8125rem (13px) — line-height: 1.125rem
   - Uses: compact body within dense lists, select/dropdown rows, interactive small buttons.
   - Migrate: `text-[13px]`, many `text-sm` in dense controls where 13px was used.

5. `text-base` — 0.875rem (14px) — line-height: 1.25rem
   - Uses: default UI body text, table cells, modal copy, primary labels.
   - Migrate: base `text-sm` body usages and `text-body` variables currently set to 14px.

6. `text-md` — 1rem (16px) — line-height: 1.5rem
   - Uses: emphasized body, prominent buttons, small headings inside cards.
   - Migrate: `text-lg` in some contexts where 16px is enough, `text-[16px]` occurrences.

Optional:
- `text-lg` — 1.375rem (22px) — metrics / section headings / numeric emphasis
- `text-hero` — 2rem (32px) — page-level hero titles (rare)

Rationale:
- This removes fine-grained 9/10/11/12/13/14 split in favor of a semantically named, operational scale.
- The scale prioritizes dense legibility and numeric alignment for metrics (tabular-nums) while keeping a small number of tokens for maintainability.

## 3) Implementation performed

- Added semantic tokens to `src/app.css` using Tailwind v4 `@theme` block. Tokens added include `--text-micro`, `--text-label`, `--text-caption`, `--text-sm-ui`, `--text-base`, `--text-md`, `--text-lg` and `--text-hero` — each with an associated `--*-line-height` token. See `src/app.css` top-level `@theme` block for exact values.

Files changed (foundation only):
- `src/app.css` — replaced old numeric variables with the new semantic tokens (no component edits).

## 4) Migration table (before -> after -> rationale)

| hoje                                     | amanhã                     | motivo                                                                    |
| ---------------------------------------- | -------------------------- | ------------------------------------------------------------------------- |
| `text-[10px]`, `text-[9px]`              | `text-micro`               | collapse micro badges and uppercase chips to single token for consistency |
| `text-[11px]`, `text-[11px]` literals    | `text-label`               | small label/numberize uses align under `text-label`                       |
| `text-xs` (when used for helper/caption) | `text-caption`             | `text-xs` is overloaded; adopt `text-caption` for semantic clarity        |
| `text-[12px]`                            | `text-caption`             | 12px semantics for captions/headers collapse here                         |
| `text-[13px]`                            | `text-sm-ui`               | compact UI rows and selects unify to `text-sm-ui` (13px)                  |
| `text-sm` (when used as primary body)    | `text-base`                | align default body to 14px token `text-base` for predictable spacing      |
| `text-body` / `text-body-sm` variables   | `text-base` / `text-sm-ui` | map existing variables to semantic equivalents and remove duplication     |
| `text-[22px]`                            | `text-lg`                  | metrics and prominent numerics get `text-lg` token                        |
| page title `text-6xl` (ad-hoc)           | `text-hero` (opt-in)       | keep hero as an opt-in token for rare pages                               |

Notes about migration strategy
- Do not do a big-bang replace. Implement tokens and then migrate high-impact components first (see next section).
- Replace literal `text-[NNpx]` only when confident about the visual fit; keep the literal in place for any complex spacing/visual reason until designer sign-off.

## 5) Next steps & recommended rollout (incremental)
1. Merge the foundation token changes (done).
2. Migrate shared UI primitives first (priority):
   - `src/shared/ui/FormFields.tsx` — inputs, labels, helpers
   - `src/shared/ui/AppHeader.tsx` — navbar items and badges
   - `src/shared/ui/StatusBadge.tsx` / `MetricCard.tsx` — badges and metrics
3. Migrate tables and dense lists (dashboard table, timeline nodes) next — these benefit most from consistency.
4. Keep a short visual review checklist: compare before/after for density, wrapping, vertical rhythm; check tabular-nums for numeric tokens.

## 6) Guardrails enforced
- No inline font-size styles introduced by this change.
- Avoid introducing tokens that differ only by 1px unless there is a real visual need.
- Preserve tabular numerals usage where numeric tokens exist (metrics, age, counts).

## 7) Appendix — quick token reference (values implemented in `src/app.css`)

- `--text-micro`: 0.625rem (10px)
- `--text-label`: 0.6875rem (11px)
- `--text-caption`: 0.75rem (12px)
- `--text-sm-ui`: 0.8125rem (13px)
- `--text-base`: 0.875rem (14px)
- `--text-md`: 1rem (16px)
- `--text-lg`: 1.375rem (22px)
- `--text-hero`: 2rem (32px) (opt-in)

---

If you want, I can now:
- prepare a prioritized list of components to migrate (with estimated PR size),
- or perform the first incremental migration (example: replace `text-[10px]`/`text-micro` usages in timeline and shipment header with a single canonical token).

Signed — automated audit run from repository (search performed across `src/`), implementation: added tokens to `src/app.css`.
