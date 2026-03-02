---
name: implement-existing-prd
description: "Start implementation directly from an existing PRD markdown or PRD JSON without refining the plan. Use when the user asks to execute an already-written PRD (for example: 'Implement Dashboard Feature PRD', 'start from this PRD', or 'run Ralph on this PRD'). Detect the best PRD file, infer feature key and execution flags, convert markdown when needed, and run ai:loop:start with minimal user input."
---

# Implement Existing PRD

Run implementation from an existing PRD file with zero planning/refinement steps.

## Workflow

1. Stay in the target repository root.
2. Do not rewrite or refine PRD content.
3. Run the helper script:

```bash
python3 ~/.codex/skills/implement-existing-prd/scripts/start_from_prd.py "<user request>"
```

4. If the detected PRD source is wrong, rerun with explicit source:

```bash
python3 ~/.codex/skills/implement-existing-prd/scripts/start_from_prd.py "<user request>" --source <path-to-prd.md-or-prd.json>
```

5. Report to the user:
- selected PRD source path
- inferred feature key
- exact `pnpm run ai:loop:start ...` command executed
- whether the loop completed or needs another run

## Defaults

Use these defaults unless user overrides:

- `agent`: `codex`
- `max-iterations`: `10`
- `dangerous-exec`: `1`
- `exec-retries`: `2`

## Useful Flags

```bash
# show what would run, without execution
python3 ~/.codex/skills/implement-existing-prd/scripts/start_from_prd.py "Implement Dashboard Feature PRD" --dry-run

# prepare files only (no loop execution)
python3 ~/.codex/skills/implement-existing-prd/scripts/start_from_prd.py "Implement Dashboard Feature PRD" --prepare-only

# force a specific feature key
python3 ~/.codex/skills/implement-existing-prd/scripts/start_from_prd.py "Implement Dashboard Feature PRD" --feature dashboard-feature
```

## Hard Rules

- Never create a new PRD when an existing one is present and selected.
- Never run planning/refinement flow before execution.
- Always use `ai:loop:start` as the entrypoint command.
- Always show the exact command before or after execution for reproducibility.
