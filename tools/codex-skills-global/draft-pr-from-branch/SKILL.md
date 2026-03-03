---
name: draft-pr-from-branch
description: Generate an offline PR title and PR description by comparing the current Git branch against a base branch (default `main`), then enrich the result using commit hashes and changed PRD files before returning paths and full text.
---

# Draft PR From Branch

## Goal

Generate a **review-ready** PR draft offline.

The shell script output is only a baseline. You must enrich title/description using:
- commit hashes and commit-level file scopes
- changed `tasks/prd-*.md` files (when present)

## Run

From the target repository, run:

```bash
~/.codex/skills/draft-pr-from-branch/scripts/generate_pr_draft.sh --base main --outdir /tmp
```

Optional arguments:

- `--base <branch>`: Base branch (defaults to `main`)
- `--repo <path>`: Repository path (defaults to current directory)
- `--outdir <path>`: Output folder (defaults to `/tmp`)

## Mandatory Post-Script Enrichment

After running the script, always enrich in this order (offline only):

1. Resolve branch/base context and commit set
- `git rev-parse --abbrev-ref HEAD`
- `git log --oneline --no-merges <base>..HEAD`
- `git rev-list --reverse <base>..HEAD`

2. Inspect each commit hash to understand intent/scope
- `git show --quiet --format='%h %s%n%b' <hash>`
- `git show --name-status --format='' <hash>`

3. Detect PRD context
- Find changed `tasks/prd-*.md` from diff/commit file list.
- If found, read PRD sections (context, objective, scope, acceptance, constraints) and reflect them in the PR narrative.

4. Rewrite generated files in place
- Overwrite `TITLE_PATH` with a clearer title that reflects the feature outcome (not only first commit subject).
- Overwrite `DESCRIPTION_PATH` with enriched content grounded on:
  - problem/context and objective
  - what was implemented (by module/layer)
  - architectural guarantees/boundaries preserved
  - test and validation coverage
  - commit-hash mapping (short hash + intent)
  - known non-goals/out-of-scope items

## Enriched Description Structure (Recommended)

Use this structure unless the repo has a stronger house style:

1. `Summary`
2. `PRD Context` (if `tasks/prd-*` changed)
3. `What Was Implemented`
4. `Architectural Guarantees`
5. `Test Coverage / Quality Gates`
6. `Hash Mapping` (short hash -> delivered increment)
7. `Out of Scope`
8. `Validation` checklist

## Output Contract

Always return to the user:

1. `TITLE_PATH`
2. `DESCRIPTION_PATH`
3. Full title text
4. Full description text

The script writes:
- `pr-<branch-slug>-title.txt`
- `pr-<branch-slug>-description.md`

Here, `<branch-slug>` is a slugified form of the git branch name (for example, `feat/x` becomes `feat-x`).

## Behavior

- Keep execution fully offline (Git local data only; no API calls).
- Resolve base branch locally from either `refs/heads/<base>` or `refs/remotes/origin/<base>`.
- Do not return raw script template when commit/PRD context is available.
- Prefer concrete statements linked to observed commits/files over generic wording.

## Failure Handling

If the script fails, report the exact error and next action:

- Base branch not found locally: ask user for another local base or to fetch externally.
- Not a git repository: ask user for `--repo` path.
- No commits vs base: return generated files anyway and mention empty diff.

If enrichment input is missing:
- No `tasks/prd-*` changed: continue enrichment using commits/files only.
- Commit list empty: keep baseline output and explicitly state no diff was found.
