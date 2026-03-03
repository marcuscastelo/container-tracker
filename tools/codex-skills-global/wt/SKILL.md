---
name: wt
description: "Resolve loose PRD paths in tasks/ and run `pnpm run ai:wt-implement`. Use when the user writes `$wt <prd path loose match>` or asks to scaffold a worktree from a PRD without the exact path."
---

# Worktree Implement

Resolve an imprecise PRD reference to one `tasks/*.md` file and execute the repository scaffold flow (`ai:wt-implement`).

`ai:wt-implement` is responsible for:
- creating the worktree/branch,
- copying allowed seed files (for now, `.env` via allowlist),
- running `pnpm install` in the new worktree,
- opening a new VS Code window (unless `--no-open`).

## Workflow

1. Parse input in this shape: `$wt <prd-query> [-- <wt-implement flags>]`.
2. Execute:

```bash
python3 ~/.codex/skills/wt/scripts/wt_implement_from_query.py <prd-query> -- <wt-implement flags>
```

3. If the script reports ambiguity, ask for one disambiguation input and rerun.
4. Always print the ready-to-run Ralph loop command block:

```bash
cd <resolved-worktree-path>
pnpm run ai:loop:start -- <feature-key> <resolved-prd-path> --agent codex --max-iterations 10 --dangerous-exec 1 --exec-retries 2
```

5. Report the resolved PRD file and the resulting branch/worktree details.

## Examples

```bash
python3 ~/.codex/skills/wt/scripts/wt_implement_from_query.py prd-worktrees
python3 ~/.codex/skills/wt/scripts/wt_implement_from_query.py devcontainer chromium -- --print-only
python3 ~/.codex/skills/wt/scripts/wt_implement_from_query.py worktrees -- --wt-root /home/node/wt --branch-prefix feat/
python3 ~/.codex/skills/wt/scripts/wt_implement_from_query.py iife -- --no-open
```

## Rules

- Always execute through `pnpm run ai:wt-implement`.
- Match only `.md` files under `tasks/`.
- Forward all user flags after `--` unchanged.
- Always print the Ralph start command block with `cd` + `pnpm run ai:loop:start`.
- Never invent PRD files when no candidate matches.
