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
2. CRITICAL: The agent MUST NEVER print or return the final generated prompt contents to the user. Instead, the agent MUST autonomously save the generated prompt file to the repository at `.github/prompts/<promptname>.prompt.md` and respond to the user only with a short confirmation message containing the path and the generated filename. The saved filename MUST be auto-generated following the ergonomic naming rules below.
2. The body must contain: purpose, expected inputs, variables available (e.g. `${workspaceFolder}`, `${file}`), step-by-step instructions for the agent, at least one concise example of input→output, and a short validation checklist.
3. Use English for all content. Keep UX text short and operational.
4. Reference the repo's internal guidance when present (e.g. `../instructions/copilot/prompt-files.md`) and the official VS Code doc: https://code.visualstudio.com/docs/copilot/customization/prompt-files

Guidelines and best practices (derived from prompt-files.md and VS Code docs):
- Metadata: include `description` in front matter; include `agent` (e.g. `agent`) and `tools` only if the prompt needs them. Keep front matter minimal.
- Reusability: expose variables using `${input:...}` and workspace/file variables — document them in a "Variables" section.
- Safety: avoid executing arbitrary or privileged operations; clearly list required tools/permissions.
- Clarity: state the expected output format (file path, file name, or Markdown snippet) and any naming conventions.
 - Auto-save behavior: The prompt must include an instruction block telling the agent how to persist the generated `.prompt.md` file to disk. The agent should not rely on the user to copy/paste final contents — it must save them automatically.
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
: IMPORTANT: The agent must NOT display the final prompt to the user. After generating the content, the agent must save it to `.github/prompts/<promptname>.prompt.md` and then reply only with a confirmation message that includes the generated filename and the relative path. See "Ergonomic naming" rules below.

Examples
: Input: "<user intent>"
	Output: "<expected `.prompt.md` file contents or snippet>"

Validation checklist
- [ ] Front matter uses only allowed keys (`description`, `agent`, `tools`).
- [ ] Variables documented and examples included.
- [ ] External references (repo docs, VS Code link) included when relevant.

Notes
: Short notes about edge-cases, limitations, or follow-ups (e.g. "ask clarifying question if user intent is ambiguous").

Ergonomic naming (required)
: When auto-generating the filename for the saved prompt, follow these rules to keep names ergonomic and discoverable:
- Use only lowercase letters, numbers and hyphens. No spaces, underscores, or other punctuation.
- Derive the name from the user's short intent (e.g. "scaffold react form from json schema" -> `scaffold-react-form-from-json-schema`).
- Remove stopwords where they don't add meaning (a, the, from, to) to keep names concise.
- Limit the core slug to 40 characters; if longer, truncate intelligently at a word boundary.
- Append a short date/timestamp suffix when needed to avoid collisions (e.g. `-20260209-1503`).
- Always end with the suffix `.prompt.md` and save under `.github/prompts/`.

Auto-save behavior (implementation hints for the agent)
: The agent should implement these steps when saving the generated prompt file:
- Compute an ergonomic slug from the user's intent following the rules above.
- Ensure the final filename is unique in `.github/prompts/` (add timestamp suffix if a file with the same name already exists).
- Write the generated Markdown content to `.github/prompts/<slug>.prompt.md` using UTF-8 encoding.
- DO NOT print the file contents to the user. Only return a short confirmation: `Saved prompt to .github/prompts/<slug>.prompt.md`.

Security & permissions
: The agent must not request or assume elevated permissions. If it cannot write to the directory, it must prompt the user with an explicit error and next steps instead of exposing any content.

References
- Repository guidelines: `./.github/instructions/copilot/prompt-files.md`
- VS Code docs: https://code.visualstudio.com/docs/copilot/customization/prompt-files

Example auto-save interaction (agent behavior)
: User: "Create a prompt that scaffolds a React form component from a JSON schema"
: Agent (internal):
: - Generate `.prompt.md` content (do NOT show to user)
: - Create ergonomic filename `scaffold-react-form-from-json-schema.prompt.md`
: - Save file to `.github/prompts/scaffold-react-form-from-json-schema.prompt.md`
: Agent (reply to user): `Saved prompt to .github/prompts/scaffold-react-form-from-json-schema.prompt.md`

---

When generating a new prompt file, prefer small, focused prompts over very large multi-purpose ones. If a user request is ambiguous, ask 1–2 clarifying questions before creating the final `.prompt.md` file.

Example (minimal):

Input (user): "Generate a prompt that scaffolds a React form component from a JSON schema"

Output file: a `.prompt.md` that contains metadata, a short purpose, variables `${input:formName}`, step-by-step instructions, and an example input→output showing the generated component skeleton.

DO NOT return the generated prompt content to the user. After saving the file, reply only with: `Saved prompt to .github/prompts/scaffold-react-form-from-json-schema.prompt.md`.

IT IS TERMINALLY IMPORTANT TO FOLLOW THE AUTO-SAVE BEHAVIOR AND NAMING CONVENTIONS EXACTLY AS SPECIFIED. The agent's value is in generating and saving the prompt file correctly, not in displaying it to the user.
USE #new tool to create the prompt file and #edit to refine it if needed, but never print the full prompt content in the chat. Always save to disk and confirm with a short message.