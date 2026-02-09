
## Prompt files (resumo de: https://code.visualstudio.com/docs/copilot/customization/prompt-files)

Este ficheiro contém um resumo prático sobre ficheiros de prompt para o Chat do VS Code / Copilot.
Use-o como referência para criar e manter prompt files no repositório.

### O que são prompt files

Prompt files são ficheiros Markdown (extensão `.prompt.md`) que definem prompts reutilizáveis para tarefas de desenvolvimento — gerar código, rever PRs, scaffolding, etc. Podem ser executados directamente no Chat do VS Code e usados como biblioteca de fluxos de trabalho standardizados.

Os prompt files podem ser armazenados no âmbito do workspace (por exemplo em `.github/prompts`) ou no perfil do utilizador (disponíveis em vários workspaces).

### Estrutura do ficheiro de prompt

Um prompt file tipicamente tem três secções:

- Header (opcional): YAML frontmatter que configura metadados do prompt.
- Body: o texto do prompt que será enviado ao modelo.
- Exemplos (opcional): exemplos de entrada/saída para guiar o comportamento.

Exemplo mínimo de header (YAML frontmatter):

```yaml
---
name: generate-react-form
description: Gera um componente React para um formulário simples
argument-hint: formName=MyForm
agent: agent
model: gpt-4o
tools:
	- fileSystem
	- repoSearch
---
```

Campos úteis no header:

- description: breve descrição do propósito do prompt.
- name: nome do prompt (aparece quando o utilizador digita `/` no chat). Se omitido, usa-se o nome do ficheiro.
- argument-hint: texto guia para o campo de input do chat.
- agent: agente a usar (ask, edit, agent ou nome de um agente customizado).
- model: modelo a utilizar (quando não especificado, usa-se o modelo selecionado no picker).
- tools: lista de ferramentas ou conjuntos de ferramentas disponíveis para o prompt. Se uma ferramenta não estiver disponível no contexto, é ignorada.

### Body (corpo do prompt)

O corpo do ficheiro é o texto enviado ao modelo. Deve conter instruções claras, formato de saída esperado e exemplos quando relevantes.

Variáveis que pode usar no body:

- Variáveis de workspace: `${workspaceFolder}`, `${workspaceFolderBasename}`
- Variáveis de seleção: `${selection}`, `${selectedText}`
- Variáveis de ficheiro: `${file}`, `${fileBasename}`, `${fileDirname}`, `${fileBasenameNoExtension}`
- Variáveis de input: `${input:variableName}` ou `${input:variableName:placeholder}` para receber valores do campo de input do chat

Para referenciar ferramentas de agente dentro do texto use a sintaxe `#tool:<tool-name>` (por exemplo `#tool:githubRepo`).

Pode também referenciar outros ficheiros do workspace com links Markdown usando caminhos relativos.

### Exemplos de uso

- Gerar um componente: digitar `/generate-react-form formName=MyForm` no Chat
- Executar o comando "Run Prompt" ou carregar no botão play quando um prompt file está aberto no editor
- Criar novos prompt files via: Chat > Configure Chat > Prompt Files ou o comando "Chat: New Prompt File" no Command Palette

### Onde guardar

- Workspace prompt files: coloque-os em `.github/prompts` dentro do repositório para que sejam usados apenas nesse workspace.
- User prompt files: guarde no perfil do VS Code para disponibilizar em vários workspaces.

Configurações adicionais podem apontar para outras pastas de prompts no workspace através da definição `chat.promptFilesLocations`.

### Prioridade das ferramentas

Ao especificar `tools` no header ou usar um agente customizado, a lista de ferramentas disponível segue esta prioridade:

1. Tools especificadas no prompt file
2. Tools do agente referenciado pelo prompt file
3. Tools padrão do agente selecionado

### Sincronização entre dispositivos

Os ficheiros de prompt do utilizador podem ser sincronizados com o Settings Sync do VS Code: habilite a opção e inclua "Prompts and Instructions" na configuração do Settings Sync.

### Boas práticas e dicas

- Documente claramente o propósito e o formato de saída esperado.
- Forneça exemplos de entrada/saída para orientar o modelo.
- Use variáveis (`${selection}`, `${input:...}`) para tornar prompts reutilizáveis.
- Teste rapidamente com o botão de play no editor e refine iterativamente.

### Perguntas frequentes (resumo)

- Como identificar a origem de um prompt file? Use o comando "Chat: Configure Prompt Files" e passe o cursor sobre o ficheiro para ver a origem (built-in, profile, workspace, extensão).
- O que acontece se uma tool não estiver disponível? É simplesmente ignorada e o prompt executa com as ferramentas disponíveis.

### Recursos relacionados

- Custom instructions: https://code.visualstudio.com/docs/copilot/customization/custom-instructions
- Custom agents: https://code.visualstudio.com/docs/copilot/customization/custom-agents
- Guide to chat: https://code.visualstudio.com/docs/copilot/chat/copilot-chat
- Configurar ferramentas em chat: https://code.visualstudio.com/docs/copilot/chat/chat-tools
- Exemplos community: https://github.com/github/awesome-copilot

---

Arquivo gerado automaticamente a partir do resumo da documentação oficial do VS Code sobre prompt files (02/04/2026). Para o conteúdo completo e a versão original, consulte:
https://code.visualstudio.com/docs/copilot/customization/prompt-files
