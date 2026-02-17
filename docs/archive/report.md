# Auditoria Arquitetural — Container Tracker

Data: 2026-02-11

Fonte única de verdade arquitetural: `docs/arquitetura_de_tipos_e_camadas_container_tracker_guia_definitivo-0211.md`

Resumo: este relatório lista violações de arquitetura, tipagem e cruzamentos entre camadas encontrados sob `src/modules/*` — classificadas por criticidade, com arquivo, linha aproximada, explicação e sugestão objetiva de correção (incremental).

---

## Módulo: tracking

1) Repositórios retornando unions { success: boolean } (contrato SupabaseResult)
   - Arquivos: `src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts` (linha ~1-220), `supabaseSnapshotRepository.ts`, `supabaseTrackingAlertRepository.ts`
   - Tipo: CRÍTICO
   - Por que viola: Documento, Seção 7.1 e Checklist (Seção 13) proíbe padrão `repository` que retorna `{ success: boolean }` — repositories devem lançar exceções (`throw`) em falhas e expor assinaturas claras. O uso de `SupabaseResult` propaga um padrão de HTTP/código para camadas superiores e obriga checagens condicionais por todo o application layer.
   - Sugestão: migrar o contrato do repository (domain `*Repository` interfaces) para retornar o tipo esperado diretamente (ex.: `Promise<Observation[]>`, `Promise<Snapshot | null>`, `Promise<void>`) e lançar `InfrastructureError`/erros específicos em caso de falha. Como correção incremental: introduzir adaptador na borda (infra) que converte o atual `SupabaseResult` para `throw` (lançar) e, em seguida, atualizar callers para remover checagens `if (!result.success)`.

2) Infra recebe tipos de domínio (NewObservation/NewSnapshot) em vez de Records
   - Arquivos: `supabaseObservationRepository.insertMany` (linha ~1-120), `supabaseSnapshotRepository.insert` (linha ~1-120)
   - Tipo: CRÍTICO
   - Por que viola: Seção 6.1 e Vocabulário (Seção 3) definem que repository/infra deve trabalhar com `Record`/`Row` para persistência; Commands/Entities/Domain-only types não devem ser enviados cru para infra. Isso mistura responsabilidades (domain → infra sem transformação explícita de Record).
   - Sugestão: definir `InsertObservationRecord` / `InsertSnapshotRecord` (application ↔ infra `Record`) e converter (mapeador infra) `Record → Row`. Como correção incremental: adicionar pequenas funções `toObservationInsertRecord(domainNewObservation)` na camada application antes de chamar infra; ou adicionar um adapter em `infrastructure/` que recebe `NewObservation` e produz/valida o `InsertRow` internamente, mas com types explícitos `Record` na assinatura pública do repository (migrar interface `ObservationRepository` a aceitar `Record`).

3) Mappers e validação runtime espalhados/duplicados dentro de infra
   - Arquivos: `supabaseObservationRepository.ts` (função `rowToObservation`, linhas ~1-40), `supabaseSnapshotRepository.ts` (`rowToSnapshot`), `supabaseTrackingAlertRepository.ts` (`rowToAlert`)
   - Tipo: MÉDIO
   - Por que viola: Seção 6.1 define que mappers de persistência devem viver em `modules/<mod>/infrastructure/persistence/*.mappers.ts`. Aqui o mapeamento e validação (`safeParse`) estão inline no repo, o que dificulta reuso/testes e misturam responsabilidades.
   - Sugestão: extrair `rowToObservation`, `rowToSnapshot`, `rowToAlert` para arquivos `infrastructure/persistence/*.mappers.ts`. Mantê-los testáveis e reutilizáveis.

4) Uso de `SupabaseResult` no domínio (interfaces do repository)
   - Arquivo: `src/modules/tracking/domain/observationRepository.ts` (linha ~1-40)
   - Tipo: CRÍTICO
   - Por que viola: O interface do repository no domínio usa `SupabaseResult` (um tipo infra/transversal). Seção 7 exige que a interface do repository seja domain-agnostic (tipos de domínio/leitura) e que erros sejam throw. Usar `SupabaseResult` colapsa infra com domínio.
   - Sugestão: alterar os tipos do `ObservationRepository` (e demais repos) para retornar os tipos esperados ou `Promise<T | null>` e lançar erros; remover dependência de `SupabaseResult` do domínio. Implementação incremental: adicionar um adapter que converte `SupabaseResult` → `throw` e manter a interface atual por enquanto; depois migrar callers.

---

## Módulo: process

1) Domain model usa snake_case e Zod — nomes de campo iguais ao Row/DB
   - Arquivos: `src/modules/process/domain/process.ts` (linha ~1-40), `processStuff.ts` (linha ~1-200)
   - Tipo: ALTO / CRÍTICO (por contaminação de camadas)
   - Por que viola: Seção 4 e 11 do documento deixam claro que o domínio deve usar tipos canônicos (camelCase e value objects) e que `Row` / snake_case devem ficar na infra (Seção 3 e 6.1). Atualmente `ProcessSchema` usa `created_at`, `updated_at` e campos em snake_case no domínio — isso faz o domínio parecer um DTO/Row e permite vazamento de `Row` para camadas superiores (application/UI).
   - Sugestão: migrar domínio para usar `createdAt`, `updatedAt`, e value objects (`ProcessEntity` / `ProcessAggregate`) com factories `createProcessEntity`. Como correção incremental: manter `ProcessSchema` para validação de inputs, mas criar typedefs `Process` (camelCase) e um mapeador infra `rowToProcess`/`processToDomain` que converta snake_case → camelCase. Evitar expor `ProcessSchema` diretamente como tipo de domínio em `export type Process = z.infer<typeof ProcessSchema>`.

2) Zod schemas de transporte/localizados no domínio (`CreateProcessInputSchema` em domain)
   - Arquivo: `src/modules/process/domain/processStuff.ts` (linha ~1-120)
   - Tipo: ALTO
   - Por que viola: Seção 6 e 11: Request/Response DTOs (Zod) pertencem à camada Interface/HTTP (`interface/http`). Aqui o schema `CreateProcessInputSchema` vive em `domain/`, misturando responsabilidade. O doc recomenda que mapeamento HTTP → Command ocorra em `interface/http`.
   - Sugestão: mover `CreateProcessInputSchema` para `src/modules/process/interface/http/process.schemas.ts` e criar um `http.mappers.ts` que converta `Request DTO → Command` (application). Como correção incremental: deixar o arquivo mas exportar um TODO e criar um forwarding module em `interface/http` que importa/encapsula o schema antes de mover tudo gradualmente.

3) Repositório de processo (infra) aceita `NewProcess` (domain) e retorna `SupabaseResult`
   - Arquivo: `src/modules/process/infrastructure/persistence/supabaseProcessRepository.ts` (linhas ~1-350)
   - Tipo: CRÍTICO
   - Por que viola: Seção 6.1 e 7. O repository deve aceitar `Record` para persistência e não propagar `SupabaseResult` para o domínio. Aceitar `NewProcess` (domínio) em `create(process: NewProcess)` mistura as camadas.
   - Sugestão: definir `InsertProcessRecord` (application ↔ infra) e alterar a assinatura `create(record: InsertProcessRecord): Promise<Process>` (ou lançar erro). Como correção incremental: adicionar um pequeno adapter `createFromDomain(newProcess: NewProcess)` internamente no arquivo que converte Domain → Record, e alterar interface pública do repository para aceitar `Record` (refatorar callers em application para produzir `Record`). Também remover `SupabaseResult` e adotar `throw` semantics.

4) Uso de Partial<Omit<Process, ...>> em application (update) — Partial de Entity
   - Arquivos: `src/modules/process/application/processUseCases.ts` (linhas ~130-170), `supabaseProcessRepository.update` assinatura (linha ~230)
   - Tipo: ALTO
   - Por que viola: Seção 5 e Seção 13 banem `Partial<Entity>`/`Omit<Entity>` como modelos de escrita/updates. `Process` aqui está modelado com snake_case (veja ponto anterior) e ser usado como base para updates fortalece acoplamento entre dominio e reposição.
   - Sugestão: criar `UpdateProcessRecord` (Record) com explicitidade dos campos updatáveis e usar esse tipo na assinatura de `processRepository.update(processId, record: UpdateProcessRecord)`. Em aplicação, mapear `CreateProcessInput` → `UpdateProcessRecord` explicitamente (já há código que monta `updates` — substitua o uso de `Partial<Omit<Process,...>>` pelo novo tipo).

5) Routes/controllers chamando repository diretamente
   - Arquivos: `src/routes/api/processes.ts` (linhas ~1-140) e `src/routes/api/refresh.ts` (linhas ~1-180)
   - Tipo: CRÍTICO
   - Por que viola: Seção 10 (SolidStart: routes, controllers e separação) e Checklist (Seção 13) proíbem controller chamando repository diretamente. `routes/api/processes.ts` tem código que usa `supabaseProcessRepository.fetchContainerByNumber` para ajudar a resolver conflito — isso acopla a camada HTTP à infra.
   - Sugestão: criar um application service / use case `resolveContainerOwner(containerNumber)` ou expor via `processUseCases`/facade um método para resolver proprietário do container; migrar chamadas do route para esse use case. Correção incremental: extrair função utilitária em `modules/process/application` que encapsula a lógica e use-a da rota.

6) Aggregate: inexistente ou comentado — regras de invariantes fora do domínio
   - Arquivo: `src/modules/process/domain/process.aggregate.ts` (todo comentado), validações/invariantes implementadas na application (ex.: impedir remoção do último container)
   - Tipo: MÉDIO/ALTO
   - Por que viola: Seção 12 define Aggregates como responsáveis por invariantes. Aqui o aggregate está ausente (comentado) e a regra `CannotRemoveLastContainer` é tratada no application/usecases (ex.: container reconcile). Isso reduz coerência e dispersa regras de negócio.
   - Sugestão: implementar um Aggregate (mesmo simples) `ProcessAggregate` com operações `addContainer`, `removeContainer` que garantam invariantes e publicar testes unitários mínimos. Como correção incremental: extrair a lógica de checagem de `reconcile` para uma função pura em `domain/` e usar essa função tanto no usecase quanto em testes.

---

## Módulo: container

1) Container repository usa `throw` (bom) — contraste com outros repos
   - Arquivo: `src/modules/container/infrastructure/persistence/container.repository.supabase.ts` (linha ~1-200)
   - Tipo: Observação (CONFORME)
   - Por que: Este repo lança `InfrastructureError` em vez de retornar unions — isso está alinhado com Seção 7.1. No entanto, o uso inconsistente (container repo lança, process/tracking usam `SupabaseResult`) cria risco de ambiguidade para callers.
   - Sugestão: preferir padronizar todos os repos para `throw` (migrar tracking/process repos) para reduzir inconsistência.

2) Mappers bem isolados (container.persistence.mappers.ts) — conforme recomendação
   - Arquivo: `src/modules/container/infrastructure/persistence/container.persistence.mappers.ts` (linha ~1-200)
   - Tipo: Observação (CONFORME)

---

## Módulo: process UI / presenters / interface

1) UI e presenters consumindo tipos com snake_case
   - Arquivos: `src/modules/process/application/processPresenter.ts` (linha ~1-200), `src/modules/process/ui/ShipmentView.tsx` (linha ~1-450), `src/routes/api/processes.ts` (linha ~1-140)
   - Tipo: ALTO
   - Por que viola: Seção 4 e 6.1 dizem que snake_case deve ficar na infra e que cada fronteira deve ter seu tipo. Aqui a UI/presenter consomem objetos com `created_at`, `container_number`, etc. Isso é consequência do domínio modelado com snake_case e do fato de que os mapeamentos HTTP/VM não estão claramente separados.
   - Sugestão: definir Response DTOs em `modules/<mod>/interface/http/*.schemas.ts` (já há `shared/api-schemas` — consolidar) e criar mappers `http.mappers.ts` para transformar Entity/Result → Response DTO no controller. Em UI, consumir ViewModel (retornado por presenter) que use camelCase e tipos próprios. Correção incremental: adicionar thin mappers no `processPresenter` que convertam snake_case → camelCase e garantir que UI uses ViewModel apenas.

2) Controllers (routes) fazendo mapeamentos manuais de entidade para response
   - Arquivo: `src/routes/api/processes.ts` (linha ~30-80)
   - Tipo: MÉDIO
   - Por que viola: Seção 10.2 — controller deve mapear `Entity/Result → Response DTO` via `interface/http` mappers. Aqui o mapeamento é feito inline no route, espalhando lógica.
   - Sugestão: extrair mapping para `modules/process/interface/http/process.http.mappers.ts` e reutilizar.

---

## Módulo: tracking ↔ UI (presenters)

1) Zod schemas e tipos de transporte sendo usados entre camadas
   - Arquivos: `src/shared/api-schemas/processes.schemas.ts` (linha ~1-140), `src/modules/tracking/domain/*.ts`
   - Tipo: MÉDIO
   - Por que viola: Document (Seção 6) recomenda Request/Response DTO e separação clara; além disso, Seção 13 lista "Zod schemas misturados com domínio" como antipadrão. Vê-se `ObservationSchema` e `ObservationResponseSchema` com shapes semelhantes — é preciso garantir claro owner/onde cada schema vive.
   - Sugestão: mover os HTTP-facing schemas para `interface/http` (ou consolidar em `shared/api-schemas` mas **usar apenas como DTO**, não como domain types). Domínio deve declarar suas próprias types/factories.

2) Spreads e merges entre objetos de diferentes camadas
   - Arquivos: `supabaseProcessRepository.fetchAllWithContainers` (linha ~1-80) faz `{ ...process, containers: ... }`
   - Tipo: MÉDIO
   - Por que viola: Seção 13 ban forbids spread of objects between layers: spread pode mascarar diferenças de tipos e causar vazamento de campos indesejados.
   - Sugestão: construir explicit object with the exact fields required for the return type (e.g., create `ProcessWithContainers` by assembling fields explicitly) — ou use a specific mapper function `rowToProcessWithContainers(row)`.

---

## Observações transversais (recorrentes)

1) Inconsistência de padrão de error/result em repositories
   - Frequentemente `SupabaseResult` é usado em tracking/process repos, enquanto container repo lança exceções. Risco: callers precisam lidar com dois estilos diferentes.
   - Correção recomendada: padronizar para `throw` (Seção 7.1). Migrar gradualmente com adapters.

2) Mistura de responsabilidades entre `domain/` e `interface/` (Zod schemas em `domain/`)
   - Vários schemas de request/response e validações de transporte estão em `domain/` (ex.: `CreateProcessInputSchema` em `domain/processStuff.ts`). Isso dificulta a evolução e quebra a regra "cada fronteira muda o tipo" (Seção 1 e 6).
   - Correção recomendada: mover schemas HTTP para `interface/http` e manter `domain/` para factories, value objects, aggregates.

3) Falta (ou comentário) de Aggregate para `Process`
   - Existe `process.aggregate.ts` comentado. Regras de domínio (ex.: não remover último container) estão no layer application. Isso dispersa invariantes.
   - Correção recomendada: implementar aggregate minimal, extrair lógica de invariant check para o domínio.

---

## Sumário executivo

- Principais padrões incorretos recorrentes:
  1. Repositórios que retornam `SupabaseResult` / { success: boolean } (propagação de padrão infra ao domínio) — tracking + process.
 2. Tipos snake_case e Zod de transporte/row vazando para o domínio e UI (domain com nomes de colunas).
 3. Controllers/Routes importando e chamando repositórios infra diretamente.
 4. Ausência/Comentário do Aggregate (Process) e invariantes implementadas no application layer.

- Risco arquitetural atual:
  - Alto — contaminação de camadas causa acoplamento forte entre infra e domínio, aumenta custo de mudanças (mudar DB/shape impacta diretamente UI), e cria dívidas técnicas em validação/erros inconsistentes.

- Ordem recomendada de refatoração (incremental):
  1. Padronizar erro/result dos repositórios: introduzir adaptadores que convertam `SupabaseResult` → `throw` e atualizar callers no application para usar `try/catch` (reduz superfície crítica rapidamente).
 2. Extrair/centralizar infra mappers (`rowToX`) presentes inline para `infrastructure/persistence/*.mappers.ts` e garantir que snake_case exista apenas em `Row` e mappers.
 3. Mover schemas HTTP (ex.: `CreateProcessInputSchema`) de `domain/` → `interface/http/` e criar mapeadores HTTP → Command (application). Atualizar routes para usar useCases/facades em vez de chamar repos.
  4. Introduzir `Record` types (`InsertProcessRecord`, `UpdateProcessRecord`, `InsertObservationRecord`) e adaptar assinaturas de repos para aceitá-los. Atualizar application para construir `Record`s explicitamente.
  5. Implementar (ou reativar) `ProcessAggregate` com invariantes e mover validações de invariantes para o domínio.

---

## Trade-offs e decisões ambíguas

- Uso de Zod no domínio: Zod é útil para validação runtime (especialmente ao mapear rows). A recomendação do documento é separar schemas de transporte dos tipos de domínio. Uma abordagem prática é manter Zod para validação de `Row → domain` dentro da infra (mappers), mas não usar Zod como a definição principal do modelo de domínio exportado. Isso equilibra segurança runtime com separação de responsabilidades.

- Padronização para `throw` em repositoria exige mudanças em muitos callers. Para evitar regressões, introduzir adapters que façam a transição (compat layer) é a abordagem mais segura.

---

## Próximos passos operacionais (tarefas incrementais)

1. Criar issues/PRs pequenos para:
   - Adapter `SupabaseResult` → `throw` para `tracking` e `process` repos.
   - Extrair `rowTo*` mappers para `infrastructure/persistence/*.mappers.ts` (tracking/process).
   - Mover `CreateProcessInputSchema` para `interface/http` e adicionar `process.http.mappers.ts`.
   - Definir `InsertProcessRecord` e `UpdateProcessRecord` e substituições em `processUseCases`.
   - Reintroduzir `ProcessAggregate` com testes unitários mínimos.

2. Validar com testes existentes (vitest) e adicionar pequenos testes de contrato para repositories (garantir que adapters lançam erros corretamente).

---

Arquivo gerado por auditoria automática. Se quiser, posso abrir PRs incrementais para cada item com patches sugeridos e testes associados.
