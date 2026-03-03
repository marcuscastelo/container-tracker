---
name: wt
description: "Resolve loose PRD paths in tasks/ and run `pnpm run ai:wt-implement`. Use when the user writes `$wt <prd path loose match>` or asks to scaffold a worktree from a PRD without the exact path."
---

# Worktree Implement

Resolve an imprecise PRD reference to one `tasks/*.md` file and execute the repository worktree scaffold command.

## Workflow

1. Parse input in this shape: `$wt <prd-query> [-- <wt-implement flags>]`.
2. Execute:

```bash
python3 ~/.codex/skills/wt/scripts/wt_implement_from_query.py <prd-query> -- <wt-implement flags>
```

3. If the script reports ambiguity, ask for one disambiguation input and rerun.
4. Report the resolved PRD file and the resulting branch/worktree details.

## Examples

```bash
python3 ~/.codex/skills/wt/scripts/wt_implement_from_query.py prd-worktrees
python3 ~/.codex/skills/wt/scripts/wt_implement_from_query.py devcontainer chromium -- --print-only
python3 ~/.codex/skills/wt/scripts/wt_implement_from_query.py worktrees -- --wt-root ../wt --branch-prefix feat/
```

## Rules

- Always execute through `pnpm run ai:wt-implement`.
- Match only `.md` files under `tasks/`.
- Forward all user flags after `--` unchanged.
- Never invent PRD files when no candidate matches.
