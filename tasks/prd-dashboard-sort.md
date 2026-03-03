# PRD 1 — Dashboard: Ordenar por Colunas (Sorting)

## Resumo

Adicionar ordenação por colunas no Dashboard (lista densa de processos/embarques) para reduzir fricção na migração do Trello e suportar triagem operacional rápida.

Ordenações-alvo (primeira entrega):

* Número do processo
* Importador
* Data de criação
* Status
* ETA
* Provider (carrier)

## Objetivo

* Permitir que o operador reorganize a lista por “eixo de decisão” sem perder contexto.
* Manter determinismo e auditabilidade: a ordenação deve ser **explicável** e estável.
* Interferir o mínimo possível no código atual (incremental, sem refactor de domínio).

## Não-objetivos

* Não introduzir regras novas de domínio.
* Não alterar derivação de status/ETA (continua vindo de tracking/read models).
* Não construir “query builder” genérico agora.

## Personas e Jobs

* Operador: “Quero ver o que está mais atrasado primeiro.”
* Coordenação: “Quero agrupar por importador para priorizar atendimento.”

## Requisitos Funcionais

### RF1 — Controle de ordenação por coluna

* Cada coluna suportada deve ter:

  * Click no header alterna: `desc → asc → (volta ao default)`.
  * Indicador visual (seta ↑/↓ + estado “ativo”).
* Deve existir um “default” consistente quando nenhum sort está ativo.

### RF2 — Ordenação multi-coluna (faseada)

* **MVP:** single-sort (apenas 1 coluna ativa).
* **Fase 2:** multi-sort com `Shift+Click` (até 3 colunas), mantendo UI densa.

### RF3 — Estabilidade (tie-break)

Quando houver empate no campo principal, usar tie-break determinístico:

1. `createdAt desc` (mais novo primeiro)
2. `processNumber asc` (ou `processId asc` se o número for nulo)

### RF4 — Persistência de preferência

* Persistir sort no URL (querystring) **e** em storage local:

  * URL é a fonte de verdade para compartilhamento/refresh.
  * Storage local como fallback (quando URL não especifica).

### RF5 — Compatibilidade com paginação (se existir)

* Se houver paginação server-side: sort precisa ser server-side.
* Se hoje for “lista curta sem paginação”: pode começar client-side, mas com contrato pronto para migração.

## Campos e Semântica de Ordenação

> Regra: ordenar **ViewModel** (UI) ou ordenar no backend usando **Response DTO**; a UI nunca ordena por Entity/Row.

1. **Número do processo**

* `processNumber` (string) ordenação lexicográfica “natural” (ex.: P-2 antes de P-10).
* MVP: lexicográfica simples.
* Fase 2: natural sort.

2. **Importador**

* `importerName` (string) case-insensitive, pt-BR collation quando viável.

3. **Data de criação**

* `createdAt` (timestamp)

4. **Status**

* Ordenar por *rank operacional* (não alfabético).
* MVP: usar `statusRank` já pronto no VM (número).
* Se não existir: criar tabela de rank no UI (apresentação), sem “inventar” domínio.

5. **ETA**

* Ordenar por `eta.primaryDate` (timestamp) com nulos por último.
* Nota: se houver distinção ACTUAL vs EXPECTED para “chegou”, o VM precisa carregar `etaKind` e `etaDateOrNull`.

6. **Provider**

* `provider` (enum/string)

## UX / Interações

* Header de cada coluna clicável com alvo de clique grande.
* Estado “sem ordenação ativa” mostra lista em default.
* A ordenação nunca deve “embaralhar” itens sem necessidade (tie-break definido).

## Estados Vazios e Nulos

* Strings nulas/vazias: vão para o final em `asc` e para o início em `desc` (definir política e manter consistente).
* Datas nulas: sempre por último (tanto asc quanto desc) — preferível para operações.

## Telemetria (mínimo)

* Evento: `dashboard_sort_changed` com `{ field, direction }`.

## Dependências e Contratos

* O Dashboard consome um **Read Model** (lista) do backend.
* Se hoje não existir endpoint com sort, adicionar **parâmetros opcionais** para não quebrar:

  * `sortField` (enum)
  * `sortDir` (`asc | desc`)

### Contrato HTTP sugerido

* `GET /api/dashboard/processes?sortField=eta&sortDir=asc`

## Implementação (arquitetura / boundaries)

* **UI:**

  * `DashboardListVM` deve conter campos já “ordenáveis” (ex.: `createdAtMs`, `statusRank`, `etaMsOrNull`, `importerNameNormalized`).
  * UI aplica sort client-side só no MVP, se dataset pequeno.

* **Capability (se necessário):**

  * Se a lista do dashboard for composição de vários BCs, a ordenação server-side vive na **capability** (compondo read models), nunca em domain.

* **BCs:**

  * Não introduzir regra canônica em capability.
  * Não importar `modules/*/domain` cruzado.

## Critérios de Aceite

* Ao clicar no header de “ETA”, a lista reordena e o estado fica refletido no URL.
* Recarregar a página mantém ordenação.
* Empates não geram reorder aleatório.
* Testes: unit de sorter + e2e/integração básica do comportamento do header.

## Riscos

* “Status order” pode gerar debate. Mitigar com rank explícito e documentado.
* Client-side sort em listas grandes pode degradar. Mitigar com migração planejada para server-side.

## Fases

* Fase 1 (MVP): single-sort, client-side (se dataset pequeno), URL state.
* Fase 2: server-side sort (quando houver paginação/escala), natural sort para processo.
* Fase 3: multi-sort com Shift+Click.

---

# PRD 2 — Dashboard: Filtros (Filtering)

## Resumo

Adicionar filtros no Dashboard para o operador reduzir rapidamente o “universo” de processos e focar em subsets operacionais.

Filtros-alvo (primeira entrega):

* Provider
* Importador
* Status
* (Opcional MVP+) “Com alertas” / “Somente atrasados”

## Objetivo

* Reduzir tempo para triagem.
* Evitar scroll infinito / ruído.
* Manter UI densa e orientada a exceção.

## Não-objetivos

* Não construir busca avançada por datas na primeira entrega.
* Não fazer “filtros salvos” (collections) agora.

## Requisitos Funcionais

### RF1 — Filtro por Provider

* Multi-select (checkbox) para carriers.
* Default: “todos”.

### RF2 — Filtro por Importador

* MVP: select com busca (typeahead) de importadores presentes no dataset atual.
* Fase 2: autocomplete server-side (para base grande).

### RF3 — Filtro por Status

* Multi-select por status canônico (com labels de UI).

### RF4 — Chips de filtros ativos

* Mostrar chips na barra superior do dashboard:

  * Ex.: `Provider: Maersk ×` `Importador: ACME ×`
* “Limpar tudo”.

### RF5 — Persistência

* Persistir filtros no URL (querystring).
* Storage local como fallback.

## UX / Layout

* Barra acima da tabela/lista:

  * [Provider] [Importador] [Status] [Clear]
* Deve ser “denso”, sem ocupar muita altura.
* Em telas menores: colapsar em drawer/painel.

## Semântica dos Filtros

* Provider: match exato.
* Importador: match por `importerId` quando existir; senão por `importerName` normalizado.
* Status: match por enum canônico.

## Contrato HTTP sugerido

* `GET /api/dashboard/processes?provider=MAERSK,MSC&status=IN_TRANSIT,ARRIVED_AT_POD&importerId=...`

> Observação: manter parâmetros opcionais e compatíveis com o estado atual.

## Implementação (arquitetura / boundaries)

* **UI:**

  * Filtros geram um `DashboardFiltersVM`.
  * Mapper UI converte URL → VM e VM → URL.
  * Filtro client-side no MVP se dataset pequeno.

* **Backend:**

  * Se já existe paginação/escala, filtrar server-side desde o início.
  * A composição de dados do Dashboard deve permanecer em capability (se cruzar BCs).

## Critérios de Aceite

* Selecionar Provider filtra imediatamente a lista.
* Chips refletem filtros ativos.
* Recarregar preserva filtros (URL).
* “Limpar tudo” retorna ao estado default.

## Riscos

* Importador sem `importerId` (só nome) pode gerar ambiguidade. Mitigar normalizando e exibindo contagem/preview.

## Fases

* Fase 1 (MVP): Provider + Status + Importador (client-side se possível), URL state.
* Fase 2: autocomplete server-side para importador + paginação.
* Fase 3: filtros avançados (datas, ETA ranges, alert categories).
