---
name: draft-pr-from-branch
description: Generate an offline PR title and PR description by comparing the current Git branch against a base branch (default `main`), write the outputs to `/tmp`, and return both file paths and full text to the user. Use when the user asks for PR draft text, PR title/description generation, or branch-vs-main change summaries without network access.
---

# Draft PR From Branch

## Run

From the target repository, run:

```bash
~/.codex/skills/draft-pr-from-branch/scripts/generate_pr_draft.sh --base main --outdir /tmp
```

Optional arguments:

- `--base <branch>`: Base branch (defaults to `main`)
- `--repo <path>`: Repository path (defaults to current directory)
- `--outdir <path>`: Output folder (defaults to `/tmp`)

## Output Contract

Always return to the user:

1. `TITLE_PATH`
2. `DESCRIPTION_PATH`
3. Full title text
4. Full description text

The script prints these values and writes:

- `pr-<branch>-title.txt`
- `pr-<branch>-description.md`

## Behavior

- Keep execution fully offline (Git local data only; no API calls).
- Resolve base branch locally from either `refs/heads/<base>` or `refs/remotes/origin/<base>`.
- Build title using branch heuristics and commit subjects.
- Build description with commits, changed files, diffstat, and a validation checklist.

## Failure Handling

If the script fails, report the exact error and next action:

- Base branch not found locally: ask user for another local base or to fetch externally.
- Not a git repository: ask user for `--repo` path.
- No commits vs base: return generated files anyway and mention empty diff.
