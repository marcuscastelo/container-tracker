---
name: implement-existing-prd
description: "Prepare implementation command directly from an existing PRD markdown or PRD JSON without executing. Use when the user asks to start from an already-written PRD and wants a ready command to copy/paste. Detect the best PRD source, infer feature key and execution flags, and output ai:loop:start command with minimal user input."
---

# Implement Existing PRD

Generate an implementation command from an existing PRD file with zero planning/refinement steps.
Do not execute the loop automatically.

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
- exact `pnpm run ai:loop:start ...` command to copy/paste
- that execution was not started automatically

## Defaults

Use these defaults unless user overrides:

- `agent`: `codex`
- `max-iterations`: `10`
- `dangerous-exec`: `1`
- `exec-retries`: `2`

## Useful Flags

```bash
# prepare files only (no loop execution when user runs command)
python3 ~/.codex/skills/implement-existing-prd/scripts/start_from_prd.py "Implement Dashboard Feature PRD" --prepare-only

# force a specific feature key
python3 ~/.codex/skills/implement-existing-prd/scripts/start_from_prd.py "Implement Dashboard Feature PRD" --feature dashboard-feature
```

## Hard Rules

- Never create a new PRD when an existing one is present and selected.
- Never run planning/refinement flow before execution.
- Never execute `ai:loop:start` automatically from this skill.
- Always use `ai:loop:start` as the entrypoint command.
- Always return the exact command in a copy/paste-friendly block.
