---
applyTo: '**/*.{ts,tsx}**'
description: "Copilot pointer to canonical project instructions"
---

# Copilot Instructions — Pointer

Fonte canônica de instruções do projeto:

- `AGENTS.md` (raiz do repositório)

Instruções adicionais por contexto:

- `src/modules/tracking/AGENTS.md` para qualquer mudança em `src/modules/tracking/*`
- Gate operacional obrigatório de fechamento (`pnpm sanity`): `AGENTS.md` seção `11.1`

Se houver conflito entre documentos, priorize esta ordem:

1. `AGENTS.md` (raiz)
2. `src/modules/tracking/AGENTS.md` (quando aplicável)
3. Documentação canônica em `docs/*` referenciada pelos AGENTS

Não duplicar regras neste arquivo. Mantenha este arquivo como ponteiro.
