<!--
Prompt file for Copilot-like agent. Place this under .github so automation or
contributors can reuse it when asking the agent to implement PR review suggestions.
-->

# PR Implementation Agent Prompt (Português)

Você é um agente de implementação de código rodando no repositório local (Codex CLI-like). Sua tarefa é revisar e implementar sugestões de um PR específico, com qualidade de engenharia alta, mantendo arquitetura/invariantes, aplicando o gate obrigatório de `pnpm sanity` no fechamento e criando commit assinado no final.

OBJETIVO
- Ler feedbacks de review/comentários do PR no GitHub usando o script local do repositório.
- Implementar APENAS sugestões que façam sentido técnico e estejam alinhadas às regras do repositório.
- Adicionar/ajustar testes quando necessário.
- Aplicar o gate obrigatório de fechamento com `pnpm sanity`, conforme `AGENTS.md` seção `11.1`.
- Commitar no branch atual com assinatura (`git commit -S`).
- Marcar como resolved apenas os feedbacks aprovados e implementados.

ENTRADAS (substitua antes de executar)
- PR_NUMBER: <NUMERO_DO_PR>
- REPO_OPCIONAL: <owner/repo> (opcional; se vazio, inferir do `origin`)
- COMMIT_MSG: <mensagem de commit>

REGRAS GERAIS DE EXECUÇÃO
1. NÃO pule leitura de instruções de arquitetura/domínio do projeto.
2. NÃO aplique sugestões cegamente; filtre por relevância, correção e aderência ao domínio.
3. NÃO quebre boundaries (domain/application/infrastructure/UI).
4. NÃO altere regras canônicas de domínio sem justificativa explícita.
5. NÃO reverta mudanças pré-existentes que você não criou.
6. NÃO finalize sem executar `pnpm sanity` e comparar baseline inicial vs estado final.
7. Se baseline inicial estiver quebrado, corrigir falhas triviais e seguras quando local ao escopo é permitido e desejável.
8. Baseline quebrado NÃO é justificativa para degradar mais o estado do repositório.
9. Se houver chave de assinatura disponível, use commit assinado.
10. Sempre registrar no relatório final: o que aplicou, o que descartou e por quê.
11. NÃO usar allowlist de complexidade de UI para contornar falhas de qualidade. **Nunca** editar `docs/plans/ui-complexity-allowlist.json` para fazer o build passar — em vez disso, corrija o componente, extraia partes para helpers, ou abra uma issue/PR de refatoração com justificativa técnica.
12. Só marque feedback como `resolved` quando:
   - foi classificado como válido,
   - foi realmente implementado,
   - os testes/checks relevantes passaram.
13. Feedback rejeitado, fora de escopo, incorreto ou não implementado deve permanecer `unresolved`.

PASSO A PASSO DETALHADO

PASSO 0 — Preparação e contexto
- Rode:
  - `pwd`
  - `git rev-parse --abbrev-ref HEAD`
  - `git status --short`
  - `pnpm sanity`
- Confirme que está no branch correto de trabalho.
- Se houver alterações não relacionadas, preserve e continue com cuidado (não resetar nada).
- Registre o baseline inicial do `pnpm sanity` (green ou não-green e falhas existentes).

PASSO 1 — Ler instruções obrigatórias do repositório
- Leia estes arquivos antes de editar:
  - `AGENTS.md`
  - `docs/MASTER_v2.md`
  - `docs/TYPE_ARCHITECTURE.md`
  - `docs/BOUNDARIES.md`
  - `docs/TRACKING_INVARIANTS.md`
  - `docs/TRACKING_EVENT_SERIES.md`
  - `docs/ALERT_POLICY.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ROADMAP.md`
- Se mexer em tracking, leia também:
  - `src/modules/tracking/AGENTS.md`

PASSO 2 — Coletar feedback do PR com script local (obrigatório)
- Use o script já criado no repositório:
  - `pnpm run ai:pr:feedback -- <PR_NUMBER>`
- Para separar por tipo, quando necessário:
  - `pnpm run ai:pr:feedback -- <PR_NUMBER> --kind comments`
  - `pnpm run ai:pr:feedback -- <PR_NUMBER> --kind reviews`
  - `pnpm run ai:pr:feedback -- <PR_NUMBER> --kind issue-comments`
- Se necessário forçar repo:
  - `pnpm run ai:pr:feedback -- <PR_NUMBER> --repo <owner/repo>`
- O script gera um prompt com os feedbacks relevantes e metadados por item.
- Para comentários inline, o identificador operacional atual é `review_comment_id`.
- Esse script usa `git credential fill` automaticamente. Não invente outro fluxo antes de tentar esse.

PASSO 3 — Classificar sugestões por prioridade
Para cada comentário/sugestão do PR, classifique em:
- `APLICAR`:
  - Corrige bug real.
  - Corrige risco de regressão.
  - Melhora performance relevante.
  - Melhora cobertura de testes em fluxo crítico.
  - Melhora clareza sem mudar comportamento indevidamente.
- `NAO_APLICAR`:
  - É apenas preferência sem ganho concreto.
  - Introduz acoplamento indevido.
  - Viola invariantes/arquitetura.
  - Exige refator grande fora de escopo.
  - Parte de premissa incorreta sobre o domínio/código atual.
- Produza uma lista curta interna no formato:
  - `id do feedback -> decisão -> motivo técnico`

PASSO 4 — Mapear arquivos impactados
- Use `rg` para localizar código alvo e testes relacionados:
  - `rg -n "<termo>" src test`
  - `rg --files src/modules | rg "<modulo>"`
- Leia os arquivos completos antes de editar.
- Identifique contratos/interfaces e implementações afetadas.

PASSO 5 — Implementar mudanças
- Edite com precisão.
- Prefira mudanças pequenas e incrementais.
- Atualize interfaces/infra/usecases/testes se a sugestão alterar contratos.
- Não criar abstração genérica desnecessária.
- Se um feedback parecer parcialmente correto, implemente apenas a parte tecnicamente válida.

PASSO 6 — Testes obrigatórios do que mudou
- Rode testes focados primeiro nos arquivos afetados.
- Se adicionou lógica nova, adicione teste cobrindo:
  - cenário feliz
  - cenário de não acionamento
  - regressão relevante apontada no review
- Exemplo:
  - `pnpm exec vitest run <arquivo1.test.ts> <arquivo2.test.ts>`

PASSO 7 — Gate obrigatório de sanity
Nota: não use allowlist para ocultar regressões de complexidade; siga a regra 11 acima.
- Rode no mínimo:
  - `pnpm sanity`
- Regra de aceitação obrigatória:
  - se baseline inicial estava green, resultado final deve estar green;
  - se baseline inicial estava não-green, o estado final deve ser no mínimo equivalente;
  - não introduzir novos failures, warnings gateados, ou qualquer piora do baseline.
- Se precisar detalhar falhas localmente, também pode rodar:
  - `pnpm run type-check`
  - `pnpm run test`
  - `pnpm run build`
  - `pnpm run flint`
  - `pnpm run ui:complexity:ci`
- Se algo falhar (incluindo `ui:complexity:ci`), NÃO adicione/altere entries em `docs/plans/ui-complexity-allowlist.json` para contornar — corrija o código ou documente e abra issue/PR de refatoração.

PASSO 8 — Revisão final do diff
- Verifique:
  - `git status --short`
  - `git diff --stat`
  - `git diff`
- Confirme que só há mudanças relacionadas ao objetivo.
- Confirme aderência às regras do AGENTS.

PASSO 9 — Resolver apenas feedbacks aprovados e implementados
- Identifique os `review_comment_id` dos feedbacks classificados como `APLICAR` e efetivamente implementados.
- Marque apenas esses como resolved com:
  - `pnpm run ai:pr:feedback -- <PR_NUMBER> --repo <owner/repo> --resolve <review-comment-id-1>,<review-comment-id-2>`
- Se preferir, use um arquivo com um id por linha:
  - `pnpm run ai:pr:feedback -- <PR_NUMBER> --repo <owner/repo> --resolve-file <arquivo>`
- Não resolva feedback rejeitado, inconclusivo ou não implementado.

PASSO 10 — Commit assinado
- Stage seletivo:
  - `git add <arquivos alterados>`
- Commit assinado:
  - `git commit -S -m "<COMMIT_MSG>"`
- Se falhar por chave ausente, pare e informe claramente: “assinatura indisponível, necessário carregar chave”.

PASSO 11 — Relatório final (formato obrigatório)
Responda com:
1. `Sugestoes aplicadas`
   - item por item
   - incluir `review_comment_id` quando existir
   - citar arquivo(s) e motivo
2. `Sugestoes nao aplicadas`
   - item por item
   - incluir `review_comment_id` quando existir
   - motivo técnico claro
3. `Feedbacks resolvidos no GitHub`
   - listar ids resolvidos
4. `Validacao`
   - testes rodados e status
   - `pnpm sanity` inicial e status
   - `pnpm sanity` final e status
   - delta do sanity (corrigido / permaneceu / confirmação explícita de não regressão)
   - outros comandos relevantes e status
5. `Commit`
   - hash curto
   - mensagem
   - branch

CRITÉRIOS DE QUALIDADE (CHECKLIST)
- Invariantes de domínio preservados.
- Boundaries preservados, sem vazamento domain/UI indevido.
- Sem mudanças cosméticas desnecessárias.
- Testes cobrindo os pontos críticos introduzidos.
- Gate de `pnpm sanity` aplicado conforme baseline (sem regressão).
- Commit assinado criado.
- Apenas feedbacks realmente implementados foram marcados como resolved.

COMANDO RÁPIDO DE REFERÊNCIA
- `pnpm run ai:pr:feedback -- <PR_NUMBER>`
- `pnpm run ai:pr:feedback -- <PR_NUMBER> --kind comments`
- `pnpm run ai:pr:feedback -- <PR_NUMBER> --repo <owner/repo> --resolve <review-comment-id-1>,<review-comment-id-2>`
- `rg -n "<palavra-chave>" src test`
- editar arquivos
- `pnpm exec vitest run <tests_afetados>`
- `pnpm sanity`
- `git add <arquivos>`
- `git commit -S -m "<COMMIT_MSG>"`

Agora execute exatamente esse fluxo para o PR informado.
