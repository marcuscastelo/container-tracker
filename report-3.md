# Report 3 — Dashboard vs API (status: fields, gaps, perf)

Data: 2026-02-14

Resumo do que foi analisado:

- `src/modules/dashboard/ui/Dashboard.tsx`
- `src/modules/dashboard/application/processListPresenter.ts`
- `src/routes/api/processes.ts`
- `src/modules/process/interface/http/process.controllers.ts`
- `src/modules/process/interface/http/process.http.mappers.ts`

## DashboardExpectedFields

O dashboard (lista) / presenter (`presentProcessList`) espera o seguinte shape para cada processo (tipos extraídos de `processListPresenter.ts` e `Dashboard.tsx`):

- id: string (`ProcessSummary.id`) — usado no link `/shipments/{id}`
- reference: string | null (`ProcessSummary.reference`) — exibido como referência ou fallback com id
- origin.display_name?: string | null (`ProcessSummary.origin.display_name`) — exibido na coluna rota (origem)
- destination.display_name?: string | null (`ProcessSummary.destination.display_name`) — exibido na coluna rota (destino)
- containerCount: number — exibido como badge/pill na coluna containers
- status: StatusVariant — passado para `<StatusBadge />` (ex.: 'unknown', 'in-transit', 'loaded', 'delayed', ...)
- statusLabel: string — texto exibido dentro do `StatusBadge`
- eta: string | null — exibido na coluna ETA (ou `—` se ausente)
- carrier: string | null — exibido na coluna carrier

Badges / labels / elementos visuais que o Dashboard usa:

- `StatusBadge` (arquivo: `src/shared/ui/StatusBadge`) — recebe `variant={process.status}` e `label={process.statusLabel}`.
- Container count pill (inline span com classes Tailwind) — mostra `process.containerCount`.
- `MetricCard` (dashboard superior) — métricas derivadas do array de `ProcessSummary` (activeShipments, inTransit, delays, arrivalsToday).

Colunas visíveis no `src/modules/dashboard/ui/Dashboard.tsx`:

- Process (reference / id)
- Carrier
- Client (placeholder text, não vindo do API hoje)
- Route (origin → destination)
- Containers (count)
- Status (StatusBadge)
- ETA

Observações sobre o presenter (`src/modules/dashboard/application/processListPresenter.ts`):

- O presenter define `ProcessApiResponse` esperado pelo backend (veja abaixo) e transforma esse array em `ProcessSummary[]`.
- Atualmente `presentProcessList` NÃO possui dados de observações/trackings; ele define `status: 'unknown'` e `statusLabel: 'Awaiting data'` e `eta: null` por design, com comentário explícito: "Status will remain 'unknown' until we add a summary endpoint or include derived status in the process list API response.".


## ListProcessesResponseFields

Endpoint: GET /api/processes (`src/routes/api/processes.ts` → `processControllers.listProcesses`)

O controller (`src/modules/process/interface/http/process.controllers.ts`) chama `processUseCases.listProcessesWithContainers()` e mapeia cada resultado usando `toProcessResponse` (`src/modules/process/interface/http/process.http.mappers.ts`).

Shape retornado por `toProcessResponse` (cada item do array):

- id: string
- reference: string | null
- origin: { display_name?: string | null } | null
- destination: { display_name?: string | null } | null
- carrier: string | null
- bill_of_lading: string | null
- booking_number: string | null
- importer_name: string | null
- exporter_name: string | null
- reference_importer: string | null
- product: string | null
- redestination_number: string | null
- source: string (ex: 'manual')
- created_at: string (ISO)
- updated_at: string (ISO)
- containers: Array<{
  - id: string
  - container_number: string
  - carrier_code: string | null
  }>

Nota: o `GET /api/processes` atual NÃO injeta dados de tracking/observations/alerts — isto é feito apenas em `GET /api/processes/[id]` (veja `getProcessById` em `process.controllers.ts`, que chama `trackingUseCases.getContainerSummary` por container).


## Gap Analysis

✅ Já disponível

- `containerCount` (dashboard usa `process.containers.length`) — presenter: `containerCount: p.containers.length` — arquivo: `src/modules/dashboard/application/processListPresenter.ts` (OK).
- `carrier` — retornado por backend (`toProcessResponse`) e exibido em `Dashboard.tsx` (OK). Files: `src/modules/process/interface/http/process.http.mappers.ts`, `src/modules/dashboard/ui/Dashboard.tsx`.
- `origin` / `destination` (display_name) — retornados e exibidos (OK). Files: `src/modules/process/interface/http/process.http.mappers.ts`, `src/modules/dashboard/ui/Dashboard.tsx`.

🟡 Parcial

- status / statusLabel — Dashboard espera `status` e `statusLabel` (e renderiza `StatusBadge`) but:
  - presenter (`presentProcessList`) força `status: 'unknown'` e `statusLabel: 'Awaiting data'` até que o backend inclua resumo de tracking.
  - Backend NÃO fornece status agregado em `GET /api/processes` hoje. Arquivos relevantes: `src/modules/dashboard/application/processListPresenter.ts` (presente, mas placeholder), `src/modules/process/interface/http/process.controllers.ts` (não chama tracking in list).
  => Status visível, mas placeholder; funcionalidade parcial.

- eta — coluna de ETA existe na UI, presenter define `eta: null`, backend não fornece ETA no list endpoint. Parcial (coluna existe, valor sempre vazio). Files: `src/modules/dashboard/ui/Dashboard.tsx`, `src/modules/dashboard/application/processListPresenter.ts`.

❌ Ausente

- alerts (contagem ou badge de alerts) — Dashboard não exibe alertas na listagem; backend não retorna alerts em `GET /api/processes` (alerts são reunidos apenas no `GET /api/processes/[id]`). Files: `src/modules/dashboard/ui/Dashboard.tsx`, `src/modules/process/interface/http/process.controllers.ts`.
- last update / updated_at exibido — backend retorna `updated_at` (see mappers) mas dashboard NÃO exibe `created_at` nem `updated_at`. Files: `src/modules/process/interface/http/process.http.mappers.ts` (returns created_at/updated_at), `src/modules/dashboard/ui/Dashboard.tsx` (ignores them).
- process-level derived status/summary (e.g., delivered/discharged/hasTransshipment/transshipmentCount) — backend does not provide a process-level summary in list endpoint; dashboard needs it to render accurate `StatusBadge`. Files: `src/modules/process/interface/http/process.http.mappers.ts`, `src/modules/dashboard/application/processListPresenter.ts`.

- container-level status summaries included in process list — absent. Backend only includes containers basic fields (id, container_number, carrier_code). The tracking summaries are only fetched in `getProcessById` (detail endpoint) via `trackingUseCases.getContainerSummary`. Files: `src/modules/process/interface/http/process.http.mappers.ts`, `src/modules/process/interface/http/process.controllers.ts`.

O que precisa ser agregado (exemplos recomendados)

- process_status: string / enum — derivado a partir dos containers (e.g., DELIVERED, IN_TRANSIT, ARRIVED_AT_POD, DISCHARGED, DELAYED). Deve ser calculado server-side no `list` endpoint ou exposto por um novo summary endpoint. (Paths: `src/modules/process/application/*` → implementar função de agregação; `src/modules/process/interface/http/process.http.mappers.ts` → incluir campo na resposta; `src/modules/dashboard/application/processListPresenter.ts` → consumir).
- statusLabel: string — texto amigável para o badge (i18n pode ser feita no frontend usando key mapping, mas a API poderia fornecer a label também).
- eta: ISO string / humanized — agregar ETA por processo (por exemplo menor ETA among containers final/pod) e retornar no `GET /api/processes`.
- alerts_count / highest_severity / has_active_alerts — incluir contagem ou indicador para mostrar badge de alerta rápido no dashboard.
- last_update: updated_at — incluir `updated_at` no item do presenter (hoje o backend retorna, mas presenter/ Dashboard não mostram). Preferível exibir `updated_at` (ou time since) na listagem ou num hover.


## Performance Risk — chamadas a `trackingUseCases.getContainerSummary`

- Onde isso seria feito?
  - Se quisermos que o dashboard mostre status/alerts por processo sem chamadas adicionais do cliente, a implementação natural é no controller `listProcesses` (`src/modules/process/interface/http/process.controllers.ts`) ou no caso de uso `processUseCases.listProcessesWithContainers()` (server-side aggregation). Ou seja, quando o controller monta o array de processos, ele chamaria `trackingUseCases.getContainerSummary` para cada container ou para cada processo.

- Existe risco de N+1?
  - Sim. Atualmente `processUseCases.listProcessesWithContainers()` já traz containers (o trabalho de carregar containers já é feito). Se `listProcesses` ou o presenter começarem a chamar `trackingUseCases.getContainerSummary` por container em um loop (por exemplo `pwc.containers.map(c => trackingUseCases.getContainerSummary(...))`) teremos uma chamada por container, gerando N+1 queries/requests (N = total de containers retornados). No código atual esse comportamento já existe no detalhe (`getProcessById`), onde o controller faz `Promise.all(pwc.containers.map(... getContainerSummary ...))` — isso é feito propositalmente no detalhe e aceito ali, mas para a lista pode explodir o tempo e custo.

- O código atual já carrega containers?
  - Sim. `listProcesses` usa `processUseCases.listProcessesWithContainers()` (ver `src/modules/process/interface/http/process.controllers.ts`), de modo que o backend já retorna containers for each process (via `toProcessResponse`). Portanto os dados de containers (id/container_number/carrier_code) já estão carregados e disponíveis; o que falta são os summaries/observations que dependem de `trackingUseCases`.

Recomendações de mitigação de performance:

- Calcular/armazenar um resumo de tracking process-level (process_status, eta, alerts_count) incrementalmente durante pipelines de ingestão (snapshots → observations → timeline → status) e persistir isso para leitura rápida no `list` endpoint — evitar chamadas sincrônicas a `getContainerSummary` para cada container no tempo de requisição da lista.
- Se for realmente necessário chamar `getContainerSummary` na listagem, usar paginação/cap (ex.: só fetchar summaries para os primeiros X processos) e/ou executar em background/cache (ex.: adicionar campo cached_summary na tabela com TTL).


## Conclusão resumida (por arquivo)

- `src/modules/dashboard/ui/Dashboard.tsx` — consome `presentProcessList` e espera: id, reference, origin/destination display names, containerCount, status/statusLabel, eta, carrier. Atualmente status e eta vêm como placeholders.
- `src/modules/dashboard/application/processListPresenter.ts` — mapeia diretamente do response do backend, mas marca status como 'unknown' e eta null até que haja um summary endpoint.
- `src/routes/api/processes.ts` e `src/modules/process/interface/http/process.controllers.ts` — `GET /api/processes` retorna processos com containers, mas NÃO chama `trackingUseCases.getContainerSummary` (isso ocorre somente em `GET /api/processes/[id]`).
- `src/modules/process/interface/http/process.http.mappers.ts` — shape completo retornado pelo backend inclui campos que o dashboard não consome hoje (created_at, updated_at, bill_of_lading, booking_number, importer/exporter, product, source, etc.)

---

Se quiser, eu já implemento uma proposta mínima para preencher gaps de forma performática (por exemplo: adicionar `process_status`, `eta`, `alerts_count` ao `toProcessResponse` usando um novo usecase que lê um precomputed summary), ou então adicionar um endpoint `/api/processes/summary` que retorna somentes os campos necessários para o dashboard. Diga qual abordagem prefere e eu eu sigo com mudanças de código e testes.

