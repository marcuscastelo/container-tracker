# Backlog Técnico — Sanitização Incremental do Código

Este documento converte a **análise completa de dívida técnica** em **issues técnicas acionáveis**, prontas para uso em GitHub/Jira/Linear.

Cada issue é **isolada**, tem **escopo fechado** e pode ser executada por humanos ou LLMs sem decisões abertas.

---

## P0 — Risco Alto / Bloqueadores Estruturais

### ISSUE 1 — Padronizar estratégia de erro nos repositórios (SupabaseResult)

**Problema**
Repositórios misturam exceções (`throw`) e retornos `SupabaseResult<T>`, gerando contratos implícitos e inconsistentes.

**Escopo**

* `src/modules/*/infrastructure/persistence/*Repository.ts`
* `src/shared/supabase/supabaseResult.ts`

**Ações**

* Definir `SupabaseResult<T>` como contrato padrão
* Migrar **uma função por PR**, começando por:

  * `fetchById`
  * `create`
* Converter `throw` → `{ success: false, error }`
* Garantir que nenhuma função do repositório lance exceção

**Critério de aceite**

* Todas as funções migradas retornam `SupabaseResult`
* Nenhuma exceção lançada por repositórios
* Testes unitários cobrindo sucesso e erro

---

### ISSUE 2 — Testes de integração do pipeline de tracking (adapter → domínio)

**Problema**
Não há testes que validem o fluxo completo de normalização e persistência de carriers.

**Escopo**

* `src/modules/tracking/*`
* `examples/api/*`

**Ações**

* Criar testes de integração usando fixtures reais
* Começar por **1 carrier** (Maersk ou MSC)
* Validar:

  * parsing da API
  * geração de observations
  * timeline derivada

**Critério de aceite**

* Teste falha se payload mudar de forma incompatível
* Pipeline roda sem mocks excessivos

---

## P1 — Robustez e Correção de Contratos

### ISSUE 3 — Fortalecer mappers com Zod (safeParseOrDefault)

**Problema**
Mappers usam asserts e casts inseguros ao converter dados do DB.

**Escopo**

* `processMapper.ts`
* `containerMapper.ts`
* `supabaseObservationRepository.ts`

**Ações**

* Substituir asserts por `safeParseOrDefault`
* Adicionar testes com rows inválidas/corrompidas
* Migrar **um mapper por PR**

**Critério de aceite**

* Nenhum cast inseguro remanescente
* Mappers toleram dados inválidos sem crash

---

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

### ISSUE 5 — Deprecar e remover `idUtils`

**Problema**
Utilitário de geração de ID está marcado como deprecated, mas ainda em uso.

**Escopo**

* `src/shared/utils/idUtils.ts`
* Consumers encontrados por busca

**Ações**

* Identificar consumidores
* Migrar para IDs gerados pelo DB
* Remover utilitário após migração

**Critério de aceite**

* Nenhum import de `idUtils`
* Arquivo removido ou isolado como legacy

---

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

Cada issue deve resultar em **1 PR pequeno**, com testes quando aplicável.
