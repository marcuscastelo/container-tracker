---
description: "Generate a PR draft title and description from a git branch and change summary"
agent: agent
---

# Generate PR draft from branch

Purpose
: Produce a concise PR title and a well-structured PR draft body (description) derived from a git branch name, optional commit/changes summary, and optional issue references. Use when creating a draft PR from a feature/fix branch.

Variables
: - `${input:branch}` — the branch name (optional). When omitted, the agent MUST auto-discover the current branch using the Codex helper script (see below).
  - `${input:changes}` — short change summary or git diff summary (optional). Example: a bullet list or single paragraph describing the changes.
  - `${input:issues}` — comma-separated issue references (optional). Example: `#123, owner/repo#456`.
  - `${workspaceFolder}` — repository root.
  - `${file}` — current file path (if relevant).
  - Auto-discovery: The agent SHOULD attempt to run `tools/codex-skills-global/draft-pr-from-branch/scripts/generate_pr_draft.sh` in the `${workspaceFolder}` to infer branch, commits, and a draft description. The script writes title/description files to an output dir (default `/tmp`) and also prints the title and description to stdout.

Usage / Instructions for the model
: 1) Auto-discover the current branch and change summary by executing the repository helper script:
  - Run: `tools/codex-skills-global/draft-pr-from-branch/scripts/generate_pr_draft.sh --repo "${workspaceFolder}" --outdir /tmp`
  - If the script succeeds, parse its stdout or the generated files under `/tmp/pr-<slug>-title.txt` and `/tmp/pr-<slug>-description.md` to obtain `branch`, `title`, and `changes/description`.
  - If the script cannot be executed (missing permissions, not found, or non-git repo), DO NOT prompt the user for the branch. Instead, return an explicit error message instructing the user how to make the script available or provide the branch via `${input:branch}` in a follow-up attempt.
2) Parse the branch name (from discovery or `${input:branch}` fallback) to determine type (feat, fix, chore, docs, refactor, test) and scope if present (e.g. `feat(scope):` or `feat/scope/...`).
: 2) Generate a short, imperative PR title (<= 60 chars preferred) in English. Remove technical tokens and scope separators; if the branch includes a JIRA/ID, keep the ID at the end in parentheses only if it improves clarity.
: 3) Produce a PR description with the following sections (use Markdown headings where indicated):
:    - Summary — one short paragraph explaining the change.
:    - What changed — bullet list of key changes (3–8 bullets). Prefer present-tense imperative verbs.
:    - Why — concise rationale and any background.
:    - How to test / QA steps — numbered steps to validate the change locally.
:    - Related issues / references — references from `${input:issues}` or inferred IDs.
:    - Release notes / migration notes — short notes if applicable (optional).
:    - Suggested reviewers and labels — optional suggestions based on type/scope.
: 4) If `${input:changes}` is provided, incorporate important points into the "What changed" bullets; avoid repeating trivial noise (formatting-only lines).
: 5) Keep language professional, concise, and clear. Do not include internal-only secrets or credentials.
: 6) Output only the PR title on the first line (prefixed with `Title:`) followed by a blank line and then the PR body (prefixed with `Body:`). Example output format below.
: IMPORTANT: The prompt must NEVER ask the user to paste the current branch; branch discovery is automatic via the Codex script. If the script fails, provide a short actionable error (do not ask for the branch interactively).

Examples
: Input: `{ "branch": "feat/user-profile-add-avatar", "changes": "Added avatar upload UI, backend endpoint, and storage integration; included validation and tests.", "issues": "#321" }`
: Output:
: Title: Add avatar upload to user profile (#321)
:
: Body:
: ### Summary
: Add avatar upload support to the user profile. Users can now upload and crop a profile image which is stored in S3-compatible storage.
:
: ### What changed
: - Add avatar upload UI in `UserProfile` component with client-side validation
: - Implement `POST /api/users/:id/avatar` endpoint and storage adapter
: - Add server-side validation and image resizing
: - Add unit and integration tests for upload and processing
:
: ### Why
: This enables users to personalize their profiles and is required for upcoming social features.
:
: ### How to test
: 1. Sign in as a user and open the profile page
: 2. Upload a valid image and confirm it appears after save
: 3. Try invalid images and confirm validation messages
:
: ### Related issues
: #321
:
: ### Suggested reviewers and labels
: Reviewers: @frontend-team, @backend-team
: Labels: `feature`, `needs-review`

Validation checklist
- [ ] Title is imperative, concise, and <= 60 chars where possible
- [ ] Body includes Summary, What changed, Why, How to test, Related issues
- [ ] Sensitive data (tokens/keys) are not present
- [ ] References/issue IDs provided or inferred when possible

Notes
: - If the branch is ambiguous, ask one clarifying question: e.g., "Do you want a feature or bugfix PR title?"
: - Prefer English for titles and descriptions. If the repo primary language differs, mention that in the PR body.

References
- Repository guidance: `./.github/instructions/copilot/prompt-files.md` (if present)
- VS Code prompt files docs: https://code.visualstudio.com/docs/copilot/customization/prompt-files

Output format (required)
: The agent must return a plain Markdown snippet starting with `Title:` on a single line, a blank line, then `Body:` and the full PR body. Do not output any internal generation notes.
