# AGENTS — Container Tracker (Root, Canonical)

This is the canonical instruction file for this repository.

All assistant-specific files (including `.github/copilot-instructions.md`) should point here.
For tracking-only changes, also read `src/modules/tracking/AGENTS.md`.

Goal: preserve domain correctness, auditability, and architectural boundaries.

---

## 0) Read-First (Mandatory)

Before implementing anything non-trivial, consult:

- Product/domain model: `docs/MASTER_v2.md`
- Types and layers rules: `docs/TYPE_ARCHITECTURE.md`
- BC vs capability boundaries: `docs/BOUNDARIES.md`
- Tracking invariants: `docs/TRACKING_INVARIANTS.md`
- Event series semantics: `docs/TRACKING_EVENT_SERIES.md`
- Alert policy: `docs/ALERT_POLICY.md`
- High-level architecture: `docs/ARCHITECTURE.md`
- Roadmap: `docs/ROADMAP.md`

If any canonical file is missing/renamed, stop and ask for the correct path.

---

## 1) Architecture (Non-Negotiable)

### 1.1 Bounded Contexts (`src/modules/*`)
BCs own semantics and domain rules.

- `process`: shipment/process grouping and read models
- `container`: container identity and association to process
- `tracking`: snapshots, observations, timeline/status/alerts derivation, carrier integration

### 1.2 Capabilities (`src/capabilities/*`)
Capabilities orchestrate across BCs.

- May depend on `modules/*/application`
- Must not import `modules/*/domain`
- Must not define canonical domain semantics
- Modules must never depend on capabilities

---

## 2) Domain Invariants

- Snapshots are immutable (no in-place update)
- Observations are append-only (no delete/rewrite)
- Status is derived, never primary truth
- Raw payload must always be preserved
- Conflicts/uncertainties are exposed, never hidden
- Incomplete data is valid domain input:
  ETA missing must be explicit, timeline gaps are tolerated, UI must explain absence

### Event Series
- `event_time_type` is `ACTUAL | EXPECTED`
- Semantic observations form a series
- One series generates exactly one timeline primary
- If there is ACTUAL: primary is latest ACTUAL
- If no ACTUAL: primary is latest valid EXPECTED
- EXPECTED after ACTUAL is preserved fact, redundant for display
- Multiple ACTUAL in same series is conflict (preserve facts + signal uncertainty)
- `EXPIRED_EXPECTED` is derived state, never persisted as fact mutation

---

## 3) Alerts

- Fact alerts: fact-derived, can be retroactive, mark `retroactive: true` when applicable
- Monitoring alerts: time-dependent (`now`), must not be retroactive
- Never delete facts to clean noise

---

## 4) Type and Layer Rules

- `any` forbidden; use `unknown` + explicit guards
- `readonly` whenever applicable in domain/application contracts
- `as` forbidden (except `as const`)
- Dynamic `await import(...)` is forbidden
- No `Partial<Entity>` input contracts
- Repositories must not return `{ success: boolean }`
- Repositories must not swallow errors
- Repositories must not receive Commands directly
- Distinct shapes must not be mixed:
  Row (infra) != Entity (domain) != DTO (interface) != ViewModel (UI)
- `snake_case` only in persistence and persistence mappers
- Prefer named exports; avoid `export default`
- Root tooling configs (for example `eslint.config.mjs`) are linted by Biome import rules:
  avoid `./` or `../` imports there and prefer `package.json` `imports` aliases (`#...`)
- For local ESLint plugins authored in `.mjs`, prefer rule tests in `*.test.mjs`;
  TypeScript `*.test.ts` can fail strict plugin-shape checks during `pnpm run type-check`

---

## 5) UI Responsibilities

UI may:
- format dates/locales
- apply i18n
- render uncertainty states
- manage interaction state

UI must not:
- derive domain truth (status/timeline/alerts)
- classify/reconcile tracking series
- mutate facts
- import `modules/*/domain` for semantic derivation

---

## 6) SolidJS and i18n Discipline

- Use `createSignal` for state, `createMemo` for derivation
- Use `createEffect` only for side effects
- In component helpers, read `props.*` inside JSX/tracked scopes (or through accessors) to satisfy `solid/reactivity`
- Keep explicit UI states: `loading | empty | error | ready`
- Do not use hardcoded literal keys in `t()`
- Prefer `const { t, keys } = useTranslation()` and `t(keys.someKey)`
- When adding i18n keys, run: `pnpm i18n:check`

---

## 7) Security and Validation

- Treat all external input as hostile
- Validate boundaries with Zod
- Keep explicit timeouts and rate limits in integrations
- Never render raw unsafe HTML from external payloads

---

## 8) Testing Expectations

For domain-sensitive changes, tests should cover:

- timeline derivation
- series classification
- expected expiration
- conflicting ACTUAL
- retroactive alerts
- UI visibility for empty/error/conflict states

Prefer deterministic fixtures and stable tests.

Additional repo testing convention:
- Keep large test suites under ESLint `max-lines-per-function` limits by extracting repeated fixture builders/helpers out of long `describe` callbacks.

---

## 9) Anti-Patterns (Forbidden)

- Deleting old EXPECTED observations
- Recomputing domain status in UI
- Persisting status as primary source of truth
- Suppressing conflicting ACTUAL facts
- Inventing carrier behavior not evidenced by payloads/spec
- Hiding uncertainty (ETA unknown, ACTUAL conflicts, parse failures)
- Introducing generic abstractions without clear domain backing
- Using type assertions to force invalid data through
- Importing domain from capability layer

---

## 10) Decision Matrix

If you modify:

- `src/modules/tracking/domain/*` -> re-read `docs/TRACKING_INVARIANTS.md` and `docs/TRACKING_EVENT_SERIES.md`
- alerts logic -> re-read `docs/ALERT_POLICY.md`
- boundaries/dependencies -> re-read `docs/BOUNDARIES.md`
- type/DTO contracts -> re-read `docs/TYPE_ARCHITECTURE.md`
- product/domain wording -> re-read `docs/MASTER_v2.md`

---

## 11) Pre-Commit Checklist

- Preserved snapshot immutability and observation append-only?
- Preserved one-primary-per-series?
- Kept domain logic out of UI?
- Kept module/capability boundaries intact?
- Avoided `any`, unsafe `as`, and `Partial<Entity>` contracts?
- Kept `snake_case` confined to persistence?

If any answer is "not sure", stop and re-check canonical docs.

---

## 12) Core Principle

States are derived from events.
Events are derived from snapshots.
Snapshots are never discarded.
UI never defines domain truth.

---

## 13) Historical Docs

Files under `docs/0204/*` are historical context only.
For current decisions, always prioritize the canonical docs listed in section 0.

---

## 14) Copy/Paste Output Preference

When returning content intended to be copied and pasted (for example PR title/description, changelog blocks, release notes, shell snippets, or templates):

- Prefer wrapping the whole payload with **4 backticks** (```` ... ````) to avoid nesting issues.
- If the output is long/structured, a canvas-like alternative is acceptable, but default is still 4 backticks for plain copy/paste.

---

## 15) Git and Sandbox Execution

Definitions:

- **Sandbox** = restricted execution environment (limited filesystem/process/network, sometimes isolated from host `ssh-agent`).
- Some assistants run with sandboxing; others run directly on host without sandbox.

Rules:

- If sandbox exists, **never run Git commands inside sandbox**.
- Always run Git commands with non-sandbox/external execution so commit signing, credentials, and agent access behave correctly.
- If the assistant has no sandbox feature, treat host execution as compliant and proceed normally.

Why:

- Git operations (especially signed commits) can fail inside sandbox due to missing agent/key access and askpass crashes.

---

## 16) Ralph Loop + Devcontainer Patterns

- `tools/ralph-loop` is an external Git submodule; treat it as third-party code and do not apply root lint/type-check rules to it.
- Use the local wrappers in `scripts/ai/` (exposed as `pnpm run ai:loop:*`) instead of calling `tools/ralph-loop/ralph.sh` directly.
- Devcontainer policy allows commit-in-container and branch push-in-container for Ralph loop completion; dangerous pushes remain blocked by guard scripts (`main/master`, deletion refspecs, force/mirror/all) and destructive local Git commands are still blocked.
- For Maersk Puppeteer flows in devcontainer, keep Chromium provisioned in `.devcontainer/Dockerfile` and set `CHROME_PATH=/usr/bin/chromium` in `.devcontainer/devcontainer.json`.
- Keep Chromium version pinned via `.devcontainer/devcontainer.json` `build.args.CHROMIUM_VERSION` and install it as an exact package version in `.devcontainer/Dockerfile`.
- Do not add Chromium auto-update logic to `.devcontainer/post-create.sh`, `.devcontainer/post-start.sh`, or refresh workflows; version bumps must happen in explicit PRs.
- Before debugging `/api/refresh-maersk/:container`, run `pnpm run maersk:smoke:puppeteer` to validate browser launch and classify failures as `missing_browser_binary`, `invalid_chrome_path`, or `launch_incompatibility`.
- For `/api/refresh-maersk/:container` smoke, minimum pass criterion is response output not containing `Browser launch failed`; provider-side `403/502` responses are acceptable for this smoke if launch succeeded.

---

## 17) PRD-to-Implementation Workflow (Canonical)

When the request is to implement an existing PRD, the default path is:

1. Place or identify the PRD:
   - Markdown: `tasks/prd-<feature>.md`
   - JSON (Ralph schema): `.ralph-loop/<feature>/prd.json`
2. Start with one command:
   - `pnpm run ai:loop:start -- <feature-key> <prd-source>`
3. Review results:
   - Plan: `.ralph-loop/<feature-key>/prd.json`
   - Progress log: `.ralph-loop/<feature-key>/progress.txt`
   - Input: `.ralph-loop/<feature-key>/input.json`
4. If an active Ralph loop is running, finish by pushing the current implementation branch (`git push`) after commits are created. Never push/delete protected branches (`main`/`master`).

Rules:

- If a valid existing PRD is present, do not re-plan/refine before execution.
- Prefer `ai:loop:start` over chaining `plan -> input -> exec` manually.
- Use `--prepare-only` when user wants artifacts generated without running loop execution.
- After implementation in an active Ralph loop, prefer preparing/opening a PR with the `$draft-pr-from-branch` skill when applicable.
- The agent must never merge PRs.

---

## 18) Skills (Global + Versioned Snapshot)

Global runtime skills live under:

- `~/.codex/skills/*`

Versioned snapshot (for repo history/review) lives under:

- `tools/codex-skills-global/*`

Sync policy:

- After creating/updating global skills, run `pnpm run ai:skills:sync`.
- Commit snapshot changes so team can review skill evolution.
- Do not edit snapshot files manually; edit global source skill first, then sync.

Current custom automation skill:

- `implement-existing-prd`:
  - Detects best existing PRD (`md/json`)
  - Infers feature key
  - Runs `pnpm run ai:loop:start` with sensible defaults

---

## 19) Playwright Visual Validation (Codex CLI)

Use this when implementing or reviewing any UI/UX change.

Policy:

- Any UI/UX change is only complete after visual validation with screenshots.
- Playwright MCP must be used ad hoc for manual validation flows; do not run automated test suites with Playwright MCP by default.
- Exception: running or wiring Playwright test suites is allowed only when the task explicitly involves implementing or maintaining automated tests (unit/integration/e2e).
- Do not run ad hoc `node`/JavaScript scripts that import Playwright for routine validation; use Playwright MCP directly in Codex CLI or Codex + VSCode.
- Exception: ad hoc JavaScript Playwright scripts are allowed only when a concrete MCP limitation (missing tools/capabilities or equivalent blocker) requires that fallback.
- Always validate at least desktop + mobile.
- Quality gate mindset is mandatory: ask and answer
  - "Ficou de acordo com o site?"
  - "Ficou visualmente bom?"
- Prefer slower and polished over fast and rough for UI work.

Dev server strategy:

1. Assume the dev server may or may not already be running.
2. Prefer an isolated run first, always in the same execution context/network namespace where Playwright MCP is running:
   - `pnpm run dev -- --host localhost --port 3009`
3. If `3009` is unavailable, use the allocated port and continue with the reported URL.
4. Fallback only when starting a new isolated server is not trivial: probe existing local routes in this order and keep the first that responds:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`

Screenshot commands (recommended baseline):

- Desktop:
  - `pnpm exec playwright screenshot --wait-for-timeout 8000 --full-page http://localhost:<PORT> /tmp/pw-local-real.png`
- Mobile:
  - `pnpm exec playwright screenshot --device="Pixel 5" --wait-for-timeout 8000 --full-page http://localhost:<PORT> /tmp/pw-local-real-mobile.png`

Timing and stability:

- Use `--wait-for-timeout 8000` as default (8s).
- Increase wait (`12000-15000`) when page depends on async fetch/hydration/animations.
- Keep `--full-page` enabled unless the task explicitly targets viewport-only behavior.

Blank/gray screenshot troubleshooting:

1. If screenshots are blank/gray, suspect sandbox/browser runtime constraints first.
2. Re-run Playwright screenshot commands with non-sandbox/external execution.
3. Sanity-check browser capture with a known page (`https://example.com`) if needed.
4. Then retry local app capture.
5. If `127.0.0.1` fails but `localhost` works, keep `localhost` (common loopback/IPv6 binding behavior) and continue.
6. If local routes still fail, start `pnpm run dev` in the same context as Playwright MCP and retry.

Output expectation for UI tasks:

- Provide screenshot file paths in the response.
- Mention which route was validated.
- Explicitly state whether UI is aligned and visually good based on the two quality questions above.

---

## 20) PR Review Feedback Retrieval (GitHub API + Credential Helper)

Use this flow when the user asks to read/apply PR suggestions, review comments, or "implementar sugestões do PR".

Preferred command:

- `pnpm run ai:pr:feedback -- <pr-number>`

Direct script:

- `bash scripts/ai/github-pr-feedback.sh <pr-number> [--repo <owner/repo>] [--kind <all|comments|reviews|issue-comments>]`

Behavior:

- The script authenticates via `git credential fill` (no manual token copy/paste).
- If `--repo` is omitted, it infers `<owner/repo>` from `origin`.
- `--kind all` returns review comments (`pulls/:number/comments`), reviews (`pulls/:number/reviews`), and issue comments (`issues/:number/comments`) in one JSON payload.

Execution guideline for PR-suggestion tasks:

1. Fetch feedback with `ai:pr:feedback`.
2. Prioritize actionable code suggestions (correctness/performance/tests/clarity).
3. Implement what is technically sound and aligned with architecture/invariants.
4. Run required checks/build and keep it green before commit.

---

## 21) Serena MCP for Semantic Refactors (Codex CLI)

Use this flow when refactoring symbols across files (rename, method extraction, call-site updates) and prefer semantic/LSP edits over plain regex replacements.

Codex CLI MCP config (`~/.codex/config.toml`):

```toml
[mcp_servers.serena]
command = "uvx"
args = ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--context", "ide", "--project-from-cwd"]
```

Guidelines:

- Keep `.serena/project.yml` aligned with the repo languages (for this repo: `typescript`).
- For code refactors, prefer Serena symbolic tools (`find_symbol`, `find_referencing_symbols`, `rename_symbol`, `replace_symbol_body`).
- Use plain text/regex replacement only for non-code artifacts or when symbol-level operations are not applicable.
- If Serena bootstrap/cache/network fails under sandbox constraints, rerun outside sandbox.

## 22) UI Complexity Guardrail (JSX max depth / `ui:complexity:ci`)

When `ui:complexity:ci` or JSX max depth fails, **do not “game” the rule** by replacing `<Show>` / `<For>` with inline JavaScript conditionals or by moving the same branching into component-level early returns.

This includes forbidden patterns such as:

- `{condition && <Component />}`
- `{condition ? <A /> : <B />}`
- nested ternaries inside JSX
- inline `.map()` chains used to avoid `<For>`
- `if (x) return ...` / `if (y) return ...` chains at component top level used only to bypass JSX nesting checks

These are **not valid fixes**. They hide structural complexity instead of reducing it.

### Forbidden response to complexity failures

Do **not** resolve JSX complexity by:

- swapping `<Show>` for `&&`
- swapping `<Show>` for ternary-only JSX
- swapping `<For>` for inline `.map()` inside large JSX trees
- replacing nested JSX with top-level early returns for each branch
- collapsing multiple branches into one long return block
- moving nested JSX into anonymous inline render lambdas without semantic extraction

### Correct way to reduce UI complexity

Reduce complexity by **changing structure**, not syntax.

Preferred strategies, in order:

1. **Extract child components**
   - If a JSX branch represents a semantic UI block, extract it to a named component.
   - Typical candidates:
     - loading block
     - error block
     - empty state block
     - table row
     - table cell variant
     - toolbar section
     - alert summary
     - timeline item
     - panel body
     - modal body

2. **Extract branch bodies into named components**
   - Keep the parent structure explicit with `<Show>` / `<For>`.
   - Make each branch shallow by rendering a dedicated child component instead of large inline JSX.
   - Example:
     - bad: large `<Show when=...>{...huge JSX...}</Show>`
     - good: `<Show when=...><ShipmentEmptyState /></Show>`

3. **Prepare display data before JSX**
   - Compute booleans, labels, grouped collections, display flags, and UI-only formatting before rendering.
   - JSX should mostly render already-prepared view data.
   - UI may map DTO → ViewModel, but must not re-derive domain truth.

4. **Split by responsibility**
   - Parent component: orchestration and layout composition
   - Child component: focused rendering of one region
   - List item component: rendering of one repeated unit
   - Variant component: rendering of one state-specific body

5. **Flatten repeated markup into semantic building blocks**
   - Repeated wrappers, badges, rows, cells, and metadata blocks should become explicit components.
   - Prefer named structure over duplicated JSX fragments.

6. **Move non-trivial `<For>` bodies into item components**
   - Keep `<For>` when iterating.
   - Reduce complexity by extracting the item renderer into a named component such as:
     - `<ProcessRow />`
     - `<AlertListItem />`
     - `<ContainerSummaryItem />`

### Keep Solid semantics explicit

`<Show>` and `<For>` are preferred when the UI is actually expressing rendered structure.
They are **not** the problem.
The problem is excessive responsibility and deeply nested inline JSX.

Good:
- shallow `<Show>` / `<For>`
- named subcomponents
- prepared ViewModels
- explicit UI regions
- small, reviewable JSX bodies

Bad:
- giant monolithic JSX return
- syntax swapping to satisfy lint
- top-level early-return branching instead of structural extraction
- hiding complexity in inline lambdas or expressions

### Architectural rule

UI is a presentation layer. It may:

- map DTO → ViewModel
- sort/filter/group for display
- format dates/labels
- manage interaction state

UI must **not**:

- re-derive domain semantics
- reinterpret tracking truth
- reimplement status/alert/timeline derivation

When reducing complexity, extract **presentation structure only**.
If simplification requires semantic re-derivation, move that responsibility to the proper backend/read-model owner.

### Review heuristic

A complexity fix is acceptable only if it improves at least one of these:

- smaller inline JSX regions
- fewer responsibilities per component
- clearer semantic naming of UI regions
- better reviewability and reuse
- better boundary adherence

If the diff only replaces `<Show>` / `<For>` with `&&`, ternary, `.map()`, or top-level `return` branches, it is not a real fix and should be rejected.

### Non-negotiable rule

`ui:complexity:ci` must be solved by **component extraction and responsibility split**.

It must **not** be solved by:
- `&&`
- ternary JSX
- inline `.map()`
- top-level early returns
- anonymous render helpers returning JSX