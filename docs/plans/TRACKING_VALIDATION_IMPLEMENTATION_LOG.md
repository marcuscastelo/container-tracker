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
