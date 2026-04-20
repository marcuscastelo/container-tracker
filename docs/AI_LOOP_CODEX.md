# Ralph Loop + Codex Workflow

This project integrates [snarktank/ralph](https://github.com/snarktank/ralph) submodule in `tools/ralph-loop` and runs it through local wrappers in `scripts/ai`.

current default is Claude. Codex can be enabled via `RALPH_AGENT=codex`.

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

Generate `prd.json` directly from feature prompt:

```bash
pnpm run ai:loop:plan -- "Build dashboard with saved filters" .ralph-loop/prd.json
```

Or pass prompt file first argument.

## One Command Flow (Markdown -> Ralph)

If you already have PRD markdown (for example copied from ChatGPT web), run everything with one command:

```bash
pnpm run ai:loop:start -- docs-ralph-loop tasks/prd-docs-ralph-loop.md
```

This command will:

1. Generate `.ralph-loop/docs-ralph-loop/prd.json` from your markdown (or reuse JSON source if provided).
2. Generate `.ralph-loop/docs-ralph-loop/input.json`.
3. Start Ralph execution immediately.

flow works from terminal only. VS Code can be closed after you save PRD file.

Useful options:

```bash
# Prepare files only (no execution)
pnpm run ai:loop:start -- docs-ralph-loop tasks/prd-docs-ralph-loop.md --prepare-only

# Limit iterations and retries
pnpm run ai:loop:start -- docs-ralph-loop tasks/prd-docs-ralph-loop.md --max-iterations 5 --plan-retries 2 --exec-retries 3
```

## One Command Flow (Pasted PRD Text -> Ralph)

If you want to paste full PRD text directly in terminal:

```bash
pnpm run ai:ralph -- "# PRD title
...texto completo do PRD..."
```

Or via stdin:

```bash
cat tasks/prd-docs-ralph-loop.md | pnpm run ai:ralph --
```

This wrapper will:

1. Infer feature key from PRD title (or use `--feature-key`).
2. Save markdown under `tasks/prd-<feature-key>.md` (or `-2`, `-3`,... if needed).
3. Call `pnpm run ai:loop:start` automatically.

## Build Execution Input

Create loop input JSON:

```bash
pnpm run ai:loop:input -- .ralph-loop/prd.json .ralph-loop/progress.txt .ralph-loop/input.json
```

## Run Loop

```bash
pnpm run ai:loop:exec -- .ralph-loop/input.json
```

loop will run one story per iteration and stop when it sees `<promise>COMPLETE</promise>` or reaches max iterations.

## Environment Variables

- `RALPH_AGENT` (default: `claude`): `codex | claude | amp`
- `RALPH_LOOP_ROOT` (default: `tools/ralph-loop`)
- `RALPH_LOOP_WORKDIR` (default: `.ralph-loop`)
- `RALPH_MAX_ITERATIONS` (default: `10`)
- `RALPH_ALLOW_DANGEROUS_EXEC` (default: `1`)
- `RALPH_AGENT_TIMEOUT_SECONDS` (default: `0`, disabled)
- `RALPH_NO_PROGRESS_LIMIT` (default: `2`, set `0` to disable no-progress stop)
- `RALPH_CLAUDE_MODEL` (default: `google/gemma-4-e4b`)
- `RALPH_CLAUDE_BASE_URL` (default: `http://localhost:1234`)
- `RALPH_CLAUDE_AUTH_TOKEN` (default: `lmstudio`)

When `RALPH_AGENT=claude`, wrappers export:

- `ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL:-$RALPH_CLAUDE_BASE_URL}`
- `ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN:-$RALPH_CLAUDE_AUTH_TOKEN}`

and execute Claude:

```bash
claude --model google/gemma-4-e4b "<PROMPT>"
```

Example:

```bash
RALPH_MAX_ITERATIONS=20 pnpm run ai:loop:exec -- .ralph-loop/input.json
```

## Devcontainer Policy

devcontainer is optimized for:

- Commit in container
- Push implementation branch in container (for Ralph loop completion)

Inside container:

- regular branch `git push` is allowed
- pushes to protected branches (`main`/`master`) are blocked
- branch/tag deletion pushes are blocked
- force-destructive commands are blocked (`git branch -D`, `git reset --hard`, `git clean -f*`)
- `git fetch` and `git pull` are allowed

Bypass for one explicit command:

```bash
GIT_GUARD_BYPASS=1 git <command>
```

Use bypass only when intentional.

## Host/Container Branch Visibility

Branch and commit history are shared between host and container because devcontainer mounts same workspace and `.git` directory.

Practical flow:

1. Work and commit in container.
2. Push only implementation branch from container (or host when preferred).

## Claude Swap (Future)

To use Claude with local LM Studio/OpenAI-compatible endpoint:

1. Install Claude CLI inside container.
2. Set `RALPH_AGENT=claude`.
3. Optionally override defaults:

```bash
export ANTHROPIC_BASE_URL=http://localhost:1234
export ANTHROPIC_AUTH_TOKEN=lmstudio
export RALPH_CLAUDE_MODEL=google/gemma-4-e4b
```

4. Reuse same `pnpm run ai:loop:*` commands.

## Troubleshooting

### Auth failure (Codex)

Symptoms:

- `pnpm run ai:loop:doctor` reports missing authentication
- `codex login status` fails

Checks and fixes:

1. Verify login:

```bash
codex login status
```

2. Authenticate if needed:

```bash
codex login --with-api-key
```

3. In devcontainer, ensure host credentials are mounted at `/home/node/.codex`.
4. Run diagnostics again:

```bash
pnpm run ai:loop:doctor
```

### Stream disconnect during `ai:loop:exec`

Symptoms:

- Loop process exits unexpectedly with transport/stream interruption
- Iteration output appears truncated

Recovery flow:

1. Inspect latest raw output:

```bash
cat .ralph-loop/last-exec-output.txt
```

2. Confirm persisted state:
   - Plan: `.ralph-loop/prd.json`
   - Progress log: `.ralph-loop/progress.txt`
3. Re-run same command:

```bash
pnpm run ai:loop:exec -- .ralph-loop/input.json
```

loop is append-only and reads persisted files, so it safely continues from current state.
