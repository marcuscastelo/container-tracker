# Backlog Técnico — Sanitização Incremental do Código

Este documento converte **análise completa de dívida técnica** em **issues técnicas acionáveis**, prontas para uso em GitHub/Jira/Linear.

Cada issue é **isolada**, tem **escopo fechado** e pode ser executada por humanos ou LLMs sem decisões abertas.

---

## P1 — Robustez e Correção de Contratos

### ISSUE 4 — Remover `any` / `as` perigosos na i18n

**Problema**
Helpers de i18n usam `any` e `as`, enfraquecendo contratos de tradução.

**Escopo**

* `src/shared/localization/i18n.ts`
* `src/shared/localization/translationTypes.ts`

**Ações**

* Substituir `any` por `unknown`
* Introduzir type guards (`isRecord`)
* Validar locale base com Zod ou assert runtime

**Critério de aceite**

* Nenhum `any` ou `as` (exceto `as const`)
* Tipos de tradução detectam chaves faltantes

---

## P2 — Higiene e Manutenibilidade

### ISSUE 6 — Eliminar silent catches e alertas no client

**Problema**
Erros são engolidos silenciosamente ou exibidos via `alert()`.

**Escopo**

* `src/entry-client.tsx`

**Ações**

* Substituir `alert()` por notificação controlada
* Remover `catch {}`
* Logar erros via `src/shared/utils/logging.ts`

**Critério de aceite**

* Nenhum `alert()` em produção
* Erros relevantes são logados

---

## Ordem Recomendada de Execução

1. Estratégia de erro em repositórios
2. Testes de integração (tracking)
3. Mappers com Zod
4. i18n typing
5. idUtils
6. Client error handling

---

## Nota Final

Este backlog foi desenhado para:

* ser executado **incrementalmente**
* reduzir risco sem travar feature development
* facilitar manutenção por humanos **e LLMs**

