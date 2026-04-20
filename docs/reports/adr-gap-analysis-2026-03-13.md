# ADR Gap Analysis

## 1. Existing decisions already covering the space

Base canônica consultada:

- `docs/ARCHITECTURE.md`
- `docs/BOUNDARIES.md`
- `docs/TYPE_ARCHITECTURE.md`
- `docs/UI_PHILOSOPHY.md`
- `docs/ALERT_POLICY.md`
- `docs/TRACKING_INVARIANTS.md`
- `docs/TRACKING_EVENT_SERIES.md`
- ADRs: `0003`, `0004`, `0007`, `0008`, `0009`, `0010`, `0013`, `0020`

Cobertura já existente relevante:

- **BC vs Capability / ownership / layering**: já formalizado (ADR-0003, `docs/BOUNDARIES.md`, ADR-0007).
- **Shared kernel e anti-coupling**: já formalizado (ADR-0004).
- **UI semântica vs apresentação**: já formalizado (ADR-0007 + `docs/UI_PHILOSOPHY.md`).
- **Feature slices dentro de BC (não UI)**: já formalizado (ADR-0008).
- **Vocabulário Page/Screen/View/Layout/Controller Hook/UI Usecase**: já existe em ADR-0010, mas está **Proposed**.
- **ViewModel vs UI state vs UI service naming**: já existe em `docs/ARCHITECTURE.md` (seções 9 e 10).
- **Repository/mappers/contracts**: já existe em `docs/TYPE_ARCHITECTURE.md` (mappers, repositories, comandos/records/rows).
- **Server-first sync reconciliation**: já formalizado em ADR-0013.

Leitura objetiva: repositório já tem bastante decisão arquitetural formal. gap principal não é “falta total de ADR”, e sim **lacunas específicas de enforcement e de detalhamento em áreas de validação multi-fronteira**.

## 2. Evidence found in codebase

### A) UI além de screens (taxonomy e naming)

Evidência de coexistência de taxonomias distintas para responsabilidades similares:

- `process/ui` usa `screens/`, `viewmodels/`, `validation/`, `telemetry/`, `utils/`, `mappers/`.
- `agent/ui` usa `agent-detail-page.tsx`, `agents-page.tsx`, `vm/`, `api/`, sem `screens/`/`validation/`.
- `capabilities/search/ui` usa `SearchOverlay.tsx` + `SearchOverlay.panel.tsx` + `fetchSearch.ts` (sem convenção Screen/View/Usecase explícita).

Arquivos concretos:

- `src/modules/process/ui/screens/DashboardScreen.tsx` (monolítico; `max-lines-per-function` explicitamente desabilitado).
- `src/modules/agent/ui/agents-page.tsx` (estado/filtro/sort/realtime concentrado na própria page).
- `src/modules/process/ui/components/dashboard-status-cell.presenter.ts`
- `src/modules/process/ui/screens/shipment/lib/shipmentEdit.mapper.ts`
- `src/modules/process/ui/screens/shipment/lib/shipmentError.presenter.ts`

Sinais de ambiguidade nominal:

- `presenter` existe em `components/` e em `screens/.../lib/`.
- `service` de sort/filter está em `viewmodels/` (`dashboard-filter.service.ts`, `dashboard-sort.service.ts`).
- `mapper` aparece fora de `mappers/` (`shipmentEdit.mapper.ts` em `lib/`).

Conclusão: há drift real de taxonomia UI, porém espaço já está parcialmente coberto por `ARCHITECTURE.md` + ADR-0010 (proposed).

### B) Validation layering

Separação existe, mas com zonas cinzentas recorrentes:

- **Domínio**: `src/modules/process/domain/process.validation.ts`, `src/modules/container/domain/container.validation.ts`.
- **Interface HTTP**: múltiplos `*.schemas.ts` (process/container/tracking/capabilities).
- **UI form/query/storage**: forte presença em `src/modules/process/ui/validation/*`.
- **Infra de providers**: schemas Zod em `src/modules/tracking/infrastructure/carriers/schemas/api/*`.
- **Infra persistence** com parse Zod: `src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts`.

Ambiguidades concretas:

- `src/modules/process/ui/validation/processApi.validation.ts` mistura validação com **I/ HTTP, cache/prefetch e montagem de query**.
- `src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts` importa normalizador de usecase (`normalizeContainerNumber`), misturando responsabilidade de camada.
- `src/modules/process/ui/screens/shipment/lib/shipmentRefresh.status.ts` define schemas e contratos de resposta dentro de `lib/`, não numa fronteira de schema clara.

Conclusão B: recorrência alta e impacto de boundary/layering alto; aqui há lacuna de decisão formal suficientemente forte para ADR novo.

### C) UI state / filter / sort / selection

Padrão robusto já existe no dashboard de process:

- estado + derivação separados em `dashboard-filter.service.ts` e `dashboard-sort.service.ts`.
- URL/query/storage hydration separados em:
  - `dashboardSortQuery.validation.ts`
  - `dashboardSortStorage.validation.ts`
  - `dashboardFilterQuery.validation.ts`
  - `dashboardFilterStorage.validation.ts`
- reconciliação server-first explícita em `dashboard-sync-reconciliation.ts` (alinhado ADR-0013).

Inconsistências observadas:

- persistência de ordem de colunas fica em `components/dashboard-columns.ts` (não no mesmo padrão de `validation/*`).
- módulo `agent/ui` faz sort/filter/query mapping de forma própria em `agents-page.tsx` + `api/agent.api.ts`.

Conclusão C: existe base forte e funcional; falta padronização operacional fina, mas não há evidência suficiente para novo ADR agora.

### D) Infrastructure decomposition (repository/query/mapper/controller-adapter)

Padrão saudável em partes:

- `process` e `container` com repositories/mappers relativamente enxutos.

Pontos de inflamento e mistura:

- `src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts` (~527 linhas): dedup complexo + read model + lifecycle updates no mesmo arquivo.
- `src/modules/tracking/infrastructure/persistence/tracking.persistence.mappers.ts` (~533 linhas).
- `src/shared/api/sync.controllers.bootstrap.ts` concentra implementação de múltiplas ports + queries SQL + parse schema no bootstrap compartilhado.
- `src/modules/process/interface/http/process.controllers.ts` deriva timeline no controller (`deriveTimelineWithSeriesReadModel`).

Conclusão D: há risco de inflamento e espalhamento, mas isso parece mais problema de refatoração/enforcement do que ausência de decisão arquitetural base.

### E) Carrier integrations

Estrutura geral é consistente:

- split explícito em `fetchers/`, `normalizers/`, `schemas/api/`, `tests/`.
- cada carrier principal com tríade fetcher + normalizer + schema (`msc`, `maersk`, `cmacgm`).
- suíte de testes extensa em `infrastructure/carriers/tests` (incluindo regressões semânticas).

Drift observado:

- profundidade de cobertura desigual (`msc` com muito mais testes que `maersk`).
- `maersk` tem fetcher significativamente mais operacional/complexo (`maersk.puppeteer.fetcher.ts`) e rota legacy deprecada (`src/routes/api/refresh-maersk/[container].ts`).

Conclusão E: decomposição estrutural já existe e está clara; gap atual é mais de hardening/refactor local que de decisão arquitetural nova.

### F) Testes grandes

Evidência quantitativa:

- `src/modules/tracking/features/alerts/domain/tests/deriveAlerts.test.ts` >1000 linhas.
- múltiplas suítes entre ~300 e ~580 linhas (`process.controllers.test.ts`, `pipeline.integration.test.ts`, etc.).

Evidência qualitativa:

- apesar de grandes, várias suítes já estão particionadas por famílias semânticas (`describe` por comportamento/invariante).
- convenção de extração de helpers já existe no AGENTS root (evitar funções enormes em testes).

Conclusão F: problema de mantenabilidade local e hygiene contínua, não de decisão arquitetural inédita.

## 3. Candidate ADR evaluation matrix

|Candidate ADR|Evidence strength|Cross-cutting recurrence|Architectural impact|Already covered?|Recommendation|Rationale|
|---|---|---|---|---|---|---|
|1) ADR — UI component taxonomy beyond screens|High|High|High|**Partial** (`ARCHITECTURE.md` + ADR-0010 Proposed)|**Already covered by existing ADR/docs**|repositório já tem direção formal; criar novo ADR agora seria redundante. Falta rollout/enforcement da ADR-0010 e alinhamento entre módulos (`process/ui`, `agent/ui`, `capabilities/search/ui`).|
|2) ADR — UI state / filter / sort / selection separation|Medium|Medium|Medium/High|**Yes (partial-operational)** (`ARCHITECTURE.md` + ADR-0013)|**Prefer guideline/checklist**|dashboard já implementa padrão robusto; drift remanescente é operacional (coluna/order persistence, variações em `agent/ui`). Checklist de PR + convenção de pastas resolve melhor que ADR novo.|
|3) ADR — Validation layering|**High**|**High**|**High**|**Partial** (`TYPE_ARCHITECTURE.md` cobre macro, não modos detalhados)|**Create ADR now**|Há mistura recorrente entre validação, parsing tolerante, boundary decoding e I/ (`processApi.validation.ts`, schemas infra/provider, parse em persistence). Sem decisão formal mais precisa, regressão de layering é provável.|
|4) ADR — Repository / Query / Mapper separation|Medium|Medium|High|**Yes (base rules exist)** (`TYPE_ARCHITECTURE.md`)|**Refactor first, ADR later**|Existem arquivos inflados, mas contrato arquitetural base já está definido. Primeiro extrair hotspots (tracking alert repo, sync bootstrap queries); depois avaliar se falta decisão nova.|
|5) ADR — Provider fetcher / schema / normalizer decomposition|Medium/High|High|Medium/High|**Mostly yes (de facto in code + tracking docs)**|**Do not create**|padrão já existe e é repetido nos 3 carriers. Gaps são de robustez/cobertura desigual, não de falta de decisão estrutural.|
|6) ADR — Test suite partitioning strategy|Medium|High|Medium|**Partially yes (AGENTS conventions)**|**Prefer guideline/checklist**|suítes grandes já usam partições semânticas; que falta é higiene contínua (extração de builders/helpers), melhor tratada por guideline + lint/CI gradual.|
|7) (extra) ADR — Controller orchestration boundary (HTTP adapter thinness)|Medium|Medium/High|High|Partial (`routes thin` sim; controller thin não está formalizado)|**Refactor first, ADR later**|Há controllers/bootstraps muito grandes, mas ainda é cedo para ADR novo antes de medir refactor de 2–3 hotspots e verificar padrão recorrente pós-limpeza.|

## 4. Recommended ADRs now

### 4.1 Proposed title

**ADR — Validation Layering and Parsing Modes (Canonical Acceptance vs Tolerant Parsing)**

### Scope

- Fronteiras de validação em `domain`, `interface/http`, `ui`, `infrastructure`.
- Naming e placement de artefatos (`*.schemas.ts`, `*.validation.ts`, `*.decoder.ts`/equivalente).
- Regras de quando usar validação estrita vs parsing tolerante.

### Why now

- Problema já recorrente em múltiplos pontos (UI validation + interface schemas + infra provider schemas + persistence parse).
- Mistura atual aumenta risco de regressão de boundary e de semântica de erro.
- Existe lacuna entre regra macro (`TYPE_ARCHITECTURE`) e regra operacional concreta de “modo de validação por fronteira”.

### What ambiguity it resolves

- Onde validação de contrato canônico deve falhar fast (ex.: HTTP boundary).
- Onde parsing tolerante é aceitável (ex.: payload externo de carrier) e como sinalizar falha (sem esconder incerteza).
- que `*.validation.ts` pode ou não conter (evitar mistura com transporte/caching/orquestração).
- Regras para parsing de row externa em infra e dependências permitidas entre camadas.

### What it must explicitly forbid

- `domain` dependente de Zod/schemas de transporte.
- `*.validation.ts` com I/ de rede/cache como responsabilidade principal.
- infra importando helpers de usecase para normalização que deveriam viver em utilitário de boundary estável.
- “parse falhou -> silenciar sem sinalização explícita” em fluxos sensíveis de tracking.

## 5. Things that should NOT become ADRs

- Padronização fina de nomes de componentes UI (`Card`, `Panel`, `Row`, etc.): melhor via guideline de naming + exemplos.
- Estratégia de persistência específica de `dashboardColumnOrder`: guideline local de UI state persistence.
- Tamanho máximo de arquivo de teste por si só: melhor via lint/checklist e extração incremental de fixture builders.
- Ajustes específicos de coverage por carrier (ex.: aumentar testes de Maersk): isso é backlog técnico, não decisão arquitetural.
- Reorganização pontual de repository/controller gigante isolado: primeiro refatorar hotspots, depois reavaliar necessidade de ADR.

## 6. Impact on current balancing plan

Mudanças recomendadas no plano de balanceamento/inspeção da tree:

1. **Criar trilha transversal de Validation Layering** (curta, focada em fronteiras), antes de novos refactors amplos de UI.
2. **Tratar UI taxonomy como rollout de decisão existente** (ADR-0010 + ARCHITECTURE), com checklist de PR em vez de novo ADR.
3. **Executar refactors-alvo em hotspots de infraestrutura** antes de qualquer ADR novo de repository/query split:
   - `supabaseTrackingAlertRepository.ts`
   - `tracking.persistence.mappers.ts`
   - `shared/api/sync.controllers.bootstrap.ts`
4. **Manter carriers no padrão atual** e atacar somente lacunas de robustez/cobertura.
5. **Adicionar hygiene contínua de testes grandes** (extração de fixtures/helpers por família de comportamento).

## 7. Final recommendation

- **ADRs novos para criar agora: 1**
- **Criar agora:**
  1. `ADR — Validation Layering and Parsing Modes (Canonical Acceptance vs Tolerant Parsing)`
- **Ordem sugerida:**
  1. Validation layering ADR
  2. rollout/checklist de UI taxonomy (sem ADR novo)
  3. refactor hotspots infra/controller
- **Ficam em espera:**
  - UI taxonomy beyond screens (já coberto por docs/ADR existente; precisa enforcement)
  - UI state/filter/sort/selection (guideline/checklist)
  - Repository/query/mapper separation (refactor-first)
  - Provider decomposition (não criar)
  - Test partitioning strategy (guideline/checklist)

---

## Nota de método

`code-report.txt` foi usado como apoio de inventário (tree/tamanho), mas conclusões acima foram validadas na codebase como source-of-truth (arquivos e trechos citados).
