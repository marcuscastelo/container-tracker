---
description: "Create a high-quality, reusable `.prompt.md` template and guidelines that convert a user's intention into a clear, actionable prompt file for VS Code Copilot/Chat. Incorporates best practices from the repository's `prompt-files.md` and the VS Code docs on prompt files."
agent: agent
tools: ['edit', 'search', 'new', 'fetch', 'runSubagent']
---

# Prompt Creation Agent — improved

This prompt helps an LLM-authoring assistant produce a polished, production-ready `.prompt.md` file for use with VS Code Copilot/Chat. It bundles concrete rules, a template, and examples so the generated prompt is immediately usable by developers.

Core goals:
- Convert a short user intention into a self-contained prompt file that follows VS Code/ Copilot conventions.
- Include metadata, clear instructions, examples, and run/tool hints.
- Make the prompt safe to run, easy to adapt, and discoverable in a repo.

What to produce (requirements):
1. A `.prompt.md` file (Markdown) with an optional YAML front matter containing only these keys when applicable: `description`, `agent`, `tools`.
2. The body must contain: purpose, expected inputs, variables available (e.g. `${workspaceFolder}`, `${file}`), step-by-step instructions for the agent, at least one concise example of input→output, and a short validation checklist.
3. Use English for all content. Keep UX text short and operational.
4. Reference the repo's internal guidance when present (e.g. `../instructions/copilot/prompt-files.md`) and the official VS Code doc: https://code.visualstudio.com/docs/copilot/customization/prompt-files

Guidelines and best practices (derived from prompt-files.md and VS Code docs):
- Metadata: include `description` in front matter; include `agent` (e.g. `agent`) and `tools` only if the prompt needs them. Keep front matter minimal.
- Reusability: expose variables using `${input:...}` and workspace/file variables — document them in a "Variables" section.
- Safety: avoid executing arbitrary or privileged operations; clearly list required tools/permissions.
- Clarity: state the expected output format (file path, file name, or Markdown snippet) and any naming conventions.
- Examples: show at least one full example using realistic inputs and the exact output to be written to disk.
- i18n: write UI strings in English by default; if adding UI text for users, include keys for all locales present in `src/locales` (follow the repo i18n policy).
- Validation: include a two-min-checklist to verify the prompt file after generation (front matter valid; variables documented; examples present; references included).

Template (use this as the structure for generated prompt files):

---
description: "<short one-line description>"
agent: agent
tools: ['<optional-tool-ids>']
---

# <name/heading>

Purpose
: Briefly state what this prompt does and when to use it.

Variables
: List available variables (e.g. `${workspaceFolder}`, `${selection}`, `${input:taskName}`) and what they mean.

Usage / Instructions for the model
: Step-by-step instructions the model should follow to produce the output. Be explicit about the file path and format to write.

Examples
: Input: "<user intent>"
	Output: "<expected `.prompt.md` file contents or snippet>"

Validation checklist
- [ ] Front matter uses only allowed keys (`description`, `agent`, `tools`).
- [ ] Variables documented and examples included.
- [ ] External references (repo docs, VS Code link) included when relevant.

Notes
: Short notes about edge-cases, limitations, or follow-ups (e.g. "ask clarifying question if user intent is ambiguous").

References
- Repository guidelines: `./.github/instructions/copilot/prompt-files.md`
- VS Code docs: https://code.visualstudio.com/docs/copilot/customization/prompt-files

---

When generating a new prompt file, prefer small, focused prompts over very large multi-purpose ones. If a user request is ambiguous, ask 1–2 clarifying questions before creating the final `.prompt.md` file.

Example (minimal):

Input (user): "Generate a prompt that scaffolds a React form component from a JSON schema"

Output file: a `.prompt.md` that contains metadata, a short purpose, variables `${input:formName}`, step-by-step instructions, and an example input→output showing the generated component skeleton.

End.