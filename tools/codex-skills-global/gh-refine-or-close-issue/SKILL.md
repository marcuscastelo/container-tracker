---
name: gh-refine-or-close-issue
description: Triage a GitHub issue against the current repository state, then either close it as outdated/obsolete or rewrite it into an implementation-ready issue. Use when asked to refine an issue, check whether an issue still makes sense, compare an issue with current code, close an outdated issue, or update an issue description so another engineer can implement it directly.
---

# GH Refine Or Close Issue

## Goal

Decide whether the issue is still actionable in the current codebase.

If the issue is outdated, close it with a concrete rationale grounded in the current implementation. If the issue still makes sense, rewrite the issue body so it is implementation-ready and decision-complete.

## Inputs

Work from:

- issue number, URL, or explicit repository
- the current local checkout when the repo is already available
- the code, tests, docs, and migrations that now represent the source of truth

## Workflow

### 1. Resolve issue context

- Prefer the GitHub connector for fetching issue metadata.
- If needed, use `gh issue view <number>` or `gh issue view <url>` for fields not covered by the connector.
- Capture:
  - current title
  - current body
  - original claim/problem statement
  - linked PRs or review comments if the issue was spawned from review feedback
  - whether the user asked only for analysis or also wants mutation on GitHub

### 2. Compare the issue with the current repo

Inspect the actual implementation before deciding anything.

- Search for the symbols, files, tests, docs, migrations, and behavior named in the issue.
- Prefer local repo truth over historical review text.
- Check whether the original bug/feature:
  - no longer exists
  - was already implemented under a different shape
  - still exists exactly as written
  - still exists, but the correct remaining work is narrower or different now

### 3. Decide between close vs refine

Close the issue when any of these are true:

- the premise is factually obsolete in the current codebase
- the behavior already changed and the remaining concern would require a different issue
- the issue text would now be misleading for an implementer
- there is no active bug/regression left, only a possible cleanup or contract discussion with new scope

Refine the issue instead of closing when:

- the problem still exists
- the intended outcome is still valid
- the repo state is now rich enough that you can specify the work precisely
- a future implementer would benefit from a rewritten body rather than a fresh issue

If the issue is partly obsolete but there is still real remaining work, do not preserve the old wording. Rewrite it around the real remaining problem.

### 4. If closing, leave a concrete closing comment

Use `gh issue close <number> --reason "not planned" --comment "<comment>"` when the issue is outdated or obsolete.

Use `--reason "completed"` only when the exact issue outcome is already implemented and the issue body remains materially accurate.

Ground the comment in repo evidence:

- name the current files/functions that invalidate the original premise
- explain why the old text is no longer a safe implementation target
- explicitly call out follow-up scope when the remaining concern should live in a new issue
- keep the comment short, factual, and decision-oriented

For longer comments, write the text to `/tmp/<issue>-close-comment.md` and pass it to `gh issue close` in a shell-safe way.

### 5. If refining, rewrite the issue body to be implementation-ready

Use `gh issue edit <number> --body-file /tmp/<issue>-body.md`.

Do not only polish wording. Replace vague or stale issue text with a spec that another engineer can implement directly.

The rewritten body must:

- state the current problem, not the historical one
- identify the exact boundary or subsystem to change
- describe the expected behavior after the fix
- note public contract changes when relevant
- include acceptance criteria or test scenarios
- exclude work that is now out of scope

Use the templates in [references/templates.md](references/templates.md).

## Preferred tools

- GitHub connector first for fetching issue metadata
- Local repo inspection for truth:
  - `rg`
  - `sed -n`
  - targeted tests when they help confirm behavior
- `gh issue close` for closing with comment
- `gh issue edit --body-file` for rewriting the body

Use `gh auth status` before mutating issues if CLI auth might be unclear.

## Output contract

When only analyzing, return:

- decision: `close` or `refine`
- short rationale
- exact files/tests/docs used as evidence
- recommended close comment or replacement issue body

When mutating on GitHub, return:

- what changed on GitHub
- the reason used for closing, if applicable
- whether the body was rewritten
- any follow-up issue you recommend opening

## Guardrails

- Never close based only on issue age or intuition.
- Never preserve outdated historical wording just because it was already on GitHub.
- Never rewrite an issue into a broader project plan than the remaining problem justifies.
- Prefer opening a new issue over twisting an obsolete issue into a different scope.
- Keep the refined issue body decision-complete but concise.
