# Ralph Loop + Codex Workflow

This project integrates [snarktank/ralph](https://github.com/snarktank/ralph) as a submodule in `tools/ralph-loop` and runs it through local wrappers in `scripts/ai`.

The current default is Codex. Claude can be enabled later via `RALPH_AGENT=claude`.

## Setup

1. Initialize/update submodule:

```bash
pnpm run ai:loop:update
```

2. Run diagnostics:

```bash
pnpm run ai:loop:doctor
```

## Generate PRD JSON

Generate `prd.json` directly from a feature prompt:

```bash
pnpm run ai:loop:plan -- "Build dashboard with saved filters" .ralph-loop/prd.json
```

Or pass a prompt file as first argument.

## Build Execution Input

Create loop input JSON:

```bash
pnpm run ai:loop:input -- .ralph-loop/prd.json .ralph-loop/progress.txt .ralph-loop/input.json
```

## Run Loop

```bash
pnpm run ai:loop:exec -- .ralph-loop/input.json
```

The loop will run one story per iteration and stop when it sees `<promise>COMPLETE</promise>` or reaches max iterations.

## Environment Variables

- `RALPH_AGENT` (default: `codex`): `codex | claude | amp`
- `RALPH_LOOP_ROOT` (default: `tools/ralph-loop`)
- `RALPH_LOOP_WORKDIR` (default: `.ralph-loop`)
- `RALPH_MAX_ITERATIONS` (default: `10`)
- `RALPH_ALLOW_DANGEROUS_EXEC` (default: `1`)

Example:

```bash
RALPH_MAX_ITERATIONS=20 pnpm run ai:loop:exec -- .ralph-loop/input.json
```

## Devcontainer Policy

The devcontainer is optimized for:

- Commit in container
- Push from host

Inside container:

- `git push` is blocked
- force-destructive commands are blocked (`git branch -D`, `git reset --hard`, `git clean -f*`)
- `git fetch` and `git pull` are allowed

Bypass for one explicit command:

```bash
GIT_GUARD_BYPASS=1 git <command>
```

Use bypass only when intentional.

## Host/Container Branch Visibility

Branch and commit history are shared between host and container because the devcontainer mounts the same workspace and `.git` directory.

Practical flow:

1. Work and commit in container.
2. Run `git push` from host.

## Claude Swap (Future)

To use Claude later:

1. Install/auth Claude CLI inside container.
2. Set `RALPH_AGENT=claude`.
3. Reuse the same `pnpm run ai:loop:*` commands.
