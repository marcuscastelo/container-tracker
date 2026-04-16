---
name: gh-apply-labels
description: Apply repo-consistent labels to GitHub issues, pull requests, and milestone batches. Use when asked to triage, classify, relabel, or batch-label one or more issues or PRs, including all issues in one or more milestones.
---

# GitHub Labeler

## Goal

Assign the most appropriate repo labels to GitHub work items while preserving existing correct labels.

## Workflow

### 1. Resolve targets

- Accept issue numbers, issue URLs, PR numbers, PR URLs, lists of targets, and milestone names or URLs.
- If a milestone is provided, expand it to the issues it contains.
- Deduplicate targets before labeling.
- Never label the same item twice in one run.

### 2. Inspect each target

- Fetch title, body, current labels, state, milestone, and any linked context.
- For PRs, inspect draft state, changed files, and review state when needed.
- Prefer `gh issue view` and `gh pr view` with `--json` for deterministic context.

### 3. Infer labels

- Use `references/label-taxonomy.md` as the source of truth for available labels and their meaning.
- Apply one primary type label when there is a clear fit.
- Add one or more `area:*` labels when the impacted subsystem is clear.
- Add one status label only when it matches the current lifecycle.
- Add one `complexity-*` label only when the scope estimate is high confidence.
- Preserve correct existing labels. Remove contradictory labels only when the evidence is strong.

### 4. Apply labels

- Use `gh issue edit <num> --add-label ...` for issues.
- Use `gh pr edit <num> --add-label ...` for PRs.
- For milestone batches, label the expanded items one by one.
- If the user provides explicit labels, apply them too, but do not skip repo-standard labels unless asked.

### 5. Verify and summarize

- Re-read the target after editing.
- Summarize which labels were added, which existing labels were preserved, and any ambiguities.

## Guardrails

- Milestones themselves are not labeled; label the issues inside them.
- Do not invent labels outside the repo taxonomy.
- Do not reclassify unrelated items just because they were included in a batch.
- If the target is ambiguous, choose the safest label set and note the uncertainty.

## Examples

- `gh-apply-labels` on issue `#123`
- `gh-apply-labels` on `#123, #124, #125`
- `gh-apply-labels` on milestone `v1.4.0`
- `gh-apply-labels` on PR `#88`
