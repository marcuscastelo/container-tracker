## Verificação: origem do status entre Shipment View e Dashboard

Objetivo: entender como o status atual é exibido em `/shipment` e `/dashboard` e verificar se ambos usam a mesma fonte canônica.

Resumo executivo
- Shipment View recebe status derivado no backend (fonte canônica: pipeline de tracking).
- Dashboard atualmente NÃO recebe status derivado — usa um read-model básico e apresenta `unknown`.
- Risco: dashboard pode mostrar estado diferente (ou `unknown`) porque não consome o mesmo resumo que o Shipment View.

✅ Coerente

- Shipment view — backend -> API -> UI
  - Controller/handler (process + tracking call):
    - `src/modules/process/interface/http/process.controllers.ts` (função `getProcessById`)
  - Use-cases / application functions envolvidos:
    - `src/modules/process/application/usecases/find-process-by-id-with-containers.usecase.ts` (retorna processo + containers)
    - `src/modules/tracking/application/tracking.usecases.ts` (facade)
    - `src/modules/tracking/application/usecases/get-container-summary.usecase.ts` (getContainerSummary)
  - Pipeline/domain que derivam o status:
    - `src/modules/tracking/application/usecases/get-container-summary.usecase.ts` chama:
      - `src/modules/tracking/domain/deriveTimeline.ts` (constrói timeline)
      - `src/modules/tracking/domain/deriveStatus.ts` (deriva ContainerStatus)
      - `src/modules/tracking/domain/deriveAlerts.ts` (transshipment/alerts)
  - Mapeamento para resposta HTTP:
    - `src/modules/process/interface/http/process.http.mappers.ts` (`toContainerWithTrackingResponse`, `toProcessDetailResponse`)
  - UI consumer (shipment):
    - `src/modules/process/ui/fetchProcess.ts` (chama `GET /api/processes/:id`)
    - `src/modules/process/application/process.presenter.ts` (`presentProcess`) — usa `c.status` e `c.observations` retornados pela API
    - `src/modules/tracking/application/tracking.timeline.presenter.ts` (`deriveTimelineWithSeries`) — apresenta timeline com séries/predictions

Explicação: o Shipment View mostra o status derivado porque o controller `getProcessById` solicita, para cada container, `trackingUseCases.getContainerSummary` que já executa `deriveTimeline` + `deriveStatus` e retorna `status` no JSON (campo `containers[].status`). A UI apenas mapeia esse status para variantes (via `containerStatusToVariant`) e calcula o status do processo agregando os status dos containers (`deriveProcessStatus` em `process.presenter.ts`).

🟡 Parcial

- Dashboard — lista de processos (resumo)
  - Controller/handler / rota usada pela UI:
    - `src/routes/api/processes.ts` → `export const GET = processControllers.listProcesses`
    - `src/modules/process/interface/http/process.controllers.ts` (`listProcesses`)
  - Use-case / application function:
    - `src/modules/process/application/usecases/list-processes-with-containers.usecase.ts` (retorna `ProcessWithContainers[]`)
    - Repositórios usados: `src/modules/process/infrastructure/persistence/supabaseProcessRepository.ts` (fetchAll) + `src/modules/container/infrastructure/persistence/container.repository.supabase.ts` (listByProcessIds)
  - Presenter / mapping para UI:
    - `src/modules/dashboard/application/processListPresenter.ts` (`presentProcessList`) — atualmente define:
      - `status: 'unknown'`
      - `statusLabel: 'Awaiting data'`
  - UI consumer (dashboard):
    - `src/modules/dashboard/ui/Dashboard.tsx` — chama `typedFetch('/api/processes')` → `presentProcessList(data)`

Explicação: o Dashboard consome `GET /api/processes` que NÃO inclui observações nem status derivados. O presenter `presentProcessList` define `status` como `'unknown'` explicitamente (comentário no código indicando que é necessário um endpoint de resumo). Portanto o dashboard não usa a mesma fonte canônica que o shipment view.

❌ Inconsistente / Riscos

- Duplicação de lógica / risco de divergência
  - Existe lógica de derivação de status NO DOMÍNIO (fonte canônica):
    - `src/modules/tracking/domain/deriveStatus.ts`
  - Existe lógica de agregação de status ao nível do processo na camada de apresentação do processo (UI/presenter):
    - `src/modules/process/application/process.presenter.ts` — função `deriveProcessStatus` (ordem de dominância) — usada para exibir o status do processo no Shipment View.
  - Risco: O dashboard não consome `containers[].status` e portanto não usa nem `deriveStatus` nem `deriveProcessStatus`. Isso torna possível que o dashboard mostre `unknown` enquanto o Shipment View mostra um status derivado a partir do pipeline. Além disso, se no futuro alguém implementar um mapeamento de status na UI (por exemplo, tentar derivar status a partir de containers sem usar o pipeline), haverá risco de divergência entre regras e ordens de dominância.

Trechos relevantes (exemplos)
- Controller que provê status para Shipment:
  - `src/modules/process/interface/http/process.controllers.ts` — getProcessById chama `trackingUseCases.getContainerSummary(...)` para cada container
- Use-case que deriva status (fonte canônica):
  - `src/modules/tracking/application/usecases/get-container-summary.usecase.ts` → chama `deriveTimeline` e `deriveStatus` (`src/modules/tracking/domain/deriveStatus.ts`)
- Presenter de dashboard (não derivando):
  - `src/modules/dashboard/application/processListPresenter.ts` — define `status: 'unknown'` (comentário explicando a limitação)

Recomendações rápidas
1. Criar um endpoint de resumo (read-model/projection) para o dashboard que retorne `processes[]` com `containers[].status` e `eta` agregados (ou um campo `process_status`) — assim o dashboard consumirá a mesma fonte canônica usada pelo Shipment View. Locais sugeridos:
   - Application: `src/modules/process/application/usecases/` — novo usecase `listProcessesWithSummary.usecase.ts`
   - Controller: estender `listProcesses` para chamar presenter que inclua tracking summaries OR criar rota separada `GET /api/processes/summary`
2. Evitar lógica de derivação no UI. Manter `deriveStatus` no domínio e exportar um presenter/read-model (projection) para consumo do dashboard.
3. (Curto prazo) Se não for possível fornecer um endpoint, documentar explicitamente no `src/modules/dashboard/README.md` que dados de status não estão disponíveis e que os filtros/metrics ficarão desabilitados.

Status da verificação (tarefas)
 - Procurei e validei os arquivos e rotas descritos acima.

---

Relatórios e paths citados (resumo)
- Controllers / routes
  - `src/routes/api/processes.ts` (GET → `processControllers.listProcesses`, POST → `createProcess`)
  - `src/modules/process/interface/http/process.controllers.ts` (listProcesses, getProcessById, ...)

- Application / Usecases
  - `src/modules/process/application/usecases/list-processes-with-containers.usecase.ts`
  - `src/modules/process/application/usecases/find-process-by-id-with-containers.usecase.ts`
  - `src/modules/tracking/application/usecases/get-container-summary.usecase.ts`
  - `src/modules/tracking/application/tracking.usecases.ts` (facade)

- Domain (canonical derivation)
  - `src/modules/tracking/domain/deriveTimeline.ts`
  - `src/modules/tracking/domain/deriveStatus.ts`
  - `src/modules/tracking/domain/deriveAlerts.ts`

- HTTP mappers / presenters
  - `src/modules/process/interface/http/process.http.mappers.ts` (toContainerWithTrackingResponse, toProcessDetailResponse)
  - `src/modules/process/application/process.presenter.ts` (presentProcess, deriveProcessStatus)
  - `src/modules/dashboard/application/processListPresenter.ts` (presentProcessList)

- UI
  - `src/modules/process/ui/ShipmentView.tsx` (consome `GET /api/processes/:id`)
  - `src/modules/process/ui/fetchProcess.ts` (typedFetch + presentProcess)
  - `src/modules/dashboard/ui/Dashboard.tsx` (consome `GET /api/processes` + presentProcessList)

Conclusão
 - Categoria geral: 🟡 Parcial — O sistema já tem uma fonte canônica para derivação de status (pipeline + `deriveStatus`) e o Shipment View usa essa fonte. Porém o Dashboard atualmente não consome esse resumo e, por isso, usa um presenter que marca status como `unknown`. Para consistência completa, recomendo expor um read-model/projection para o dashboard que retorne status/eta já derivados.

Gerado em: 2026-02-14
