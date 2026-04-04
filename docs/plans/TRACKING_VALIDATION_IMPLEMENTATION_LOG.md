# Tracking Validation Implementation Log

## A. Estado atual
- Fase atual: V1 pluginável / Fase 2
- Status atual: concluído em 2026-04-03
- Concluído:
  - slice canônico `modules/tracking/features/validation` criado no Tracking BC
  - contratos mínimos de detector, context, finding, severidade, sumários e registry fechados
  - registry explícito/determinístico ligado com runtime vazio na Fase 1
  - derivação/aplicação canônica ligada no pipeline, hot-read e `getContainerSummary`
  - agregação mínima por container e por processo propagada até response DTO, mapper e VM
  - UI mínima ligada no dashboard, shipment header e container selector sem rederivar semântica
  - `tracking_freshness_token` atualizado com `tracking_validation`
  - reconciliação server-first da shipment screen ajustada para copiar `trackingValidation`
  - testes ajustados
  - `pnpm check` verde em 2026-04-03
  - QA manual desktop/mobile executada
- Em andamento:
  - nenhuma frente em andamento nesta fase
- Falta:
  - iniciar a Fase 3 em cima da base pluginável já consolidada

## A.1 Kickoff da Fase 2
- Entendimento inicial:
  - a Fase 2 pluginável combina a UI mínima funcional real com o primeiro detector real, sem abrir caminho paralelo fora do registry
  - o detector precisa nascer no Tracking BC, operando por série e preservando a regra safe-first
  - dashboard deve continuar leve e shipment deve continuar timeline-first
- Status herdado da Fase 1:
  - plumbing E2E já existe até DTO/VM/UI
  - o registry está integrado, mas ainda vazio
  - a UI já tem slots reais para a feature, porém com copy provisória e sem detector ativo
- Plano cirúrgico desta fase:
  - alinhar `TrackingValidationSeverity`, `TrackingValidationAffectedScope` e `TrackingValidationFinding` ao contrato canônico mínimo da V1
  - implementar `CONFLICTING_CRITICAL_ACTUALS` como plugin isolado em `modules/tracking/features/validation/domain/detectors`
  - registrar o detector apenas via registry explícito
  - manter DTO/VM compactos, mapeando severidade interna para severity presentation-only na fronteira HTTP
  - consolidar o naming final em dashboard, shipment header e container-level chip após QA visual em tela real

## B. Decisões fechadas
- Tracking continua dono exclusivo da semântica de validation issues.
- O framework pluginável é local ao Tracking BC, explícito e determinístico.
- O registry de produção nasce vazio na Fase 1; não há detector real ativo ainda.
- A UI recebe apenas agregados mínimos; findings completos continuam internos ao Tracking.
- O dashboard recebe somente `has_issues`, `highest_severity` e `affected_container_count`.
- O shipment detail recebe resumo de processo e resumo por container; não recebe findings.
- A UI de shipment continua timeline-first; validation aparece só como suporte no header/container selector.
- Não foi criado novo status canônico, novo alert system nem persistência de lifecycle de validation.

## C. Arquivos tocados
- Criados:
  - `src/modules/tracking/features/validation/domain/model/trackingValidationSeverity.ts`
  - `src/modules/tracking/features/validation/domain/model/trackingValidationAffectedScope.ts`
  - `src/modules/tracking/features/validation/domain/model/trackingValidationFinding.ts`
  - `src/modules/tracking/features/validation/domain/model/trackingValidationContext.ts`
  - `src/modules/tracking/features/validation/domain/model/trackingValidationDetector.ts`
  - `src/modules/tracking/features/validation/domain/model/trackingValidationSummary.ts`
  - `src/modules/tracking/features/validation/domain/detectors/index.ts`
  - `src/modules/tracking/features/validation/domain/registry/trackingValidationRegistry.ts`
  - `src/modules/tracking/features/validation/domain/services/deriveTrackingValidation.ts`
  - `src/modules/tracking/features/validation/domain/services/aggregateTrackingValidation.ts`
  - `src/modules/tracking/features/validation/application/projection/trackingValidation.projection.ts`
  - `src/modules/tracking/features/validation/domain/tests/trackingValidation.registry.test.ts`
  - `src/modules/process/ui/viewmodels/tracking-validation.vm.ts`
  - `docs/plans/TRACKING_VALIDATION_IMPLEMENTATION_LOG.md`
- Alterados:
  - `src/modules/tracking/application/orchestration/pipeline.ts`
  - `src/modules/tracking/application/projection/tracking.hot-read.projections.ts`
  - `src/modules/tracking/application/usecases/find-containers-hot-read-projection.usecase.ts`
  - `src/modules/tracking/application/usecases/get-container-summary.usecase.ts`
  - `src/modules/process/features/operational-projection/application/processOperationalSummary.ts`
  - `src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts`
  - `src/modules/process/interface/http/process.detail-with-tracking.http.ts`
  - `src/modules/process/interface/http/process.controllers.ts`
  - `src/modules/process/interface/http/process.http.mappers.ts`
  - `src/shared/api-schemas/processes.schemas.ts`
  - `src/modules/process/ui/viewmodels/process-summary.vm.ts`
  - `src/modules/process/ui/viewmodels/shipment.vm.ts`
  - `src/modules/process/ui/mappers/processList.ui-mapper.ts`
  - `src/modules/process/ui/mappers/processDetail.ui-mapper.ts`
  - `src/modules/process/ui/screens/shipment/hooks/useShipmentScreenResource.ts`
  - `src/modules/process/ui/components/DashboardProcessTable.tsx`
  - `src/modules/process/ui/components/ShipmentHeader.tsx`
  - `src/modules/process/ui/components/ContainerSelector.tsx`
  - `src/routes/dev/tracking-scenarios.tsx`
  - `src/locales/pt-BR.json`
  - suites de teste afetadas em tracking/process/UI para cobrir o novo contrato

## D. Contratos criados
- Tracking:
  - `TrackingValidationDetector`
  - `TrackingValidationContext`
  - `TrackingValidationFinding`
  - `TrackingValidationRegistry`
  - `TrackingValidationContainerSummary`
  - `TrackingValidationProcessSummary`
- Projeção:
  - `TrackingValidationContainerProjection`
- UI:
  - `ProcessTrackingValidationVM`
  - `ContainerTrackingValidationVM`
- DTOs:
  - `ProcessResponse.tracking_validation`
  - `ProcessDetailResponse.tracking_validation`
  - `ProcessDetailResponse.containers[].tracking_validation`

## E. Riscos / dívidas locais
- O registry vazio garante contrato e wiring, mas não cobre cenários positivos em runtime fora de testes.
- A Fase 1 entrega só agregados; quando detectores reais entrarem, será preciso cuidar do payload do shipment para não vazar details pesados cedo demais.
- A semântica ainda não possui lifecycle persistido; Fase 2+ precisa manter histórico sem apagar fatos.
- Qualquer BC/capability que monte `ProcessResponse` manualmente precisa continuar incluindo `tracking_validation`.

## F. Testes
- Criados/ajustados:
  - `src/modules/tracking/features/validation/domain/tests/trackingValidation.registry.test.ts`
  - `src/modules/tracking/application/usecases/tests/find-containers-hot-read-projection.usecase.test.ts`
  - `src/modules/process/application/usecases/tests/list-processes-with-operational-summary.usecase.test.ts`
  - `src/modules/process/interface/http/tests/process.controllers.test.ts`
  - `src/modules/process/interface/http/tests/process.http.mappers.test.ts`
  - `src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts`
  - `src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts`
  - `src/modules/process/ui/mappers/tests/processDetail.arrived-status.ui-mapper.test.ts`
  - `src/modules/process/ui/mappers/tests/containerSummary.ui-mapper.test.ts`
  - `src/modules/process/ui/tests/fetchProcess.cache.test.ts`
  - `src/modules/process/ui/screens/shipment/hooks/useShipmentScreenResource.test.ts`
  - `src/modules/process/ui/screens/shipment/lib/shipmentAlertNavigation.test.ts`
  - `src/modules/process/features/operational-projection/application/tests/aggregateOperationalSummary.test.ts`
- Cenários cobertos:
  - registry explícito e determinístico
  - propagação container/process -> DTO -> VM
  - freshness/reconciliation path
  - ausência de regressão em aggregation e mappers
- Checks executados:
  - `pnpm run type-check`
  - `pnpm check`

## G. QA manual
- Executada em 2026-04-03 com app local em `http://localhost:3000`
- Rotas verificadas:
  - dashboard `/`
  - shipment `/shipments/ef2ecebd-e48a-4e37-9104-b05cf9da8f94`
- Viewports verificados:
  - desktop `1440x900`
  - mobile `393x851`
- Evidências:
  - `dashboard-validation-phase1-desktop-wide.png`
  - `dashboard-validation-phase1-mobile.png`
  - `shipment-validation-phase1-desktop-wide.png`
  - `shipment-validation-phase1-mobile.png`
- Comportamento observado:
  - nenhum chip/banner de validation aparece com registry vazio
  - dashboard continua leve e sem inflar coluna de alertas
  - shipment continua timeline-first; alertas continuam acima e timeline não foi quebrada
  - container selector não exibiu chip extra indevido
  - refresh manual da dashboard (`F5`) não gerou erro de console
  - navegação dashboard -> shipment carregou normalmente
- Problemas encontrados:
  - nenhum problema visual/funcional específico da Fase 1
- Sinal adicional:
  - console do browser sem erros durante a passada manual

## H. Próximo passo recomendado
- Iniciar Fase 2 implementando o primeiro detector real no registry explícito.
- Manter findings internos ao Tracking enquanto valida o shape/custo do shipment payload.
- Definir estratégia de lifecycle/histórico sem apagar fatos nem esconder conflitos históricos.

## I. Fechamento da Fase 2
- Data de fechamento: 2026-04-03
- Escopo entregue:
  - detector pluginável real `CONFLICTING_CRITICAL_ACTUALS` adicionado ao registry explícito do Tracking BC
  - drift do contrato interno corrigido para severidade canônica (`ADVISORY | CRITICAL`) e `affectedScope` com `SERIES`
  - agregação container/processo mantida canônica e propagada até DTO/VM/UI sem vazar findings completos
  - UI mínima funcional real ativada em dashboard, shipment header e container-level indicator
  - naming visual final escolhido e aplicado

### I.1 O que foi implementado
- Tracking BC:
  - `conflictingCriticalActuals.detector.ts` criado no slice pluginável e ligado via `domain/detectors/index.ts`
  - regra conservadora: conflita apenas ACTUALs críticos irreconciliáveis nas séries `ARRIVAL | DISCHARGE | DELIVERY | EMPTY_RETURN`
  - um finding por série conflitada, sem apagar facts, sem esconder conflito histórico e sem mexer na primary selection safe-first
- Contrato canônico:
  - `TrackingValidationSeverity` passou a usar `ADVISORY | CRITICAL`
  - `TrackingValidationAffectedScope` passou a incluir `SERIES` no contrato interno
  - `TrackingValidationFinding` passou a carregar `detectorVersion`, `summaryKey`, `evidenceSummary` e `isActive`
  - o registry passou a validar `detectorId` + `detectorVersion`
  - a derivação passou a resumir apenas findings ativos, preservando a lista completa internamente
- Fronteiras:
  - HTTP segue presentation-oriented, mapeando `CRITICAL -> danger` e `ADVISORY -> warning`
  - VM permaneceu leve e sem semântica adicional
  - shipment continuou timeline-first; dashboard continuou usando apenas agregado mínimo
- UI:
  - dashboard mostra o chip real quando o processo contém container com validation issue
  - shipment header mostra o banner agregador acima da timeline
  - selector/lista de containers mostra o chip do container afetado
  - o styling visual do badge/banner/container chip foi centralizado em presenter presentation-only

### I.2 Naming escolhido
- Label final:
  - `Validação necessária`
- Motivo da escolha:
  - foi o melhor equilíbrio entre clareza semântica e compacidade visual nas telas reais
  - diferencia validation issue de alertas operacionais; `Atenção necessária` ficou vago demais e conflitou semanticamente com o universo de alertas
  - evita leitura de backlog/fila implícita; `Validação pendente` parecia “pendência operacional”, não “conflito de leitura atual”
  - os rótulos `Rastreamento requer validação` e `Rastreamento requer atenção` ficaram longos demais para o chip de container/mobile
  - o rótulo escolhido coube sem quebra problemática no banner do shipment e no chip do container em desktop e mobile

### I.3 Arquivos tocados na Fase 2
- Criados:
  - `src/modules/tracking/features/validation/domain/detectors/conflictingCriticalActuals.detector.ts`
  - `src/modules/tracking/features/validation/domain/tests/conflictingCriticalActuals.detector.test.ts`
  - `src/modules/process/ui/components/tracking-review-display.presenter.ts`
  - `src/modules/process/ui/components/tests/tracking-review-display.presenter.test.ts`
- Alterados:
  - `src/modules/tracking/features/validation/domain/detectors/index.ts`
  - `src/modules/tracking/features/validation/domain/model/trackingValidationSeverity.ts`
  - `src/modules/tracking/features/validation/domain/model/trackingValidationAffectedScope.ts`
  - `src/modules/tracking/features/validation/domain/model/trackingValidationFinding.ts`
  - `src/modules/tracking/features/validation/domain/model/trackingValidationDetector.ts`
  - `src/modules/tracking/features/validation/domain/registry/trackingValidationRegistry.ts`
  - `src/modules/tracking/features/validation/domain/services/deriveTrackingValidation.ts`
  - `src/modules/tracking/features/validation/domain/tests/trackingValidation.registry.test.ts`
  - `src/modules/tracking/application/usecases/tests/find-containers-hot-read-projection.usecase.test.ts`
  - `src/modules/process/application/usecases/tests/list-processes-with-operational-summary.usecase.test.ts`
  - `src/modules/process/interface/http/process.http.mappers.ts`
  - `src/modules/process/interface/http/tests/process.http.mappers.test.ts`
  - `src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts`
  - `src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts`
  - `src/modules/process/ui/components/DashboardProcessTable.tsx`
  - `src/modules/process/ui/components/ShipmentHeader.tsx`
  - `src/modules/process/ui/components/ContainerSelector.tsx`
  - `src/locales/pt-BR.json`
  - `docs/plans/TRACKING_VALIDATION_IMPLEMENTATION_LOG.md`

### I.4 Testes criados / ajustados
- Detector e registry:
  - `src/modules/tracking/features/validation/domain/tests/conflictingCriticalActuals.detector.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/trackingValidation.registry.test.ts`
- Agregação:
  - `src/modules/tracking/application/usecases/tests/find-containers-hot-read-projection.usecase.test.ts`
  - `src/modules/process/application/usecases/tests/list-processes-with-operational-summary.usecase.test.ts`
- DTO -> VM:
  - `src/modules/process/interface/http/tests/process.http.mappers.test.ts`
  - `src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts`
  - `src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts`
- UI condicional:
  - `src/modules/process/ui/components/tests/tracking-review-display.presenter.test.ts`

### I.5 QA manual realizado
- Ambiente:
  - app local rodando em `http://localhost:3000`
- Cenário positivo:
  - scenario-lab `discharge_multiple_actual`
  - shipment real: `/shipments/a835deb1-d7f8-4759-a001-d976c4e05a4a`
- Cenário controle:
  - scenario-lab `discharge_basic`
  - shipment real: `/shipments/75616f85-4345-4024-9b03-933b64581b81`
- Validações executadas:
  - dashboard real mostra o processo com chip de validation issue
  - shipment real com issue mostra banner agregador acima da timeline
  - container afetado mostra chip próprio sem poluir a timeline
  - shipment controle não mostra banner/chip de validation issue
  - mobile mantém banner/chip legíveis e sem quebra problemática no label escolhido
  - refresh/prefetch/reconciliação não apresentaram regressão perceptível na passada manual
- Evidências geradas:
  - `/tmp/phase2-dashboard-desktop.png`
  - `/tmp/phase2-dashboard-mobile.png`
  - `/tmp/phase2-shipment-positive-desktop.png`
  - `/tmp/phase2-shipment-positive-mobile.png`
  - `/tmp/phase2-shipment-control-desktop.png`
  - `/tmp/phase2-shipment-control-mobile.png`

### I.6 Problemas encontrados
- O Playwright MCP permitiu parte da inspeção inicial, mas passou a bloquear cliques/navegações locais no meio da validação
- Houve também limitação do headless screenshot fallback para gerar uma matriz automática com os 5 labels em runtime
- Mesmo com a limitação do tooling, a decisão final de naming foi fechada por inspeção manual nas telas reais de dashboard/shipment e pelo ajuste conservador ao espaço disponível em mobile/container chip

### I.7 Checks finais
- `pnpm check` verde em 2026-04-03 após a integração completa da Fase 2

## J. Próximo passo recomendado
- Iniciar a Fase 3 adicionando novos detectores plugináveis sem abrir caminhos paralelos fora do registry
- Definir o próximo incremento de lifecycle/histórico de validation issue mantendo os conflitos históricos visíveis
- Avaliar se a próxima fase precisa expor detalhe adicional no shipment sem inflar o payload nem quebrar a filosofia timeline-first

## K. Kickoff da Fase 3
- Data de início: 2026-04-03
- Fase atual: V1 pluginável / Fase 3
- Estado herdado das Fases 1 e 2:
  - framework pluginável do Tracking BC já está estável, explícito e determinístico
  - detector `CONFLICTING_CRITICAL_ACTUALS` já está ativo via registry, com payload público compacto preservado
  - dashboard, shipment header e container chip já consomem apenas o agregado `tracking_validation`, sem findings brutos
  - naming visual já foi fechado em `Validação necessária`
- Entendimento inicial:
  - a Fase 3 precisa adicionar apenas o detector real `POST_COMPLETION_TRACKING_CONTINUED`
  - o detector deve identificar tracking incompatível após encerramento forte (`DELIVERED` ou `EMPTY_RETURNED`) sem truncar fatos
  - a cadeia pública deve continuar leve; findings completos permanecem internos ao Tracking
  - shipment deve continuar timeline-first e o dashboard deve continuar recebendo só agregados mínimos
- Plano da Fase 3:
  - extrair helper semântico compartilhado no status domain para localizar marcos fortes e reduzir drift com `deriveStatus`
  - implementar `postCompletionTrackingContinued.detector.ts` como plugin isolado no slice `validation`
  - registrar o detector apenas no registry explícito
  - manter DTO/VM/UI sem expansão de payload por padrão
  - adicionar testes unitários do detector e ajustes leves nos testes de agregação/mappers
  - criar cenários de QA no scenario-lab para delivery + novo ciclo e empty return + novo ciclo
  - executar QA manual real, rodar `pnpm check` e fechar com commit único

## L. Fechamento da Fase 3
- Data de fechamento: 2026-04-03
- Escopo entregue:
  - detector pluginável real `POST_COMPLETION_TRACKING_CONTINUED` adicionado ao registry explícito do Tracking BC
  - helper semântico compartilhado extraído para localizar marcos fortes de encerramento sem drift com `deriveStatus`
  - agregação container/processo mantida canônica e propagada até DTO/VM/UI sem inflar o contrato público
  - cenários de QA adicionados ao scenario-lab para validar continuação espúria após `DELIVERED` e `EMPTY_RETURNED`

### L.1 O que foi implementado
- Tracking BC:
  - `postCompletionTrackingContinued.detector.ts` criado no slice pluginável e ligado via `domain/detectors/index.ts`
  - regra conservadora: detecta apenas continuação objetivamente incompatível após encerramento forte
  - findings permanecem internos ao Tracking e continuam resumidos publicamente como agregado compacto
- Status / semântica de encerramento:
  - `strongCompletionMilestone.ts` extraído para consolidar marcos fortes explícitos (`DELIVERY`, `EMPTY_RETURN`) e os fallbacks terminais por `GATE_OUT`
  - `deriveStatus.ts` passou a reutilizar o helper compartilhado para evitar drift semântico entre status final e detector
  - fallback terminal por `GATE_OUT` deixa de se sustentar quando há continuação ACTUAL posterior do lifecycle
- Fronteiras:
  - DTO/VM/UI públicos permaneceram compactos; nenhuma reason/detail extra foi exposta
  - dashboard continua recebendo apenas o resumo mínimo `tracking_validation`
  - shipment continua timeline-first com banner agregador já existente

### L.2 Arquivos tocados na Fase 3
- Criados:
  - `src/modules/tracking/features/status/domain/derive/strongCompletionMilestone.ts`
  - `src/modules/tracking/features/validation/domain/detectors/postCompletionTrackingContinued.detector.ts`
  - `src/modules/tracking/features/validation/domain/tests/postCompletionTrackingContinued.detector.test.ts`
- Alterados:
  - `src/modules/tracking/features/status/domain/derive/deriveStatus.ts`
  - `src/modules/tracking/features/status/domain/tests/deriveStatus.deliveryGateOut.test.ts`
  - `src/modules/tracking/features/status/domain/tests/deriveStatus.emptyGateOut.test.ts`
  - `src/modules/tracking/features/validation/domain/detectors/index.ts`
  - `src/modules/tracking/application/usecases/tests/find-containers-hot-read-projection.usecase.test.ts`
  - `src/modules/process/application/usecases/tests/list-processes-with-operational-summary.usecase.test.ts`
  - `src/modules/process/interface/http/tests/process.http.mappers.test.ts`
  - `src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts`
  - `src/modules/tracking/dev/scenario-lab/scenario.catalog.ts`
  - `docs/plans/TRACKING_VALIDATION_IMPLEMENTATION_LOG.md`

### L.3 Contratos alterados
- Públicos:
  - nenhum shape público adicional foi criado ou inflado
  - `tracking_validation` permaneceu resumido em `has_issues`, `highest_severity`, `affected_container_count` e `finding_count` por container
- Internos:
  - novo helper semântico para strong completion milestones
  - novo detector pluginável `POST_COMPLETION_TRACKING_CONTINUED`
  - evidência interna do finding agora inclui marco forte e primeiro sinal incompatível posterior

### L.4 Testes criados / ajustados
- Detector e helper semântico:
  - `src/modules/tracking/features/validation/domain/tests/postCompletionTrackingContinued.detector.test.ts`
  - `src/modules/tracking/features/status/domain/tests/deriveStatus.deliveryGateOut.test.ts`
  - `src/modules/tracking/features/status/domain/tests/deriveStatus.emptyGateOut.test.ts`
- Agregação:
  - `src/modules/tracking/application/usecases/tests/find-containers-hot-read-projection.usecase.test.ts`
  - `src/modules/process/application/usecases/tests/list-processes-with-operational-summary.usecase.test.ts`
- DTO -> VM:
  - `src/modules/process/interface/http/tests/process.http.mappers.test.ts`
  - `src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts`
- Cobertura mínima validada:
  - `DELIVERED` sem tracking incompatível posterior não dispara
  - `EMPTY_RETURNED` sem tracking incompatível posterior não dispara
  - `DELIVERED` seguido de novo ciclo incompatível dispara
  - `EMPTY_RETURNED` seguido de novo ciclo incompatível dispara
  - continuação legítima `DELIVERED -> EMPTY_RETURN` não dispara
  - dashboard continua recebendo agregado mínimo
  - shipment continua recebendo detalhe suficiente apenas via agregado

### L.5 QA manual realizado
- Ambiente:
  - app local validado em `http://localhost:3000`
  - dev server iniciado com `pnpm run dev -- --host localhost --port 3009` e servido localmente em `3000`
- Rotas verificadas:
  - dashboard `/`
  - shipment positivo delivery `/shipments/a8e002fc-7a49-4b7e-bb56-2f42241834c3`
  - shipment positivo empty return `/shipments/ad24748c-f280-4397-a82a-ad57a87685e8`
  - shipment controle delivery `/shipments/ee70ad6f-5cc6-4a6e-b593-c4998abea659`
  - shipment controle empty return `/shipments/c996f1d2-ac8a-4df1-91f7-d4ad012d3fe4`
  - scenario-lab `/dev/tracking-scenarios`
- Cenários carregados:
  - `delivery_post_completion_continued` step 2
  - `empty_return_post_completion_continued` step 2
  - `delivery_post_completion_continued` step 1 como controle sem issue
  - `empty_return_post_completion_continued` step 1 como controle sem issue
- Viewports verificados:
  - desktop
  - mobile
- Evidências geradas:
  - `phase3-dashboard-desktop.png`
  - `phase3-dashboard-mobile.png`
  - `phase3-shipment-delivery-positive-desktop.png`
  - `phase3-shipment-delivery-positive-mobile.png`
  - `phase3-shipment-delivery-control-desktop.png`
  - `phase3-shipment-empty-return-positive-desktop.png`
  - `phase3-shipment-empty-return-positive-mobile.png`
- Comportamento observado:
  - dashboard positivo mostra o chip `Validação necessária`
  - dashboard controle permanece limpo, sem chip extra
  - shipment positivo mostra banner agregador e chip no container afetado
  - timeline histórica continua visível e mantém leitura timeline-first
  - facts posteriores ao encerramento continuam visíveis; nada é truncado
  - mobile permaneceu legível, sem quebra relevante de layout
  - detector da Fase 2 continuou funcional durante a passada manual

### L.6 Problemas encontrados
- O seed do cenário histórico `delivery_explicit` step 2 falhou em runtime com erro de persistência em `tracking_alerts.autoResolveMany`
- O bloqueio não impactou o escopo da Fase 3 porque os cenários novos do scenario-lab cobriram o caso positivo e o controle necessários para a validação manual

### L.7 Limitações intencionais
- A Fase 3 não introduz corte manual, truncamento automático ou reassociação de processo/container
- O payload público continua compacto e não expõe findings completos nem reason-specific UI
- O banner/copy visual permanece genérico em `Validação necessária`; o motivo específico segue interno ao Tracking BC

### L.8 Próximo passo recomendado para a Fase 4
- Consolidar a severidade `ADVISORY | CRITICAL` como comportamento E2E real, preservando dashboard leve e shipment timeline-first
- Avaliar se o shipment precisa de detalhe compacto adicional de motivo sem expor findings brutos nem abrir payload paralelo

## M. Kickoff da Fase 4
- Data de início: 2026-04-03
- Fase atual: V1 pluginável / Fase 4
- Estado herdado das Fases 1, 2 e 3:
  - framework pluginável do Tracking BC segue explícito, determinístico e centralizado no registry
  - detectores ativos em produção: `CONFLICTING_CRITICAL_ACTUALS` e `POST_COMPLETION_TRACKING_CONTINUED`
  - `tracking_validation` público segue compacto em dashboard e shipment, sem findings brutos
  - naming visual já está fechado em `Validação necessária`
- Entendimento inicial:
  - a severidade interna já existe no domínio (`ADVISORY | CRITICAL`), mas ainda não está exercitada E2E com advisory real no runtime
  - o dashboard ainda não recebe um sinal backend-derived de triagem que considere validation crítica sem empurrar composição para a UI
  - a integração com alertas nesta fase deve permanecer apenas visual/operacional no dashboard; não haverá `TrackingAlert` novo nem lifecycle paralelo
- Plano da Fase 4:
  - expandir o contexto pluginável com sinais derivados owned pelo Tracking validation, populados a partir de projeções canônicas já existentes
  - adicionar um detector pluginável advisory mínimo e conservador para um subconjunto objetivo de `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - manter os detectores críticos atuais intactos e cobertos por regressão
  - preservar o contrato público de `tracking_validation` e acrescentar um único campo leve de triagem backend-derived no payload de processo/dashboard
  - mapear esse novo sinal até VM e usar o campo pronto em row/filter/sort do dashboard, sem composição local na UI
  - reforçar a diferença visual advisory vs critical em banner/chips sem mudar o naming nem poluir a timeline

### M.1 Implementação concluída
- A severidade passou a atravessar a cadeia inteira de forma explícita:
  - detector pluginável
  - finding/sumário agregado
  - projection/read model
  - DTO HTTP
  - mapper UI
  - ViewModel
  - rendering final
- O contexto pluginável recebeu sinais derivados owned pelo Tracking BC via `trackingValidationContext.signals`, sem importar read models de process para o domínio.
- Foi adicionado o detector advisory mínimo `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`, limitado a um subconjunto objetivo de inconsistência canônica de timeline marítima pós-chegada.
- Os detectores críticos herdados (`CONFLICTING_CRITICAL_ACTUALS` e `POST_COMPLETION_TRACKING_CONTINUED`) permaneceram ativos e cobertos por regressão.
- O dashboard passou a receber `attention_severity` como sinal backend-derived leve:
  - `CRITICAL` em validation eleva a triagem visual para `danger`
  - `ADVISORY` não cria destaque agressivo extra
  - `highest_alert_severity` continua separado e preservado
- Shipment/detail manteve o banner agregador e os chips por container, mas agora com distinção visual mais clara entre advisory e critical.

### M.2 Contratos alterados
- Internos Tracking validation:
  - `TrackingValidationContext` agora inclui `signals`
  - novo shape `canonicalTimeline.postCarriageMaritimeEvents`
  - novo detector pluginável `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
- Processo/read model:
  - `ProcessOperationalSummary` agora inclui `attention_severity`
- HTTP:
  - `ProcessResponseSchema` passou a expor `attention_severity`
  - `tracking_validation.highest_severity` continuou compacto em `info | warning | danger | null`
- UI/VM:
  - `ProcessSummaryVM` passou a carregar `attentionSeverity`
  - dashboard consome esse campo pronto em row accent, filter e sort

### M.3 Comportamento final de severidade
- Domínio:
  - `ADVISORY | CRITICAL` seguem canônicos dentro do Tracking BC
- HTTP/UI:
  - domínio `ADVISORY` -> DTO/VM `warning`
  - domínio `CRITICAL` -> DTO/VM `danger`
- Agregação:
  - por container e por processo, a maior severidade vence
  - `ADVISORY` continua visível corretamente mesmo quando é o único tipo presente
  - `CRITICAL` preserva prioridade até a UI
- Dashboard:
  - permanece binário no topo para validation (`tem issue` / `não tem issue`)
  - passa a destacar visualmente `CRITICAL` via `attention_severity`
  - não recebe findings, reasons nem payload extra pesado
- Shipment:
  - continua timeline-first
  - banner/chip usam a severidade já pronta, sem rederivação local

### M.4 Integração com alertas
- Não houve integração com `TrackingAlert` persistido nesta fase.
- Decisão explícita:
  - não criar lifecycle paralelo de ack/resolution para validation issues
  - não duplicar a semântica de alertas operacionais
  - manter a integração apenas como triagem visual backend-derived no dashboard via `attention_severity`

### M.5 Testes criados / ajustados
- Tracking validation:
  - `src/modules/tracking/features/validation/domain/tests/canonicalTimelineClassificationInconsistent.detector.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/trackingValidation.registry.test.ts`
  - regressões mantidas em:
    - `conflictingCriticalActuals.detector.test.ts`
    - `postCompletionTrackingContinued.detector.test.ts`
- Agregação / projeção:
  - `src/modules/tracking/application/usecases/tests/find-containers-hot-read-projection.usecase.test.ts`
  - `src/modules/process/features/operational-projection/application/tests/aggregateOperationalSummary.test.ts`
  - `src/modules/process/application/usecases/tests/list-processes-with-operational-summary.usecase.test.ts`
- DTO -> VM / UI:
  - `src/modules/process/interface/http/tests/process.http.mappers.test.ts`
  - `src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts`
  - `src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts`
  - `src/modules/process/ui/viewmodels/tests/dashboard-filter-interaction.vm.test.ts`
  - `src/modules/process/ui/viewmodels/tests/dashboard-sort-interaction.vm.test.ts`
  - `src/modules/process/ui/components/tests/tracking-review-display.presenter.test.ts`
- Cenários mínimos cobertos:
  - critical preserva severidade até a UI
  - advisory preserva severidade até a UI
  - agregação escolhe highest severity
  - dashboard continua leve
  - shipment/detail reflete melhor a severidade
  - detectores das Fases 2 e 3 continuam funcionando

### M.6 QA manual realizado
- Ambiente:
  - dev server iniciado com `pnpm run dev -- --host localhost --port 3009`
  - runtime local serviu a aplicação em `http://localhost:3002`
- Rotas verificadas:
  - dashboard `/`
  - shipment clean `/shipments/77f8a69a-0684-4395-8bdb-5318a127871f`
  - shipment advisory `/shipments/7a16c9a5-ba0d-4ad3-ba49-9a722fe295ae`
  - shipment critical `/shipments/e7b7c531-7e96-4a61-982b-8e03ee846254`
  - scenario-lab `/dev/tracking-scenarios`
- Cenários usados:
  - `post_carriage_maritime_inconsistent` step 1 como clean
  - `post_carriage_maritime_inconsistent` step 2 como advisory
  - `delivery_post_completion_continued` step 2 como critical
- Viewports verificados:
  - desktop
  - mobile
- Evidências geradas:
  - `phase4-dashboard-desktop.png`
  - `phase4-dashboard-mobile.png`
  - `phase4-shipment-clean-desktop-mcp.png`
  - `phase4-shipment-advisory-desktop-mcp.png`
  - `phase4-shipment-advisory-mobile-mcp.png`
  - `phase4-shipment-critical-desktop-mcp.png`
  - `phase4-shipment-critical-mobile-mcp.png`
  - capturas complementares em `/tmp/phase4-shipment-*.png`
- Comportamento observado:
  - dashboard clean permaneceu sem badge de validation
  - dashboard advisory mostrou `Validação necessária` sem inflar triagem agressiva
  - dashboard critical mostrou `Validação necessária` com destaque coerente via triagem backend-derived
  - shipment advisory exibiu banner/chip em tom warning e preservou a timeline como artefato principal
  - shipment critical exibiu banner/chip em tom danger mais forte e preservou o histórico posterior
  - refresh, prefetch e reconciliation não apresentaram regressão visível na passada manual

### M.7 Problemas encontrados
- O preview da rota dev `tracking-scenarios` precisou ser alinhado ao novo `attentionSeverity` para continuar compatível com `ProcessSummaryVM`.
- O lint falhou ao final da implementação por excesso de linhas em dois blocos de teste; a correção foi estrutural, dividindo os `describe` sem reduzir cobertura.

### M.8 Limitações intencionais e próximo passo
- Limitações intencionais:
  - advisory entrou apenas no subconjunto objetivo necessário para validar a cadeia E2E
  - nenhum finding bruto foi exposto publicamente
  - não houve persistência de validation como alert
- Próximo passo recomendado para a Fase 5:
  - expandir detectores advisory reais sobre inconsistências canônicas adicionais, ainda via registry/plugin system, sem mover semântica para UI nem inflar o dashboard

## N. Kickoff da Fase 5 Hardening
- Data de início: 2026-04-03
- Fase atual: V1 pluginável / Fase 5 hardening
- Estado herdado da branch:
  - o detector `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT` já existe no slice pluginável do Tracking BC
  - o detector já está registrado via registry explícito, com cenário `post_carriage_maritime_inconsistent`, testes unitários e propagação E2E até DTO/VM/UI
  - `pnpm check` já estava verde antes desta continuação
- Drift identificado:
  - os planos plugináveis ainda descrevem a Fase 5 como se fosse a primeira introdução desse detector
  - o código e o log da Fase 4 mostram que o advisory mínimo já entrou na branch antes desta etapa
  - a rota dev `tracking-scenarios` ainda recomputa `attentionSeverity` localmente para o preview de dashboard, criando um caminho presentation-only fora do dado backend-derived
- Entendimento inicial:
  - esta continuação deve ser tratada como hardening/alinhamento, não como greenfield
  - o recorte mínimo do detector deve permanecer objetivo: apenas contexto marítimo forte dentro de `post-carriage` no read model canônico
  - shipment deve continuar timeline-first e o dashboard deve continuar leve
- Plano desta continuação:
  - auditar detector e sinais derivados para confirmar que a inconsistência nasce antes da UI
  - remover a composição paralela residual no preview dev e voltar a consumir a severidade backend-derived do dashboard
  - reforçar teste negativo para provar que contexto marítimo normal dentro da perna canônica não vira advisory
  - atualizar o log com o drift encontrado, o hardening aplicado, QA manual e próximo passo da Fase 6

## O. Fechamento da Fase 5 Hardening
- Data de fechamento: 2026-04-03
- Escopo entregue:
  - hardening do trilho pluginável já existente para `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - remoção do único caminho paralelo residual identificado fora da cadeia backend-derived
  - reforço de regressão para blindar o recorte mínimo do detector

### O.1 O que foi implementado
- Preview dev / dashboard:
  - a rota `src/routes/dev/tracking-scenarios.tsx` deixou de montar um `ProcessSummaryVM` derivado do shipment detail
  - o preview de dashboard passou a consumir diretamente `fetchDashboardProcessSummaries()`, preservando `attentionSeverity` e `trackingValidation` como dados backend-derived
  - com isso, o cenário de laboratório parou de recompor severidade localmente a partir de alertas + validation
- Detector / recorte mínimo:
  - o detector `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT` e o sinal `canonicalTimeline.postCarriageMaritimeEvents` foram auditados
  - o recorte mínimo foi mantido sem expansão:
    - contexto marítimo objetivo em bloco terminal `post-carriage`
    - severidade `ADVISORY`
    - scope `TIMELINE`
  - nenhuma nova heurística frouxa foi adicionada
- Boundaries:
  - tracking continua dono exclusivo da semântica de validation
  - HTTP continuou expondo apenas `tracking_validation` compacto e `attention_severity`
  - UI continuou consumindo somente `Response DTO -> ViewModel`, sem findings brutos nem nova derivação local

### O.2 Arquivos tocados nesta continuação
- Alterados:
  - `src/routes/dev/tracking-scenarios.tsx`
  - `src/modules/tracking/application/usecases/tests/find-containers-hot-read-projection.usecase.test.ts`
  - `docs/plans/TRACKING_VALIDATION_IMPLEMENTATION_LOG.md`

### O.3 Contratos alterados
- Públicos:
  - nenhum contrato público mudou
  - nenhum campo novo foi adicionado ao dashboard ou shipment
- Internos:
  - nenhum contrato interno canônico mudou
  - o hardening foi comportamental, removendo recomposição local no preview dev

### O.4 Testes criados / ajustados
- Reforço de regressão:
  - `src/modules/tracking/application/usecases/tests/find-containers-hot-read-projection.usecase.test.ts`
- Cenário adicional coberto:
  - contexto marítimo normal dentro da perna canônica não dispara advisory
- Baseline revalidado:
  - detector advisory segue positivo apenas no caso objetivo de `post-carriage`
  - agregação container/processo continua preservando `ADVISORY`
  - DTO -> VM e presenter continuam compactos e presentation-only
  - detectores `CONFLICTING_CRITICAL_ACTUALS` e `POST_COMPLETION_TRACKING_CONTINUED` seguem verdes

### O.5 QA manual realizado
- Ambiente:
  - dev server iniciado com `pnpm run dev -- --host localhost --port 3009`
  - runtime local serviu a aplicação em `http://localhost:3003`
- Rotas verificadas:
  - scenario-lab `/dev/tracking-scenarios`
- Cenários usados:
  - `post_carriage_maritime_inconsistent` step 1 como clean
  - `post_carriage_maritime_inconsistent` step 2 como advisory
  - `delivery_post_completion_continued` step 2 como critical
- Superfícies validadas:
  - `Dashboard Row Preview` com `DashboardProcessTable` alimentado por `fetchDashboardProcessSummaries()`
  - `Shipment Preview` com `ShipmentDataView` alimentado por `fetchProcess()`
- Viewports verificados:
  - desktop `1440x900`
  - mobile `393x851`
- Evidências geradas:
  - `phase5-hardening-clean-desktop.png`
  - `phase5-hardening-advisory-desktop.png`
  - `phase5-hardening-critical-desktop.png`
  - `phase5-hardening-advisory-mobile.png`
  - `phase5-hardening-critical-mobile.png`
- Comportamento observado:
  - clean: o preview de dashboard permaneceu sem badge de validation e o shipment preview não exibiu banner/chip de validation
  - advisory: o preview de dashboard exibiu `Validação necessária` sem escalada agressiva de triagem, e o shipment preview mostrou banner agregador + chip por container com leitura timeline-first preservada
  - critical: o preview de dashboard exibiu `Validação necessária` com destaque coerente de severidade e o shipment preview mostrou banner/chip em tom mais forte sem esconder fatos
  - a troca entre cenários e steps atualizou corretamente o preview de dashboard a partir do payload backend-derived, sem recomposição local visível de `attentionSeverity`
  - nenhuma quebra relevante de layout foi observada em desktop ou mobile
  - console do browser sem erros durante a passada manual

### O.6 Problemas encontrados
- O problema arquitetural concreto desta continuação foi o drift entre planos/log e estado real da branch.
- O único desvio de implementação encontrado no código ativo foi a recomposição local de `attentionSeverity` no preview dev.

### O.7 Limitações intencionais
- O detector advisory não foi ampliado além do subconjunto mínimo já fechado.
- Não houve mudança de `affectedScope` para `TIMELINE_BLOCK`.
- Não houve integração de validation issue com `TrackingAlert` persistido.

### O.8 Próximo passo recomendado para a Fase 6
- Iniciar a fase seguinte real do trilho pluginável sem reabrir o advisory já consolidado.
- Priorizar evolução em cima de observabilidade/histórico operacional ou do próximo detector ainda não implementado, sempre preservando o registry/plugin system como único caminho canônico.

## P. Kickoff da Fase 6
- Data de início: 2026-04-03
- Fase atual: V1 pluginável / Fase 6 lifecycle operacional por transição
- Estado herdado das fases anteriores:
  - o framework pluginável de validation já estava estabelecido dentro do Tracking BC
  - os detectores ativos eram:
    - `CONFLICTING_CRITICAL_ACTUALS`
    - `POST_COMPLETION_TRACKING_CONTINUED`
    - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - `severity` já atravessava a cadeia como semântica canônica no domínio (`ADVISORY | CRITICAL`) e como compactação DTO/VM na UI (`warning | danger`)
  - dashboard já permanecia leve com `tracking_validation` compacto e `attention_severity`
  - shipment já permanecia timeline-first, sem findings brutos nem heurística local
- Entendimento consolidado:
  - a Fase 6 precisava persistir apenas transições `activated | changed | resolved`
  - esse dado teria natureza operacional/auxiliar, não truth canônica
  - a fonte de verdade continuaria sendo `snapshot -> observations -> timeline/status/alerts/validation derivada`
  - a persistência deveria ser econômica, baseada em transição, sem snapshot completo por sync
- Riscos arquiteturais identificados antes de codar:
  - deixar a identidade de issue fora do plugin system
  - mover semântica de lifecycle para UI/capability
  - inflar o banco com payloads ou estado redundante por sync
  - acoplar a persistência operacional ao shape público de shipment/dashboard
- Plano fechado para a fase:
  - tornar `lifecycleKey` e `stateFingerprint` obrigatórios no finding pluginável
  - atualizar os detectores ativos para produzirem identidade operacional própria
  - criar serviço de derivação de transições `activated | changed | resolved`
  - criar tabela/repositório operacional leve para transições
  - integrar a persistência ao pipeline canônico sem alterar `PipelineResult`, DTOs ou VMs públicos
  - estender o scenario-lab com reuse incremental no mesmo processo/container para QA real da sequência `activated -> changed -> resolved`

## Q. Fechamento da Fase 6
- Data de fechamento: 2026-04-03
- Escopo entregue:
  - lifecycle operacional por transição para tracking validation issues
  - persistência `activated | changed | resolved` sem snapshot completo por sync
  - identidade operacional detector-owned dentro do sistema pluginável
  - harness dev-only para reaplicar steps no mesmo processo/container

### Q.1 O que foi implementado
- Contrato pluginável:
  - `TrackingValidationFinding` agora exige `lifecycleKey` e `stateFingerprint`
  - o registry passou a validar explicitamente que esses campos existem e não estão vazios
- Detectores ativos:
  - `CONFLICTING_CRITICAL_ACTUALS` passou a emitir `lifecycleKey` estável por série e fingerprint derivado dos ACTUAL fingerprints conflitantes
  - `POST_COMPLETION_TRACKING_CONTINUED` passou a emitir `lifecycleKey` estável por container e fingerprint do marco forte + continuação incompatível
  - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT` passou a emitir `lifecycleKey` estável por container e fingerprint do conjunto relevante de sinais marítimos
- Domínio / serviço:
  - criado `deriveTrackingValidationLifecycleTransitions()`
  - regras:
    - finding novo -> `activated`
    - finding com mesmo `lifecycleKey` mas `stateFingerprint` diferente -> `changed`
    - state ativo persistido sem finding atual correspondente -> `resolved`
    - state inalterado -> nada persiste
- Persistência operacional:
  - criado o port `TrackingValidationLifecycleRepository`
  - criada a migration `20260403_01_tracking_validation_issue_lifecycle_transitions.sql`
  - criada a tabela operacional `tracking_validation_issue_transitions`
  - criada a infra `supabaseTrackingValidationLifecycleRepository`
  - a persistência grava somente:
    - `process_id`
    - `container_id`
    - `issue_code`
    - `detector_id`
    - `detector_version`
    - `affected_scope`
    - `severity`
    - `transition_type`
    - `lifecycle_key`
    - `state_fingerprint`
    - `evidence_summary`
    - `provider`
    - `snapshot_id`
    - `occurred_at`
  - lookup de `process_id` permanece na infra, via `containers`, sem puxar semântica de Process BC para o domínio de tracking validation
  - foi criado índice de dedupe por `(container_id, lifecycle_key, transition_type, state_fingerprint, snapshot_id)`
- Pipeline:
  - `processSnapshot()` agora:
    - deriva validation pelo caminho pluginável já existente
    - lê active states persistidos
    - deriva transições
    - persiste apenas transições novas/relevantes
  - `PipelineResult` continuou inalterado
  - shipment/dashboard continuaram consumindo apenas summaries/read models já existentes
- Scenario-lab:
  - `ScenarioLoadCommand` ganhou `reuseProcessId`
  - `ScenarioBuildResult` agora carrega `containerNumbersByKey`
  - o seeder passou a suportar reuso do mesmo processo/container quando solicitado
  - a rota `/api/dev/scenarios/load` expõe `reuse_process_id`
  - a UI `tracking-scenarios` passou a reutilizar automaticamente o processo atual ao avançar steps do mesmo cenário
  - o cenário `post_carriage_maritime_inconsistent` foi expandido para:
    - step 1: clean
    - step 2: advisory activated
    - step 3: advisory changed
    - step 4: advisory resolved via reclassificação canônica do trecho

### Q.2 Estrutura persistida criada
- Tabela:
  - `public.tracking_validation_issue_transitions`
- Natureza:
  - operacional
  - append-only por transição relevante
  - sem snapshot completo por sync
  - sem payload bruto
  - sem findings completos serializados
- Leituras suportadas:
  - active states por `container_id`
  - histórico por `container_id`
  - histórico por `process_id`
  - reconstrução futura por `lifecycle_key`

### Q.3 Decisões de retenção / volume
- Mantido o princípio da V1:
  - persistir transição, não snapshot completo
- Não foi implementado pruning nesta fase.
- A contenção de volume veio de:
  - dedupe por batch
  - dedupe por índice único operacional
  - `stateFingerprint` detector-owned
  - `evidence_summary` string leve, sem metadata pesada nem payload de snapshot

### Q.4 Testes criados / ajustados
- Domínio:
  - `src/modules/tracking/features/validation/domain/tests/deriveTrackingValidationLifecycleTransitions.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/trackingValidation.registry.test.ts`
- Infra:
  - `src/modules/tracking/infrastructure/persistence/tests/tracking.validation-lifecycle.persistence.mappers.test.ts`
- Pipeline / integração:
  - `src/modules/tracking/application/tests/pipeline.validation-lifecycle.integration.test.ts`
  - revalidação de:
    - `src/modules/tracking/application/tests/pipeline.integration.test.ts`
    - `src/modules/tracking/application/tests/pipeline.alert-idempotency.integration.test.ts`
- Scenario-lab:
  - `src/modules/tracking/dev/scenario-lab/tests/scenario.seed.test.ts`
- Coberturas mínimas exigidas nesta fase:
  - `activated`
  - `changed`
  - `resolved`
  - dedupe de transições redundantes
  - persistência com contexto mínimo útil
  - ausência de snapshot completo por sync no contrato persistido
  - integração com detectores já existentes

### Q.5 QA manual realizado
- Ambiente:
  - dev server iniciado com `pnpm run dev -- --host localhost --port 3009`
  - runtime local serviu a aplicação em `http://localhost:3003`
- QA backend funcional:
  - fluxo incremental `activated -> changed -> resolved` validado no pipeline por integração local com repositório lifecycle in-memory e cenário real `post_carriage_maritime_inconsistent`
  - dedupe de `activated` reprocessado validado com `discharge_multiple_actual`
- QA visual/manual da app:
  - dashboard `/`
  - shipment `/shipments/9adec171-a71e-43a5-9b81-4aef5df91a84`
  - inspeção manual adicional da resposta `/api/processes` no browser para confirmar rows existentes de scenarios lab
- Viewports verificados:
  - desktop
  - mobile
- Evidências geradas:
  - `/tmp/phase6-dashboard.png`
  - `/tmp/phase6-dashboard-mobile.png`
  - `/tmp/phase6-shipment.png`
  - `/tmp/phase6-shipment-mobile.png`
- Comportamento observado:
  - dashboard continuou leve e íntegro
  - shipment continuou timeline-first
  - `tracking_validation` continuou chegando compacto nas projeções existentes
  - nenhum finding bruto ou detalhe de lifecycle vazou para as telas
  - os cenários já existentes de advisory/critical continuaram renderizando consistentemente

### Q.6 Problemas encontrados
- O tooling Supabase disponível nesta sessão está em modo read-only para DDL.
- Consequência objetiva:
  - não foi possível aplicar a migration remota via MCP
  - a tabela `tracking_validation_issue_transitions` não existe ainda no banco remoto desta sessão
  - o runtime local registrou falha operacional ao tentar processar writes reais contra essa tabela ausente
- Tratamento adotado:
  - a migration foi criada no repositório
  - `database.types.ts` foi atualizado
  - a lógica foi validada por testes de integração locais
  - a limitação foi registrada explicitamente aqui, sem mascarar a ausência do schema remoto

### Q.7 Limitações intencionais
- Nenhuma UI pública nova foi criada para lifecycle.
- Nenhuma observabilidade externa (Sentry/email/etc.) foi adicionada.
- Nenhuma truth canônica nova foi criada.
- Nenhum snapshot completo de validation por sync foi persistido.

### Q.8 Próximo passo recomendado para a Fase 7
- Expor leitura operacional controlada do lifecycle persistido, ainda dentro do Tracking BC, para suportar:
  - duração de issues
  - incidência por provider/detector
  - comparação antes/depois de correções
- Fazer isso sem:
  - mover semântica para UI
  - transformar lifecycle em source of truth
  - inflar dashboard ou quebrar shipment timeline-first

## R. Kickoff da Fase 7
- Data de início: 2026-04-04
- Fase atual: V1 pluginável / Fase 7 time travel, refresh, realtime e payload refinement
- Estado herdado das fases anteriores:
  - o framework pluginável continua centralizado no Tracking BC e o registry permanece explícito
  - os detectores ativos seguem:
    - `CONFLICTING_CRITICAL_ACTUALS`
    - `POST_COMPLETION_TRACKING_CONTINUED`
    - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - o payload público atual permanece compacto:
    - dashboard com agregado mínimo
    - shipment current com resumo por processo/container
  - a Fase 6 já persiste lifecycle operacional por transição sem snapshot completo por sync
- Entendimento inicial:
  - a UI histórica por snapshot precisa refletir `tracking_validation` derivado do checkpoint selecionado, não o resumo atual do shipment
  - o lifecycle persistido continua operacional/observável, mas não deve governar o render histórico principal
  - a integração desta fase deve acontecer no replay/time-travel read model, preservando dashboard leve e shipment timeline-first
- Auditoria consolidada antes de codar:
  - o gap principal identificado está no trilho de time travel:
    - timeline/status/alerts históricos já trocam por snapshot
    - banner de validation e chip do selector ainda dependem do `ShipmentDetailVM` atual
  - o endpoint lazy de time travel ainda não expõe `tracking_validation` por checkpoint
  - o controller de time travel ainda não depende do `trackingFreshnessToken`, então pode ficar defasado após refresh/reconciliation/realtime
- Plano fechado para a fase:
  - consolidar helper tracking-owned para derivação compacta de validation a partir de um estado já reconstruído
  - reutilizar esse helper no hot-read atual e no replay histórico
  - estender `TrackingTimeTravelCheckpoint` e o DTO HTTP com `tracking_validation` compacto
  - mapear esse resumo até `TrackingTimeTravelSyncVM`
  - ajustar a composição do shipment em modo histórico para:
    - usar banner do container/snapshot selecionado
    - sobrescrever apenas o chip do container selecionado no selector
    - não inventar agregado histórico do processo inteiro
  - fazer o resource de time travel refetchar quando o `trackingFreshnessToken` mudar

## S. Fechamento da Fase 7
- Data de fechamento: 2026-04-04
- Escopo entregue:
  - `tracking_validation` passou a ser derivado por checkpoint no replay/time travel, sem snapshot completo persistido por sync
  - shipment histórico passou a consumir VM histórico pronto, sem heurística local de UI
  - time travel passou a refetchar com mudanças de `trackingFreshnessToken`
  - dashboard permaneceu com payload mínimo
  - lifecycle persistido continuou como apoio operacional, não como source of truth histórica

### S.1 O que foi implementado
- Tracking BC:
  - `trackingValidation.projection.ts` passou a expor derivação compacta a partir de estado já reconstruído
  - `tracking.hot-read.projections.ts` foi alinhado a esse helper para manter paridade entre presente e replay
  - `tracking-time-travel.readmodel.ts` passou a incluir `trackingValidation` compacto em cada checkpoint
  - o replay histórico continua derivando a partir de:
    - observations
    - timeline
    - status
    - transshipment
    - `effectiveNow`
- HTTP / DTO / VM:
  - `tracking.schemas.ts` e `tracking.http.mappers.ts` passaram a expor `tracking_validation` por checkpoint apenas com:
    - `has_issues`
    - `highest_severity`
    - `finding_count`
  - `tracking-time-travel.ui-mapper.ts` e `tracking-time-travel.vm.ts` passaram a carregar esse resumo até `TrackingTimeTravelSyncVM`
- UI / shipment:
  - o modo histórico do shipment passou a usar banner do container/snapshot selecionado
  - o chip do selector/container passou a refletir o sync selecionado apenas no container ativo
  - o modo atual continua usando o resumo do `ShipmentDetailVM`
- Refresh / realtime:
  - `useTrackingTimeTravelController` agora usa chave com `trackingFreshnessToken`
  - o resource lazy de time travel refaz a leitura quando o shipment atual é reconciliado/refrescado

### S.2 Como ficou a reconstrução por sync
- A visão histórica agora vem do replay por sync no Tracking BC.
- O endpoint lazy de time travel carrega só o resumo compacto de validation por checkpoint.
- Não foi criado snapshot completo de validation por sync.
- A paridade entre presente e histórico passou a depender do mesmo caminho canônico de derivação pluginável.

### S.3 Como o lifecycle persistido está sendo usado
- Continua sendo operacional/observável:
  - `activated`
  - `changed`
  - `resolved`
- Não governa o render histórico do shipment.
- Não substitui a derivação do replay por sync.
- Nesta fase o pipeline ficou resiliente a indisponibilidade do repositório/tabela de lifecycle:
  - falha operacional é logada
  - derivação canônica de timeline/status/alerts/validation continua
  - a UI histórica não fica bloqueada por ausência da tabela operacional

### S.4 Ajustes de payload / VM
- Dashboard:
  - payload mantido mínimo
  - confirmado sem `findings`, `lifecycle` ou detalhe histórico embutido
- Shipment current:
  - payload atual mantido
  - sem inflação por dados de replay
- Time travel:
  - checkpoint ganhou só resumo compacto de validation
  - nenhuma evidência detalhada, transitions ou debug de validation foi exposta

### S.5 Testes criados / ajustados
- Replay / time travel:
  - `src/modules/tracking/features/replay/application/tests/tracking-time-travel.readmodel.test.ts`
  - `src/modules/tracking/features/replay/application/tests/get-tracking-time-travel.usecase.test.ts`
  - `src/modules/tracking/interface/http/tests/tracking.controllers.test.ts`
- Pipeline / resiliência operacional:
  - `src/modules/tracking/application/tests/pipeline.validation-lifecycle.integration.test.ts`
- UI / composição histórica:
  - `src/modules/process/ui/mappers/tests/tracking-time-travel.ui-mapper.test.ts`
  - `src/modules/process/ui/screens/shipment/lib/shipmentTrackingReviewDisplay.test.ts`
  - `src/modules/process/ui/screens/shipment/lib/tracking-time-travel.resource-key.test.ts`
  - `src/modules/process/ui/screens/shipment/lib/tracking-time-travel.selection.service.test.ts`
  - `src/modules/process/ui/screens/shipment/hooks/useShipmentScreenResource.test.ts`

### S.6 QA manual realizado
- Ambiente:
  - app local rodando em `http://localhost:3000`
- Cenário advisory:
  - `post_carriage_maritime_inconsistent`
  - validação feita em:
    - preview step 2
    - shipment real step 2
    - shipment real step 4 com navegação `sync 1/4 -> 4/4`
  - resultado observado:
    - current step 4 limpo
    - sync 2/4 e 3/4 com `Validação necessária`
    - sync 1/4 e 4/4 sem banner/chip histórico
- Cenário critical:
  - `delivery_post_completion_continued`
  - validação feita em:
    - preview step 2
    - shipment real current
    - shipment real time travel `sync 1/2 -> 2/2`
  - resultado observado:
    - current com banner/chip críticos
    - sync 1/2 limpo
    - sync 2/2 com banner histórico crítico
- Dashboard:
  - rota `/` validada em desktop e mobile
  - row com chip de validation exibida corretamente
  - `fetch('/api/processes')` conferido no browser:
    - `tracking_validation` contém só agregado mínimo
    - sem `findings`
    - sem `lifecycle`
- Coerência dinâmica:
  - shipment com time travel aberto foi revalidado após avanço do mesmo processo via Scenario Lab (`reuse_process_id`)
  - o resource histórico passou a refletir novos syncs após mudança do `trackingFreshnessToken`
- Evidências:
  - `phase7-dashboard-desktop.png`
  - `phase7-dashboard-mobile.png`
  - `phase7-shipment-advisory-historical-desktop.png`
  - `phase7-shipment-critical-mobile.png`

### S.7 Problemas encontrados
- O ambiente local usado no QA não tinha a tabela operacional `tracking_validation_issue_transitions` disponível no banco remoto da sessão.
- Sem resiliência, isso quebrava o Scenario Lab e o runtime local com `500`.
- Tratamento aplicado nesta fase:
  - a falha do lifecycle operacional passou a degradar graciosamente no pipeline
  - a derivação canônica seguiu funcionando
  - o problema operacional continua explícito via log
- Durante a retomada pós-crash, o dev server também revelou uma incompatibilidade de parser com um type annotation intermediário; o contrato foi simplificado e alinhado com runtime + build.

### S.8 Limitações intencionais
- Não foi criada leitura pública de lifecycle operacional.
- Não foi adicionada observabilidade externa nova.
- Não foi criado snapshot completo por sync.
- Não foi movida nenhuma semântica de validation para UI.
- O dashboard continua sem detalhe histórico de validation por design.

### S.9 Próximo passo recomendado para a Fase 8
- Fechar a camada de leitura operacional do lifecycle persistido dentro do Tracking BC para:
  - duração de issues
  - incidência por detector/provider
  - debugging operacional interno
- Fazer isso mantendo:
  - replay por sync como fonte histórica da UI
  - dashboard leve
  - shipment timeline-first
