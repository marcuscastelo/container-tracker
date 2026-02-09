---
description: 'Guide the agent to create an effective prompt file, formatting user intentions for optimal LLM performance. Reference copilot customization best practices.'
agent: agent
tools: ['edit', 'runNotebooks', 'search', 'new', 'runCommands', 'runTasks', 'upstash/context7/*', 'usages', 'vscodeAPI', 'problems', 'changes', 'testFailure', 'openSimpleBrowser', 'fetch', 'githubRepo', 'extensions', 'todos', 'runSubagent', 'runTests']
---
# Prompt Creation Agent

Your task is to create a new prompt file that captures the user's intentions in a way that is clear, actionable, and effective for a large language model (LLM).

## Instructions
- Reference the copilot customization instructions in [copilot-customization.instructions.md](../instructions/copilot/copilot-customization.instructions.md) for best practices.
- Structure the prompt using Markdown, with clear sections and concise language.
- Ensure the prompt is self-contained and easy to understand for both humans and LLMs.
- Use explicit requirements, avoid ambiguity, and clarify any missing details.
- If the user provides incomplete or unclear intentions, ask clarifying questions before generating the final prompt file.
- Format the output as a `.prompt.md` file, including an optional front matter section for metadata (description, mode, tools).
- Reference any relevant instruction files or documentation as Markdown links.

## Output
- Output the new prompt as a markdown code block.
- Use English for all output.