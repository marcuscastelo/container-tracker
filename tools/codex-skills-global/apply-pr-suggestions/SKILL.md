---
name: apply-pr-suggestions
description: Implementar sugestões de review de Pull Request com rigor técnico no repositório local. Use quando o pedido envolver "implementar sugestões do PR", "aplicar comentários de review", "endereçar feedback do GitHub" ou resolver comentários inline mantendo arquitetura/invariantes, testes e checks verdes. Sempre preparar resposta para comentários addressed e ignored.
---

# Apply PR Suggestions

## Objetivo

Implementar somente feedbacks tecnicamente válidos de um PR, preservar arquitetura e invariantes do repositório, validar com checks relevantes, responder todos os comentários (`addressed` e `ignored`) e encerrar com commit assinado quando disponível.

## Fluxo Padrão

1. Preparar contexto local.
- Rodar `pwd`, `git rev-parse --abbrev-ref HEAD` e `git status --short`.
- Preservar mudanças pré-existentes não relacionadas.

2. Ler instruções canônicas antes de editar.
- Ler no mínimo: `AGENTS.md`, `docs/MASTER_v2.md`, `docs/TYPE_ARCHITECTURE.md`, `docs/BOUNDARIES.md`, `docs/TRACKING_INVARIANTS.md`, `docs/TRACKING_EVENT_SERIES.md`, `docs/ALERT_POLICY.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`.
- Se tocar tracking, ler também `src/modules/tracking/AGENTS.md`.

3. Coletar feedback do PR via script local obrigatório.
- Rodar `pnpm run ai:pr:feedback -- <PR_NUMBER>`.
- Variantes úteis:
  - `pnpm run ai:pr:feedback -- <PR_NUMBER> --kind comments`
  - `pnpm run ai:pr:feedback -- <PR_NUMBER> --kind reviews`
  - `pnpm run ai:pr:feedback -- <PR_NUMBER> --kind issue-comments`
  - `pnpm run ai:pr:feedback -- <PR_NUMBER> --repo <owner/repo>`
- Usar `review_comment_id` como identificador operacional para comentários inline.

4. Classificar cada feedback.
- `APLICAR`: corrige bug/regressão real, reduz risco relevante, melhora testes críticos, melhora clareza sem distorcer comportamento.
- `NAO_APLICAR`: preferência sem ganho concreto, viola boundary/invariante, fora de escopo, premissa incorreta ou nitpick.
- Registrar internamente: `id -> decisão -> motivo técnico`.

5. Mapear impacto e implementar com precisão.
- Localizar código com `rg -n "<termo>" src test` e `rg --files src/modules | rg "<modulo>"`.
- Ler arquivos inteiros afetados antes de editar.
- Fazer mudanças pequenas e rastreáveis.
- Atualizar contratos/testes quando a sugestão alterar comportamento.

6. Validar mudanças.
- Rodar testes focados primeiro (`pnpm exec vitest run <tests_afetados>`).
- Rodar `pnpm check` como gate mínimo.
- Quando necessário, detalhar com `pnpm run type-check`, `pnpm run test`, `pnpm run build`, `pnpm run flint`, `pnpm run ui:complexity:ci`.

7. Commit assinado e captura de SHA.
- Stage seletivo com `git add <arquivos>`.
- Commit com `git commit -S -m "<mensagem>"`.
- Capturar hash curto com `git rev-parse --short HEAD`.
- Se assinatura indisponível, reportar bloqueio explicitamente.

8. Preparar respostas obrigatórias para todos os comentários.
- Para cada `APLICAR`, usar texto curto com SHA:
  - `implemented at <commitsha>`
  - `fixed by <commitsha>`
  - `solved at <commitsha>`
  - `addressed by <commitsha>`
- Para cada `NAO_APLICAR`, usar texto curto:
  - `Out of scope`
  - `Nitpick ignored`
  - `Will be done in a future issue`
- Sempre anexar justificativa técnica curta.
- Quando aplicável, anexar ação para o autor: `Action: create issue for <topic>` ou `Action: link existing issue #<id>`.

9. Publicar respostas no GitHub para todos os comentários processados.
- Publicar resposta textual em todos os itens (`APLICAR` e `NAO_APLICAR`) via UI/API disponível no ambiente.
- Nunca deixar comentário classificado sem resposta pronta.

10. Resolver no GitHub somente comentários `APLICAR`.
- Resolver apenas itens `APLICAR` implementados, validados e já respondidos:
  - `pnpm run ai:pr:feedback -- <PR_NUMBER> --repo <owner/repo> --resolve <id1>,<id2>`
  - ou `--resolve-file <arquivo>` com um id por linha.
- Nunca resolver `NAO_APLICAR` automaticamente.
- Entregar `NAO_APLICAR` pronto para resolve manual do autor, com justificativa e ação (quando houver).

## Regras de Decisão

- Não aplicar sugestão cegamente; priorizar correção técnica e aderência ao domínio.
- Não quebrar boundaries entre modules/capabilities/UI/domain.
- Não alterar regra canônica de domínio sem justificativa explícita.
- Não reverter mudanças do usuário sem solicitação.
- Não usar `docs/plans/ui-complexity-allowlist.json` para mascarar falhas.
- Não finalizar sem validação adequada.
- Todo comentário classificado deve receber texto de resposta (`APLICAR` ou `NAO_APLICAR`).
- `NAO_APLICAR` jamais entra em `--resolve`; apenas justificar e preparar ação manual.
- Se usar `Will be done in a future issue`, incluir ação concreta para criar/vincular issue.

## Saída Esperada

Responder com seis blocos:

1. `Sugestoes aplicadas`
- Incluir `review_comment_id` (quando existir), arquivos tocados, motivo técnico e texto exato da resposta com SHA (`implemented/fixed/solved/addressed at/by <commitsha>`).

2. `Sugestoes nao aplicadas`
- Incluir `review_comment_id` (quando existir), motivo técnico e texto exato da resposta (`Out of scope`/`Nitpick ignored`/`Will be done in a future issue`).
- Incluir `acao_para_usuario` quando houver.

3. `Feedbacks resolvidos no GitHub`
- Listar somente IDs `APLICAR` efetivamente resolvidos.

4. `Pendentes para resolve manual`
- Listar todos os `NAO_APLICAR` com:
  - `review_comment_id`
  - `justificativa pronta`
  - `acao_para_usuario` (ou `nenhuma`)
- Confirmar explicitamente: `nao resolvido automaticamente`.

5. `Validacao`
- Informar comandos executados e status (incluindo `pnpm check`).

6. `Commit`
- Informar hash curto, mensagem e branch.

## Comandos de Referência

```bash
pnpm run ai:pr:feedback -- <PR_NUMBER>
pnpm run ai:pr:feedback -- <PR_NUMBER> --kind comments
pnpm run ai:pr:feedback -- <PR_NUMBER> --repo <owner/repo> --resolve <id1>,<id2>
rg -n "<palavra-chave>" src test
pnpm exec vitest run <tests_afetados>
pnpm check
git commit -S -m "<mensagem>"
git rev-parse --short HEAD
```
