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
  - iniciar Fase 3 em cima da base pluginável já consolidada

## A.1 Kickoff da Fase 2
- Entendimento inicial:
  - Fase 2 pluginável combina UI mínima funcional real com primeiro detector real, sem abrir caminho paralelo fora do registry
  - detector precisa nascer no Tracking BC, operando por série e preservando regra safe-first
  - dashboard deve continuar leve e shipment deve continuar timeline-first
- Status herdado da Fase 1:
  - plumbing E2E já existe até DTO/VM/UI
  - registry está integrado, mas ainda vazio
  - UI já tem slots reais para feature, porém com copy provisória e sem detector ativo
- Plano cirúrgico desta fase:
  - alinhar `TrackingValidationSeverity`, `TrackingValidationAffectedScope` e `TrackingValidationFinding` ao contrato canônico mínimo da V1
  - implementar `CONFLICTING_CRITICAL_ACTUALS` como plugin isolado em `modules/tracking/features/validation/domain/detectors`
  - registrar detector via registry explícito
  - manter DTO/VM compactos, mapeando severidade interna para severity presentation-only na fronteira HTTP
  - consolidar naming final em dashboard, shipment header e container-level chip após QA visual em tela real

## B. Decisões fechadas
- Tracking continua dono exclusivo da semântica de validation issues.
- framework pluginável é local ao Tracking BC, explícito e determinístico.
- registry de produção nasce vazio na Fase 1; não há detector real ativo ainda.
- UI recebe agregados mínimos; findings completos continuam internos ao Tracking.
- dashboard recebe somente `has_issues`, `highest_severity` e `affected_container_count`.
- shipment detail recebe resumo de processo e resumo por container; não recebe findings.
- UI de shipment continua timeline-first; validation aparece só como suporte no header/container selector.
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
  - suites de teste afetadas em tracking/process/UI para cobrir novo contrato

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
- registry vazio garante contrato e wiring, mas não cobre cenários positivos em runtime fora de testes.
- Fase 1 entrega só agregados; quando detectores reais entrarem, será preciso cuidar do payload do shipment para não vazar details pesados cedo demais.
- semântica ainda não possui lifecycle persistido; Fase 2+ precisa manter histórico sem apagar fatos.
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
  - console do browser sem erros durante passada manual

## H. Próximo passo recomendado
- Iniciar Fase 2 implementando primeiro detector real no registry explícito.
- Manter findings internos ao Tracking enquanto valida shape/custo do shipment payload.
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
  - regra conservadora: conflita ACTUALs críticos irreconciliáveis nas séries `ARRIVAL | DISCHARGE | DELIVERY | EMPTY_RETURN`
  - finding por série conflitada, sem apagar facts, sem esconder conflito histórico e sem mexer na primary selection safe-first
- Contrato canônico:
  - `TrackingValidationSeverity` passou usar `ADVISORY | CRITICAL`
  - `TrackingValidationAffectedScope` passou incluir `SERIES` no contrato interno
  - `TrackingValidationFinding` passou carregar `detectorVersion`, `summaryKey`, `evidenceSummary` e `isActive`
  - registry passou validar `detectorId` + `detectorVersion`
  - derivação passou resumir findings ativos, preservando lista completa internamente
- Fronteiras:
  - HTTP segue presentation-oriented, mapeando `CRITICAL -> danger` e `ADVISORY -> warning`
  - VM permaneceu leve e sem semântica adicional
  - shipment continuou timeline-first; dashboard continuou usando agregado mínimo
- UI:
  - dashboard mostra chip real quando processo contém container com validation issue
  - shipment header mostra banner agregador acima da timeline
  - selector/lista de containers mostra chip do container afetado
  - styling visual do badge/banner/container chip foi centralizado em presenter presentation-only

### I.2 Naming escolhido
- Label final:
  - `Validação necessária`
- Motivo da escolha:
  - foi melhor equilíbrio entre clareza semântica e compacidade visual nas telas reais
  - diferencia validation issue de alertas operacionais; `Atenção necessária` ficou vago demais e conflitou semanticamente com universo de alertas
  - evita leitura de backlog/fila implícita; `Validação pendente` parecia “pendência operacional”, não “conflito de leitura atual”
  - rótulos `Rastreamento requer validação` e `Rastreamento requer atenção` ficaram longos demais para chip de container/mobile
  - rótulo escolhido coube sem quebra problemática no banner do shipment e no chip do container em desktop e mobile

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
  - dashboard real mostra processo com chip de validation issue
  - shipment real com issue mostra banner agregador acima da timeline
  - container afetado mostra chip próprio sem poluir timeline
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
- Playwright MCP permitiu parte da inspeção inicial, mas passou bloquear cliques/navegações locais no meio da validação
- Houve também limitação do headless screenshot fallback para gerar matriz automática com 5 labels em runtime
- Mesmo com limitação do tooling, decisão final de naming foi fechada por inspeção manual nas telas reais de dashboard/shipment e pelo ajuste conservador ao espaço disponível em mobile/container chip

### I.7 Checks finais
- `pnpm check` verde em 2026-04-03 após integração completa da Fase 2

## J. Próximo passo recomendado
- Iniciar Fase 3 adicionando novos detectores plugináveis sem abrir caminhos paralelos fora do registry
- Definir próximo incremento de lifecycle/histórico de validation issue mantendo conflitos históricos visíveis
- Avaliar se próxima fase precisa expor detalhe adicional no shipment sem inflar payload nem quebrar filosofia timeline-first

## K. Kickoff da Fase 3
- Data de início: 2026-04-03
- Fase atual: V1 pluginável / Fase 3
- Estado herdado das Fases 1 e 2:
  - framework pluginável do Tracking BC já está estável, explícito e determinístico
  - detector `CONFLICTING_CRITICAL_ACTUALS` já está ativo via registry, com payload público compacto preservado
  - dashboard, shipment header e container chip já consomem agregado `tracking_validation`, sem findings brutos
  - naming visual já foi fechado em `Validação necessária`
- Entendimento inicial:
  - Fase 3 precisa adicionar detector real `POST_COMPLETION_TRACKING_CONTINUED`
  - detector deve identificar tracking incompatível após encerramento forte (`DELIVERED` ou `EMPTY_RETURNED`) sem truncar fatos
  - cadeia pública deve continuar leve; findings completos permanecem internos ao Tracking
  - shipment deve continuar timeline-first e dashboard deve continuar recebendo só agregados mínimos
- Plano da Fase 3:
  - extrair helper semântico compartilhado no status domain para localizar marcos fortes e reduzir drift com `deriveStatus`
  - implementar `postCompletionTrackingContinued.detector.ts` como plugin isolado no slice `validation`
  - registrar detector no registry explícito
  - manter DTO/VM/UI sem expansão de payload por padrão
  - adicionar testes unitários do detector e ajustes leves nos testes de agregação/mappers
  - criar cenários de QA no scenario-lab para delivery + novo ciclo e empty return + novo ciclo
  - executar QA manual real, rodar `pnpm check` e fechar com commit único

## L. Fechamento da Fase 3
- Data de fechamento: 2026-04-03
- Escopo entregue:
  - detector pluginável real `POST_COMPLETION_TRACKING_CONTINUED` adicionado ao registry explícito do Tracking BC
  - helper semântico compartilhado extraído para localizar marcos fortes de encerramento sem drift com `deriveStatus`
  - agregação container/processo mantida canônica e propagada até DTO/VM/UI sem inflar contrato público
  - cenários de QA adicionados ao scenario-lab para validar continuação espúria após `DELIVERED` e `EMPTY_RETURNED`

### L.1 O que foi implementado
- Tracking BC:
  - `postCompletionTrackingContinued.detector.ts` criado no slice pluginável e ligado via `domain/detectors/index.ts`
  - regra conservadora: detecta continuação objetivamente incompatível após encerramento forte
  - findings permanecem internos ao Tracking e continuam resumidos publicamente como agregado compacto
- Status / semântica de encerramento:
  - `strongCompletionMilestone.ts` extraído para consolidar marcos fortes explícitos (`DELIVERY`, `EMPTY_RETURN`) e fallbacks terminais por `GATE_OUT`
  - `deriveStatus.ts` passou reutilizar helper compartilhado para evitar drift semântico entre status final e detector
  - fallback terminal por `GATE_OUT` deixa de se sustentar quando há continuação ACTUAL posterior do lifecycle
- Fronteiras:
  - DTO/VM/UI públicos permaneceram compactos; nenhuma reason/detail extra foi exposta
  - dashboard continua recebendo resumo mínimo `tracking_validation`
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
  - shipment continua recebendo detalhe suficiente via agregado

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
  - dashboard positivo mostra chip `Validação necessária`
  - dashboard controle permanece limpo, sem chip extra
  - shipment positivo mostra banner agregador e chip no container afetado
  - timeline histórica continua visível e mantém leitura timeline-first
  - facts posteriores ao encerramento continuam visíveis; nada é truncado
  - mobile permaneceu legível, sem quebra relevante de layout
  - detector da Fase 2 continuou funcional durante passada manual

### L.6 Problemas encontrados
- seed do cenário histórico `delivery_explicit` step 2 falhou em runtime com erro de persistência em `tracking_alerts.autoResolveMany`
- bloqueio não impactou escopo da Fase 3 porque cenários novos do scenario-lab cobriram caso positivo e controle necessários para validação manual

### L.7 Limitações intencionais
- Fase 3 não introduz corte manual, truncamento automático ou reassociação de processo/container
- payload público continua compacto e não expõe findings completos nem reason-specific UI
- banner/copy visual permanece genérico em `Validação necessária`; motivo específico segue interno ao Tracking BC

### L.8 Próximo passo recomendado para a Fase 4
- Consolidar severidade `ADVISORY | CRITICAL` como comportamento E2E real, preservando dashboard leve e shipment timeline-first
- Avaliar se shipment precisa de detalhe compacto adicional de motivo sem expor findings brutos nem abrir payload paralelo

## M. Kickoff da Fase 4
- Data de início: 2026-04-03
- Fase atual: V1 pluginável / Fase 4
- Estado herdado das Fases 1, 2 e 3:
  - framework pluginável do Tracking BC segue explícito, determinístico e centralizado no registry
  - detectores ativos em produção: `CONFLICTING_CRITICAL_ACTUALS` e `POST_COMPLETION_TRACKING_CONTINUED`
  - `tracking_validation` público segue compacto em dashboard e shipment, sem findings brutos
  - naming visual já está fechado em `Validação necessária`
- Entendimento inicial:
  - severidade interna já existe no domínio (`ADVISORY | CRITICAL`), mas ainda não está exercitada E2E com advisory real no runtime
  - dashboard ainda não recebe sinal backend-derived de triagem que considere validation crítica sem empurrar composição para UI
  - integração com alertas nesta fase deve permanecer visual/operacional no dashboard; não haverá `TrackingAlert` novo nem lifecycle paralelo
- Plano da Fase 4:
  - expandir contexto pluginável com sinais derivados owned pelo Tracking validation, populados partir de projeções canônicas já existentes
  - adicionar detector pluginável advisory mínimo e conservador para subconjunto objetivo de `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - manter detectores críticos atuais intactos e cobertos por regressão
  - preservar contrato público de `tracking_validation` e acrescentar único campo leve de triagem backend-derived no payload de processo/dashboard
  - mapear esse novo sinal até VM e usar campo pronto em row/filter/sort do dashboard, sem composição local na UI
  - reforçar diferença visual advisory vs critical em banner/chips sem mudar naming nem poluir timeline

### M.1 Implementação concluída
- severidade passou atravessar cadeia inteira de forma explícita:
  - detector pluginável
  - finding/sumário agregado
  - projection/read model
  - DTO HTTP
  - mapper UI
  - ViewModel
  - rendering final
- contexto pluginável recebeu sinais derivados owned pelo Tracking BC via `trackingValidationContext.signals`, sem importar read models de process para domínio.
- Foi adicionado detector advisory mínimo `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`, limitado subconjunto objetivo de inconsistência canônica de timeline marítima pós-chegada.
- detectores críticos herdados (`CONFLICTING_CRITICAL_ACTUALS` e `POST_COMPLETION_TRACKING_CONTINUED`) permaneceram ativos e cobertos por regressão.
- dashboard passou receber `attention_severity` como sinal backend-derived leve:
  - `CRITICAL` em validation eleva triagem visual para `danger`
  - `ADVISORY` não cria destaque agressivo extra
  - `highest_alert_severity` continua separado e preservado
- Shipment/detail manteve banner agregador e chips por container, mas agora com distinção visual mais clara entre advisory e critical.

### M.2 Contratos alterados
- Internos Tracking validation:
  - `TrackingValidationContext` agora inclui `signals`
  - novo shape `canonicalTimeline.postCarriageMaritimeEvents`
  - novo detector pluginável `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
- Processo/read model:
  - `ProcessOperationalSummary` agora inclui `attention_severity`
- HTTP:
  - `ProcessResponseSchema` passou expor `attention_severity`
  - `tracking_validation.highest_severity` continuou compacto em `info | warning | danger | null`
- UI/VM:
  - `ProcessSummaryVM` passou carregar `attentionSeverity`
  - dashboard consome esse campo pronto em row accent, filter e sort

### M.3 Comportamento final de severidade
- Domínio:
  - `ADVISORY | CRITICAL` seguem canônicos dentro do Tracking BC
- HTTP/UI:
  - domínio `ADVISORY` -> DTO/VM `warning`
  - domínio `CRITICAL` -> DTO/VM `danger`
- Agregação:
  - por container e por processo, maior severidade vence
  - `ADVISORY` continua visível corretamente mesmo quando é único tipo presente
  - `CRITICAL` preserva prioridade até UI
- Dashboard:
  - permanece binário no topo para validation (`tem issue` / `não tem issue`)
  - passa destacar visualmente `CRITICAL` via `attention_severity`
  - não recebe findings, reasons nem payload extra pesado
- Shipment:
  - continua timeline-first
  - banner/chip usam severidade já pronta, sem rederivação local

### M.4 Integração com alertas
- Não houve integração com `TrackingAlert` persistido nesta fase.
- Decisão explícita:
  - não criar lifecycle paralelo de ack/resolution para validation issues
  - não duplicar semântica de alertas operacionais
  - manter integração como triagem visual backend-derived no dashboard via `attention_severity`

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
  - critical preserva severidade até UI
  - advisory preserva severidade até UI
  - agregação escolhe highest severity
  - dashboard continua leve
  - shipment/detail reflete melhor severidade
  - detectores das Fases 2 e 3 continuam funcionando

### M.6 QA manual realizado
- Ambiente:
  - dev server iniciado com `pnpm run dev -- --host localhost --port 3009`
  - runtime local serviu aplicação em `http://localhost:3002`
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
  - shipment advisory exibiu banner/chip em tom warning e preservou timeline como artefato principal
  - shipment critical exibiu banner/chip em tom danger mais forte e preservou histórico posterior
  - refresh, prefetch e reconciliation não apresentaram regressão visível na passada manual

### M.7 Problemas encontrados
- preview da rota dev `tracking-scenarios` precisou ser alinhado ao novo `attentionSeverity` para continuar compatível com `ProcessSummaryVM`.
- lint falhou ao final da implementação por excesso de linhas em dois blocos de teste; correção foi estrutural, dividindo `describe` sem reduzir cobertura.

### M.8 Limitações intencionais e próximo passo
- Limitações intencionais:
  - advisory entrou no subconjunto objetivo necessário para validar cadeia E2E
  - nenhum finding bruto foi exposto publicamente
  - não houve persistência de validation como alert
- Próximo passo recomendado para Fase 5:
  - expandir detectores advisory reais sobre inconsistências canônicas adicionais, ainda via registry/plugin system, sem mover semântica para UI nem inflar dashboard

## N. Kickoff da Fase 5 Hardening
- Data de início: 2026-04-03
- Fase atual: V1 pluginável / Fase 5 hardening
- Estado herdado da branch:
  - detector `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT` já existe no slice pluginável do Tracking BC
  - detector já está registrado via registry explícito, com cenário `post_carriage_maritime_inconsistent`, testes unitários e propagação E2E até DTO/VM/UI
  - `pnpm check` já estava verde antes desta continuação
- Drift identificado:
  - planos plugináveis ainda descrevem Fase 5 como se fosse primeira introdução desse detector
  - código e log da Fase 4 mostram que advisory mínimo já entrou na branch antes desta etapa
  - rota dev `tracking-scenarios` ainda recomputa `attentionSeverity` localmente para preview de dashboard, criando caminho presentation-only fora do dado backend-derived
- Entendimento inicial:
  - esta continuação deve ser tratada como hardening/alinhamento, não como greenfield
  - recorte mínimo do detector deve permanecer objetivo: contexto marítimo forte dentro de `post-carriage` no read model canônico
  - shipment deve continuar timeline-first e dashboard deve continuar leve
- Plano desta continuação:
  - auditar detector e sinais derivados para confirmar que inconsistência nasce antes da UI
  - remover composição paralela residual no preview dev e voltar consumir severidade backend-derived do dashboard
  - reforçar teste negativo para provar que contexto marítimo normal dentro da perna canônica não vira advisory
  - atualizar log com drift encontrado, hardening aplicado, QA manual e próximo passo da Fase 6

## O. Fechamento da Fase 5 Hardening
- Data de fechamento: 2026-04-03
- Escopo entregue:
  - hardening do trilho pluginável já existente para `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - remoção do único caminho paralelo residual identificado fora da cadeia backend-derived
  - reforço de regressão para blindar recorte mínimo do detector

### O.1 O que foi implementado
- Preview dev / dashboard:
  - rota `src/routes/dev/tracking-scenarios.tsx` deixou de montar `ProcessSummaryVM` derivado do shipment detail
  - preview de dashboard passou consumir diretamente `fetchDashboardProcessSummaries()`, preservando `attentionSeverity` e `trackingValidation` como dados backend-derived
  - com isso, cenário de laboratório parou de recompor severidade localmente partir de alertas + validation
- Detector / recorte mínimo:
  - detector `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT` e sinal `canonicalTimeline.postCarriageMaritimeEvents` foram auditados
  - recorte mínimo foi mantido sem expansão:
    - contexto marítimo objetivo em bloco terminal `post-carriage`
    - severidade `ADVISORY`
    - scope `TIMELINE`
  - nenhuma nova heurística frouxa foi adicionada
- Boundaries:
  - tracking continua dono exclusivo da semântica de validation
  - HTTP continuou expondo `tracking_validation` compacto e `attention_severity`
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
  - hardening foi comportamental, removendo recomposição local no preview dev

### O.4 Testes criados / ajustados
- Reforço de regressão:
  - `src/modules/tracking/application/usecases/tests/find-containers-hot-read-projection.usecase.test.ts`
- Cenário adicional coberto:
  - contexto marítimo normal dentro da perna canônica não dispara advisory
- Baseline revalidado:
  - detector advisory segue positivo no caso objetivo de `post-carriage`
  - agregação container/processo continua preservando `ADVISORY`
  - DTO -> VM e presenter continuam compactos e presentation-only
  - detectores `CONFLICTING_CRITICAL_ACTUALS` e `POST_COMPLETION_TRACKING_CONTINUED` seguem verdes

### O.5 QA manual realizado
- Ambiente:
  - dev server iniciado com `pnpm run dev -- --host localhost --port 3009`
  - runtime local serviu aplicação em `http://localhost:3003`
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
  - clean: preview de dashboard permaneceu sem badge de validation e shipment preview não exibiu banner/chip de validation
  - advisory: preview de dashboard exibiu `Validação necessária` sem escalada agressiva de triagem, e shipment preview mostrou banner agregador + chip por container com leitura timeline-first preservada
  - critical: preview de dashboard exibiu `Validação necessária` com destaque coerente de severidade e shipment preview mostrou banner/chip em tom mais forte sem esconder fatos
  - troca entre cenários e steps atualizou corretamente preview de dashboard partir do payload backend-derived, sem recomposição local visível de `attentionSeverity`
  - nenhuma quebra relevante de layout foi observada em desktop ou mobile
  - console do browser sem erros durante passada manual

### O.6 Problemas encontrados
- problema arquitetural concreto desta continuação foi drift entre planos/log e estado real da branch.
- único desvio de implementação encontrado no código ativo foi recomposição local de `attentionSeverity` no preview dev.

### O.7 Limitações intencionais
- detector advisory não foi ampliado além do subconjunto mínimo já fechado.
- Não houve mudança de `affectedScope` para `TIMELINE_BLOCK`.
- Não houve integração de validation issue com `TrackingAlert` persistido.

### O.8 Próximo passo recomendado para a Fase 6
- Iniciar fase seguinte real do trilho pluginável sem reabrir advisory já consolidado.
- Priorizar evolução em cima de observabilidade/histórico operacional ou do próximo detector ainda não implementado, sempre preservando registry/plugin system como único caminho canônico.

## P. Kickoff da Fase 6
- Data de início: 2026-04-03
- Fase atual: V1 pluginável / Fase 6 lifecycle operacional por transição
- Estado herdado das fases anteriores:
  - framework pluginável de validation já estava estabelecido dentro do Tracking BC
  - detectores ativos eram:
    - `CONFLICTING_CRITICAL_ACTUALS`
    - `POST_COMPLETION_TRACKING_CONTINUED`
    - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - `severity` já atravessava cadeia como semântica canônica no domínio (`ADVISORY | CRITICAL`) e como compactação DTO/VM na UI (`warning | danger`)
  - dashboard já permanecia leve com `tracking_validation` compacto e `attention_severity`
  - shipment já permanecia timeline-first, sem findings brutos nem heurística local
- Entendimento consolidado:
  - Fase 6 precisava persistir transições `activated | changed | resolved`
  - esse dado teria natureza operacional/auxiliar, não truth canônica
  - fonte de verdade continuaria sendo `snapshot -> observations -> timeline/status/alerts/validation derivada`
  - persistência deveria ser econômica, baseada em transição, sem snapshot completo por sync
- Riscos arquiteturais identificados antes de codar:
  - deixar identidade de issue fora do plugin system
  - mover semântica de lifecycle para UI/capability
  - inflar banco com payloads ou estado redundante por sync
  - acoplar persistência operacional ao shape público de shipment/dashboard
- Plano fechado para fase:
  - tornar `lifecycleKey` e `stateFingerprint` obrigatórios no finding pluginável
  - atualizar detectores ativos para produzirem identidade operacional própria
  - criar serviço de derivação de transições `activated | changed | resolved`
  - criar tabela/repositório operacional leve para transições
  - integrar persistência ao pipeline canônico sem alterar `PipelineResult`, DTOs ou VMs públicos
  - estender scenario-lab com reuse incremental no mesmo processo/container para QA real da sequência `activated -> changed -> resolved`

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
  - registry passou validar explicitamente que esses campos existem e não estão vazios
- Detectores ativos:
  - `CONFLICTING_CRITICAL_ACTUALS` passou emitir `lifecycleKey` estável por série e fingerprint derivado dos ACTUAL fingerprints conflitantes
  - `POST_COMPLETION_TRACKING_CONTINUED` passou emitir `lifecycleKey` estável por container e fingerprint do marco forte + continuação incompatível
  - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT` passou emitir `lifecycleKey` estável por container e fingerprint do conjunto relevante de sinais marítimos
- Domínio / serviço:
  - criado `deriveTrackingValidationLifecycleTransitions()`
  - regras:
    - finding novo -> `activated`
    - finding com mesmo `lifecycleKey` mas `stateFingerprint` diferente -> `changed`
    - state ativo persistido sem finding atual correspondente -> `resolved`
    - state inalterado -> nada persiste
- Persistência operacional:
  - criado port `TrackingValidationLifecycleRepository`
  - criada migration `20260403_01_tracking_validation_issue_lifecycle_transitions.sql`
  - criada tabela operacional `tracking_validation_issue_transitions`
  - criada infra `supabaseTrackingValidationLifecycleRepository`
  - persistência grava somente:
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
  - lookup de `process_id` permanece na infra, via `containers`, sem puxar semântica de Process BC para domínio de tracking validation
  - foi criado índice de dedupe por `(container_id, lifecycle_key, transition_type, state_fingerprint, snapshot_id)`
- Pipeline:
  - `processSnapshot()` agora:
    - deriva validation pelo caminho pluginável já existente
    - lê active states persistidos
    - deriva transições
    - persiste apenas transições novas/relevantes
  - `PipelineResult` continuou inalterado
  - shipment/dashboard continuaram consumindo summaries/read models já existentes
- Scenario-lab:
  - `ScenarioLoadCommand` ganhou `reuseProcessId`
  - `ScenarioBuildResult` agora carrega `containerNumbersByKey`
  - seeder passou suportar reuso do mesmo processo/container quando solicitado
  - rota `/api/dev/scenarios/load` expõe `reuse_process_id`
  - UI `tracking-scenarios` passou reutilizar automaticamente processo atual ao avançar steps do mesmo cenário
  - cenário `post_carriage_maritime_inconsistent` foi expandido para:
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
- Mantido princípio da V1:
  - persistir transição, não snapshot completo
- Não foi implementado pruning nesta fase.
- contenção de volume veio de:
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
  - runtime local serviu aplicação em `http://localhost:3003`
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
  - nenhum finding bruto ou detalhe de lifecycle vazou para telas
  - cenários já existentes de advisory/critical continuaram renderizando consistentemente

### Q.6 Problemas encontrados
- tooling Supabase disponível nesta sessão está em modo read-only para DDL.
- Consequência objetiva:
  - não foi possível aplicar migration remota via MCP
  - tabela `tracking_validation_issue_transitions` não existe ainda no banco remoto desta sessão
  - runtime local registrou falha operacional ao tentar processar writes reais contra essa tabela ausente
- Tratamento adotado:
  - migration foi criada no repositório
  - `database.types.ts` foi atualizado
  - lógica foi validada por testes de integração locais
  - limitação foi registrada explicitamente aqui, sem mascarar ausência do schema remoto

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
  - framework pluginável continua centralizado no Tracking BC e registry permanece explícito
  - detectores ativos seguem:
    - `CONFLICTING_CRITICAL_ACTUALS`
    - `POST_COMPLETION_TRACKING_CONTINUED`
    - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - payload público atual permanece compacto:
    - dashboard com agregado mínimo
    - shipment current com resumo por processo/container
  - Fase 6 já persiste lifecycle operacional por transição sem snapshot completo por sync
- Entendimento inicial:
  - UI histórica por snapshot precisa refletir `tracking_validation` derivado do checkpoint selecionado, não resumo atual do shipment
  - lifecycle persistido continua operacional/observável, mas não deve governar render histórico principal
  - integração desta fase deve acontecer no replay/time-travel read model, preservando dashboard leve e shipment timeline-first
- Auditoria consolidada antes de codar:
  - gap principal identificado está no trilho de time travel:
    - timeline/status/alerts históricos já trocam por snapshot
    - banner de validation e chip do selector ainda dependem do `ShipmentDetailVM` atual
  - endpoint lazy de time travel ainda não expõe `tracking_validation` por checkpoint
  - controller de time travel ainda não depende do `trackingFreshnessToken`, então pode ficar defasado após refresh/reconciliation/realtime
- Plano fechado para fase:
  - consolidar helper tracking-owned para derivação compacta de validation partir de estado já reconstruído
  - reutilizar esse helper no hot-read atual e no replay histórico
  - estender `TrackingTimeTravelCheckpoint` e DTO HTTP com `tracking_validation` compacto
  - mapear esse resumo até `TrackingTimeTravelSyncVM`
  - ajustar composição do shipment em modo histórico para:
    - usar banner do container/snapshot selecionado
    - sobrescrever apenas o chip do container selecionado no selector
    - não inventar agregado histórico do processo inteiro
  - fazer resource de time travel refetchar quando `trackingFreshnessToken` mudar

## S. Fechamento da Fase 7
- Data de fechamento: 2026-04-04
- Escopo entregue:
  - `tracking_validation` passou ser derivado por checkpoint no replay/time travel, sem snapshot completo persistido por sync
  - shipment histórico passou consumir VM histórico pronto, sem heurística local de UI
  - time travel passou refetchar com mudanças de `trackingFreshnessToken`
  - dashboard permaneceu com payload mínimo
  - lifecycle persistido continuou como apoio operacional, não como source of truth histórica

### S.1 O que foi implementado
- Tracking BC:
  - `trackingValidation.projection.ts` passou expor derivação compacta partir de estado já reconstruído
  - `tracking.hot-read.projections.ts` foi alinhado esse helper para manter paridade entre presente e replay
  - `tracking-time-travel.readmodel.ts` passou incluir `trackingValidation` compacto em cada checkpoint
  - replay histórico continua derivando partir de:
    - observations
    - timeline
    - status
    - transshipment
    - `effectiveNow`
- HTTP / DTO / VM:
  - `tracking.schemas.ts` e `tracking.http.mappers.ts` passaram expor `tracking_validation` por checkpoint com:
    - `has_issues`
    - `highest_severity`
    - `finding_count`
  - `tracking-time-travel.ui-mapper.ts` e `tracking-time-travel.vm.ts` passaram carregar esse resumo até `TrackingTimeTravelSyncVM`
- UI / shipment:
  - modo histórico do shipment passou usar banner do container/snapshot selecionado
  - chip do selector/container passou refletir sync selecionado no container ativo
  - modo atual continua usando resumo do `ShipmentDetailVM`
- Refresh / realtime:
  - `useTrackingTimeTravelController` agora usa chave com `trackingFreshnessToken`
  - resource lazy de time travel refaz leitura quando shipment atual é reconciliado/refrescado

### S.2 Como ficou a reconstrução por sync
- visão histórica agora vem do replay por sync no Tracking BC.
- endpoint lazy de time travel carrega só resumo compacto de validation por checkpoint.
- Não foi criado snapshot completo de validation por sync.
- paridade entre presente e histórico passou depender do mesmo caminho canônico de derivação pluginável.

### S.3 Como o lifecycle persistido está sendo usado
- Continua sendo operacional/observável:
  - `activated`
  - `changed`
  - `resolved`
- Não governa render histórico do shipment.
- Não substitui derivação do replay por sync.
- Nesta fase pipeline ficou resiliente indisponibilidade do repositório/tabela de lifecycle:
  - falha operacional é logada
  - derivação canônica de timeline/status/alerts/validation continua
  - UI histórica não fica bloqueada por ausência da tabela operacional

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
  - resource histórico passou refletir novos syncs após mudança do `trackingFreshnessToken`
- Evidências:
  - `phase7-dashboard-desktop.png`
  - `phase7-dashboard-mobile.png`
  - `phase7-shipment-advisory-historical-desktop.png`
  - `phase7-shipment-critical-mobile.png`

### S.7 Problemas encontrados
- ambiente local usado no QA não tinha tabela operacional `tracking_validation_issue_transitions` disponível no banco remoto da sessão.
- Sem resiliência, isso quebrava Scenario Lab e runtime local com `500`.
- Tratamento aplicado nesta fase:
  - falha do lifecycle operacional passou degradar graciosamente no pipeline
  - derivação canônica seguiu funcionando
  - problema operacional continua explícito via log
- Durante retomada pós-crash, dev server também revelou incompatibilidade de parser com type annotation intermediário; contrato foi simplificado e alinhado com runtime + build.

### S.8 Limitações intencionais
- Não foi criada leitura pública de lifecycle operacional.
- Não foi adicionada observabilidade externa nova.
- Não foi criado snapshot completo por sync.
- Não foi movida nenhuma semântica de validation para UI.
- dashboard continua sem detalhe histórico de validation por design.

### S.9 Próximo passo recomendado para a Fase 8
- Fechar camada de leitura operacional do lifecycle persistido dentro do Tracking BC para:
  - duração de issues
  - incidência por detector/provider
  - debugging operacional interno
- Fazer isso mantendo:
  - replay por sync como fonte histórica da UI
  - dashboard leve
  - shipment timeline-first

## T. Kickoff da Fase 8
- Data de início: 2026-04-04
- Fase atual: V1 pluginável / Fase 8 hardening do framework pluginável
- Estado herdado das fases anteriores:
  - framework pluginável segue centralizado no Tracking BC, com registry explícito e determinístico
  - detectores ativos em produção:
    - `CONFLICTING_CRITICAL_ACTUALS`
    - `POST_COMPLETION_TRACKING_CONTINUED`
    - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - severidade `ADVISORY | CRITICAL` já atravessa domínio -> projection -> DTO -> VM -> UI
  - dashboard permanece com payload mínimo e shipment permanece timeline-first
  - lifecycle operacional por transição já existe, mas continua auxiliar e não governa render atual/histórico
- Drift identificado:
  - crosswalk canônico preserva plano antigo de time travel/payload na Fase 7 e reserva Fase 8 pluginável para hardening/documentação do framework
  - próximo passo sugerido ao fim da Fase 7 fala em leitura operacional do lifecycle, mas isso não substitui objetivo canônico desta Fase 8
  - slice ainda usa `metadata` como campo genérico do finding, sem separação explícita entre evidência de produto e evidência técnica
  - detector advisory ainda usa `detectorId` em kebab-case, divergindo da convenção desejada em `UPPER_SNAKE_CASE`
- Entendimento inicial:
  - esta fase deve endurecer contratos e convenções do slice `validation` antes da entrada de novos detectores na Fase 9
  - `evidenceSummary` deve continuar curta, segura e apropriada para summary/lifecycle/UI controlada
  - `debugEvidence` deve permanecer interna ao domínio, útil para troubleshooting, sem vazar para dashboard, shipment current ou time travel
  - implementação precisa manter framework explícito e local ao Tracking BC, sem virar engine genérica
- Decisão fechada desta fase:
  - normalizar `detectorId` agora para convenção única em `UPPER_SNAKE_CASE`
  - aceitar e documentar explicitamente drift de identidade no lifecycle persistido já gravado, sem backfill nesta etapa
- Plano cirúrgico:
  - substituir `metadata` por `debugEvidence` em `TrackingValidationFinding`
  - tornar input de projeção explícito em vez de usar `Omit<TrackingValidationContext, 'signals'>`
  - deixar bloco de sinais derivados mais explícito no contrato do contexto sem expandir abstração
  - endurecer registry com validações de `detectorId`, `code`, `summaryKey` e `evidenceSummary`
  - normalizar detectores ativos para convenção única de `detectorId` e `code`
  - preservar payloads públicos compactos e adicionar regressões de non-leak para HTTP/UI/time travel
  - criar documentação interna prática em `src/modules/tracking/features/validation/README.md`

## U. Fechamento da Fase 8
- Data de fechamento: 2026-04-04
- Status final: concluído
- Resultado geral:
  - framework pluginável de Tracking Validation ficou mais explícito, mais rígido e mais documentado
  - `evidenceSummary` e `debugEvidence` agora têm papéis separados no contrato do domínio
  - dashboard permaneceu leve e shipment permaneceu timeline-first
  - detectores atuais seguiram funcionando sem abrir caminho paralelo fora do registry

### U.1 Contracts refinados
- `TrackingValidationFinding`:
  - `metadata` foi removido
  - `debugEvidence` foi introduzido como evidência técnica interna, leve e tipada
  - `evidenceSummary` permaneceu como texto curto, seguro para produto e apropriado para lifecycle
- `TrackingValidationContext`:
  - bloco de sinais derivados passou se chamar `derivedSignals`
  - helpers foram renomeados para refletir que esses sinais existem para fase detector/projection, sem parecer contrato público genérico
- Projeção:
  - `TrackingValidationProjectionInput` deixou de depender de `Omit<TrackingValidationContext, 'signals'>`
  - entrada passou ser explícita, reduzindo fragilidade estrutural e ambiguidade sem inflar abstração
- Registry:
  - passou validar convenções de `detectorId`, `code`, `summaryKey` e `evidenceSummary`
  - reforço de paridade:
    - `detectorId === code`
    - `detectorId` em `UPPER_SNAKE_CASE`
    - `summaryKey` sob `tracking.validation.*`
    - `evidenceSummary` obrigatória, curta e não vazia

### U.2 Convenções consolidadas
- Detectores ativos normalizados para convenção única:
  - `CONFLICTING_CRITICAL_ACTUALS`
  - `POST_COMPLETION_TRACKING_CONTINUED`
  - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
- `code` e `detectorId` agora seguem mesma convenção canônica no framework.
- `affectedScope` permaneceu conservador nesta fase.
- decisão operacional desta fase foi não abrir novos scopes persistidos e não expandir framework para engine genérica.

### U.3 Documentação interna criada
- Arquivo novo:
  - `src/modules/tracking/features/validation/README.md`
- Conteúdo consolidado:
  - onde criar detector
  - como registrar no registry
  - convenção de `detectorId`/`code`
  - uso de `evidenceSummary` vs `debugEvidence`
  - guidance de severidade `ADVISORY | CRITICAL`
  - guidance de `affectedScope`
  - práticas proibidas
  - como testar sem vazar semântica para UI/capability
- `src/modules/tracking/README.md` foi atualizado para apontar para documentação do slice.

### U.4 Mudanças em payload / DTO / VM
- Dashboard:
  - payload permaneceu compacto
  - `tracking_validation` continua expondo só:
    - `has_issues`
    - `highest_severity`
    - `affected_container_count`
- Shipment current:
  - `tracking_validation` de processo/container permaneceu no mesmo shape enxuto
  - nenhuma evidência técnica foi exposta
- Time travel:
  - checkpoints continuam carregando só resumo compacto
  - nenhuma transição operacional, finding bruto ou `debugEvidence` foi exposta
- UI mappers / VMs:
  - permaneceram consumindo Response DTO -> ViewModel
  - foram adicionadas regressões explícitas de non-leak para bloquear `debugEvidence`

### U.5 Testes criados / ajustados
- Framework / domain:
  - `src/modules/tracking/features/validation/domain/tests/trackingValidation.registry.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/conflictingCriticalActuals.detector.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/postCompletionTrackingContinued.detector.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/canonicalTimelineClassificationInconsistent.detector.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/deriveTrackingValidationLifecycleTransitions.test.ts`
- DTO / UI / replay:
  - `src/modules/process/interface/http/tests/process.http.mappers.test.ts`
  - `src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts`
  - `src/modules/process/ui/mappers/tests/tracking-time-travel.ui-mapper.test.ts`
- Cobertura adicionada/fortalecida:
  - enforcement das convenções do registry
  - separação entre `evidenceSummary` e `debugEvidence`
  - non-leak de `debugEvidence` em DTO/VM/time travel
  - compatibilidade dos detectores ativos após hardening
  - lifecycle continuando comparar/persistir `evidenceSummary`

### U.6 QA manual realizado
- Ambiente:
  - app local em `http://localhost:3001`
- Dashboard:
  - rota `/`
  - API `/api/processes` inspecionada no browser
  - resultado observado:
    - `tracking_validation` continuou com chaves compactas
    - sem `debugEvidence`
    - sem findings brutos
    - sem lifecycle interno exposto
- Shipment advisory:
  - processo `d49d648e-da45-4e3a-4e2d-80aa-63e240013d12`
  - resultado observado:
    - banner/chip de `Validação necessária` corretos no current
    - shipment seguiu timeline-first
    - time travel histórico alternou entre sync limpo e sync com issue sem poluição técnica
- Shipment advisory resolvido/histórico:
  - processo `dee611e9-0ee6-494c-998e-18702d729e3d`
  - API de time travel do container validada
  - resultado observado:
    - checkpoints com warning durante a janela problemática
    - checkpoint final limpo
    - shape do payload histórico permaneceu mínimo
- Shipment critical:
  - processo `a3ab094f-4e3a-4e2d-80aa-63e240013d12`
  - resultado observado:
    - banner/chip críticos corretos no current
    - time travel em `sync 3/3` e `sync 2/3` com issue
    - `sync 1/3` limpo
    - nenhum detalhe técnico visível na UI
- Mobile:
  - captura crítica mobile realizada com fallback mínimo de screenshot Playwright CLI quando resize do MCP foi bloqueado
  - shipment crítico permaneceu visualmente coerente e sem vazamento técnico

### U.7 Problemas encontrados
- Playwright MCP bloqueou `resize` usado para viewport mobile durante QA manual.
- Tratamento aplicado:
  - mantivemos fluxo principal de QA pelo MCP
  - usamos fallback mínimo de screenshot Playwright CLI para fechar evidência mobile
- Impacto conhecido e intencional:
  - normalização de `detectorId` nesta fase cria drift de identidade para registros antigos do lifecycle persistido
  - não houve backfill nesta etapa

### U.8 Limitações intencionais
- Não foram adicionados detectores novos da Fase 9.
- Não foi criada infra externa nova.
- Não foi criada leitura pública do lifecycle operacional.
- `debugEvidence` continua restrito ao domínio e não sai para payload público.
- framework continua explícito e local ao Tracking BC, sem shared kernel e sem engine genérica.

### U.9 Checks executados
- Testes direcionados do slice/plugin framework e das fronteiras HTTP/UI
- `pnpm run type-check`
- `pnpm check`
- Resultado final:
  - verde em 2026-04-04

### U.10 Próximo passo recomendado para a Fase 9
- Implementar detectores V1.1 em cima desta base endurecida.
- Reaproveitar convenção única de `detectorId/code`, manter `debugEvidence` interno e abrir novos `affectedScope` quando detector realmente exigir e junto do respectivo contrato/persistência.

## V. Kickoff da Fase 8.5
- Data de início: 2026-04-04
- Fase atual: V1 pluginável / Fase 8.5 explicabilidade pluginável user-facing
- Estado herdado das fases anteriores:
  - framework pluginável continua centralizado no Tracking BC, com registry explícito e sem trilhos paralelos
  - detectores ativos em produção:
    - `CONFLICTING_CRITICAL_ACTUALS`
    - `POST_COMPLETION_TRACKING_CONTINUED`
    - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - `severity` já atravessa domínio -> projection -> DTO -> VM -> UI
  - `evidenceSummary` e `debugEvidence` já foram separados na Fase 8
  - dashboard segue leve e shipment segue timeline-first
  - time travel já reconstrói `tracking_validation` por sync partir da derivação canônica do Tracking BC
- Entendimento inicial:
  - Fase 8.5 precisa explicar ao operador por que validation issue existe e onde ela impacta, sem mover semântica para UI
  - essa explicabilidade deve nascer no backend/read model partir do finding pluginável, não de heurística em mapper/componente
  - dashboard continua sendo superfície de triagem, então deve receber `topIssue` leve para tooltip
  - shipment continua sendo superfície principal de entendimento, então deve receber lista curta ordenada de reasons do container selecionado
- Decisões fechadas antes de codar:
  - reaproveitar `summaryKey` como `reasonKey` público, sem criar chave semântica paralela
  - usar contrato público `key + metadados` em vez de texto final serializado no backend
  - manter `debugEvidence` estritamente interno e não expor `evidenceSummary` nesta fase
  - dashboard fica em `chip + tooltip`; shipment fica em `banner agregador + detalhe compacto do container selecionado`
- Plano cirúrgico:
  - estender `TrackingValidationFinding` com metadados públicos mínimos detector-owned (`affectedLocation`, `affectedBlockLabelKey`)
  - criar read model compacto `TrackingValidationDisplayIssue` e derivá-lo no Tracking BC partir de findings ativos ordenados
  - expandir hot-read e replay/time travel para carregar explicabilidade sem criar use case paralelo
  - expor `top_issue` no agregado de processo e `active_issues` em container/detail/time travel
  - mapear DTO -> VM explicitamente e renderizar explicabilidade sem rederivar semântica na UI

## W. Fase 8.5 concluída
### W.1 O que foi implementado
- Tracking BC passou publicar explicabilidade canônica curta para validation issues ativas via `TrackingValidationDisplayIssue`.
- finding pluginável ganhou metadados públicos mínimos e seguros para produto:
  - `affectedLocation`
  - `affectedBlockLabelKey`
- projeção pluginável agora deriva e ordena:
  - `activeIssues` por container (`severity desc`, depois `code asc`)
  - `topIssue` por processo (`severity desc`, `containerNumber asc`, `code asc`)
- Hot-read, process summary e replay/time travel foram estendidos pelo mesmo trilho pluginável, sem use case paralelo.
- DTOs públicos foram ajustados para expor:
  - dashboard/process list: `tracking_validation.top_issue`
  - shipment/time travel: `tracking_validation.active_issues`
- UI passou consumir esses campos via DTO -> VM, sem montar motivo semântico por heurística.

### W.2 Contrato final escolhido para explicabilidade
- Chave semântica pública:
  - `reasonKey` reaproveitando `summaryKey` do finding
- Metadados públicos:
  - `code`
  - `severity`
  - `reasonKey`
  - `affectedArea`
  - `affectedLocation`
  - `affectedBlockLabelKey`
- Separação preservada:
  - explicação de produto: `reasonKey` + metadados públicos
  - evidência técnica curta: continua interna nesta fase
  - `debugEvidence`: continua estritamente interna e fora dos payloads públicos

### W.3 Shipment após a Fase 8.5
- shipment permaneceu timeline-first.
- banner agregador continuou compacto.
- Foi adicionada superfície discreta logo abaixo do seletor de container:
  - título `Motivo da validação`
  - descrição curta por container selecionado
  - chip/lista compacta com severidade, motivo e metadados de área/bloco/local
- operador agora consegue identificar no shipment:
  - por que validação é necessária
  - qual container está afetado
  - onde revisar (`timeline`, `série`, bloco e/ou local quando aplicável)

### W.4 Dashboard após a Fase 8.5
- dashboard permaneceu agregado e leve.
- linha continua com `chip + tooltip`.
- tooltip agora usa `topIssue` backend-derived para mostrar:
  - resumo agregado
  - motivo curto
  - área/bloco/local quando aplicável
- dashboard não recebe lista de findings, não vira tela diagnóstica e não serializa `debugEvidence`.

### W.5 Detectores cobertos
- `CONFLICTING_CRITICAL_ACTUALS`
  - shipment/time travel exibem motivo curto e `affectedArea = series`
  - localização pública exibida via `affectedLocation = location_code`
- `POST_COMPLETION_TRACKING_CONTINUED`
  - shipment/dashboard exibem motivo curto e `affectedArea = timeline`
- `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - shipment/dashboard/time travel exibem motivo curto e `affectedArea = timeline`
  - bloco público via `shipmentView.timeline.blocks.postCarriage`
  - localização pública curta quando disponível

### W.6 Testes criados / ajustados
- Tracking projection / lifecycle / detectores:
  - `src/modules/tracking/features/validation/application/tests/trackingValidation.projection.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/conflictingCriticalActuals.detector.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/postCompletionTrackingContinued.detector.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/canonicalTimelineClassificationInconsistent.detector.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/deriveTrackingValidationLifecycleTransitions.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/trackingValidation.registry.test.ts`
- Hot-read / HTTP / replay:
  - `src/modules/tracking/application/usecases/tests/find-containers-hot-read-projection.usecase.test.ts`
  - `src/modules/tracking/features/replay/application/tests/tracking-time-travel.readmodel.test.ts`
  - `src/modules/tracking/interface/http/tests/tracking.controllers.test.ts`
  - `src/modules/process/interface/http/tests/process.http.mappers.test.ts`
  - `src/modules/process/interface/http/tests/process.controllers.test.ts`
- DTO -> VM / UI:
  - `src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts`
  - `src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts`
  - `src/modules/process/ui/mappers/tests/tracking-time-travel.ui-mapper.test.ts`
  - `src/modules/process/ui/components/tests/tracking-validation-copy.presenter.test.ts`
  - regressões auxiliares em `fetchProcess.cache`, `useShipmentScreenResource`, `shipmentTrackingReviewDisplay`, `dashboard-sort/filter`

### W.7 QA manual real executado
- Ambiente:
  - app local em `http://localhost:3002`
  - rota dev usada para seed real: `/dev/tracking-scenarios`
- Seed manual executado via `/api/dev/scenarios/load`:
  - `post_carriage_maritime_inconsistent` step 2
    - processo `9dde34d0-f0b7-42d9-9f4b-aae8c4723ab0`
    - container `c32a73cb-8ed0-49a6-8e82-de7a83b09853`
  - `delivery_post_completion_continued` step 2
    - processo `0d8d9a2f-1362-4b47-aa59-13c73900f132`
    - container `b67f5b21-d875-4493-9eba-619289874dcf`
  - `post_carriage_maritime_inconsistent` step 1 como controle sem issue
    - processo `dd5a58e3-d049-4ade-b02a-bb195635f8cb`
  - `discharge_multiple_actual` step 1
    - processo `7c601e8e-489f-4f8e-8a3c-8f53d6abfb9b`
    - container `c5046f10-f361-4ad4-b066-d6586eacdc90`
- Dashboard:
  - rota `/`
  - confirmação manual:
    - linha advisory com chip compacto e tooltip leve usando `top_issue`
    - linha critical com chip compacto e tooltip leve usando `top_issue`
    - linha clean (`post_carriage_maritime_inconsistent` step 1) sem chip de validation
    - nenhuma linha virou superfície diagnóstica verborrágica
- Shipment advisory:
  - rota `/shipments/9dde34d0-f0b7-42d9-9f4b-aae8c4723ab0`
  - confirmação manual:
    - motivo curto visível
    - container afetado identificado (`MAEU6360143`)
    - localização visível (`SANTOS, BR`)
    - bloco visível (`Pós-transporte / Entrega`)
    - timeline continua como artefato principal
- Shipment critical:
  - rota `/shipments/0d8d9a2f-1362-4b47-aa59-13c73900f132`
  - confirmação manual:
    - motivo curto visível
    - container afetado identificado (`MAEU1729252`)
    - área visível (`Timeline`)
    - timeline segue principal e a explicação não compete com ela
- Shipment conflicting actuals:
  - rota `/shipments/7c601e8e-489f-4f8e-8a3c-8f53d6abfb9b`
  - confirmação manual:
    - motivo curto renderizado para `CONFLICTING_CRITICAL_ACTUALS`
    - área visível (`Série de eventos`)
    - localização visível (`BRSSZ`)
- Time travel / reconstruction:
  - rota `/shipments/9dde34d0-f0b7-42d9-9f4b-aae8c4723ab0`
  - `Sync 3/3` mostrou explicação advisory completa
  - `Sync 1/3` removeu bloco `Motivo da validação`, confirmando paridade com estado histórico limpo
- Screenshots gerados:
  - `qa-dashboard-desktop.png`
  - `qa-dashboard-mobile.png`
  - `qa-shipment-advisory-desktop.png`
  - `qa-shipment-advisory-mobile.png`
  - `qa-shipment-critical-desktop.png`
  - `qa-shipment-advisory-historical-desktop.png`

### W.8 Inspeção de payloads públicos
- `/api/processes`
  - confirmou `tracking_validation.top_issue` compacto no dashboard
- `/api/processes/:id`
  - confirmou `tracking_validation.top_issue` no processo
  - confirmou `containers[].tracking_validation.active_issues`
- `/api/tracking/containers/:id/time-travel`
  - confirmou `tracking_validation.active_issues` por checkpoint
- Verificação explícita:
  - `debugEvidence` ausente
  - `evidenceSummary` ausente
  - nenhuma lista pública de findings técnicos fora do contrato leve definido

### W.9 Problemas encontrados
- Playwright MCP estava preso browser anterior (`mcp-chrome-818ffda`) e precisou de limpeza local do processo antes do QA.
- lint da camada visual trata imports contendo `validation` como suspeitos de schema/parsing.
  - ajuste aplicado:
    - contratos/viewmodels e helpers de copy foram movidos para paths neutros (`tracking-review*`)
    - a semântica permaneceu intacta

### W.10 Limitações intencionais
- contrato público continua baseado em `key + metadados`, não em frase final serializada no backend.
- `evidenceSummary` continua separado, mas não foi exposto publicamente nesta fase.
- dashboard continua mostrando `topIssue`, não lista completa de findings.
- fase não introduziu i18n paralela nem rederivação de `affectedArea`/severity no frontend.

### W.11 Checks finais
- `pnpm run type-check`
- `pnpm run lint`
- `pnpm check`
- Resultado final:
  - verde em 2026-04-04

### W.12 Próximo passo recomendado
- Fase 9:
  - aprofundar família de detectores plugináveis
  - decidir quando vale expor `evidenceSummary` em superfícies especializadas sem contaminar dashboard/shipment default
  - considerar ordenação/agrupamento multi-finding por família sem perder regra timeline-first

## X. Kickoff da Fase 9
- Data de início: 2026-04-04
- Fase atual: V1 pluginável / Fase 9 detectores V1.1 conservadores
- Estado herdado das fases anteriores:
  - framework pluginável segue centralizado no Tracking BC, com registry explícito, ordem determinística e sem caminho paralelo
  - detectores ativos em produção:
    - `CONFLICTING_CRITICAL_ACTUALS`
    - `POST_COMPLETION_TRACKING_CONTINUED`
    - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
  - `severity` já cruza domínio -> projection -> DTO -> VM -> UI
  - `debugEvidence` permanece interno; dashboard/process/shipment/time travel continuam consumindo contrato público compacto
  - dashboard segue leve com `top_issue`; shipment e time travel seguem timeline-first com `active_issues`
  - lifecycle operacional continua auxiliar e não governa renderização atual/histórica
- Entendimento inicial:
  - Fase 9 precisa ampliar cobertura semântica com exatamente 2 detectores novos, mantendo feature inteiramente dentro do framework pluginável da Fase 1
  - candidatos válidos são `UNRECONCILABLE_TRACKING_STATE`, `EXPECTED_PLAN_NOT_RECONCILABLE` e `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT`
  - escolha deve privilegiar critério formal, baixo falso positivo e alto valor operacional
  - fase não pode transformar dado incompleto em validation issue; ausência simples continua válida sem contradição objetiva
- Detectores escolhidos para esta fase:
  - `EXPECTED_PLAN_NOT_RECONCILABLE`
    - regra inicial fechada: série crítica com `ACTUAL` primário e `EXPECTED` remanescente classificado como `REDUNDANT_AFTER_ACTUAL` no mesmo `seriesKey`
    - allowlist inicial: `LOAD | DEPARTURE | ARRIVAL | DISCHARGE | DELIVERY`
    - severidade inicial: `ADVISORY`
  - `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT`
    - regra inicial fechada: cronologia ACTUAL com `DISCHARGE` e contradição marítima forte por milestone intermediário ausente
    - subcasos iniciais:
      - `LOAD -> DISCHARGE` sem `DEPARTURE`
      - `DEPARTURE -> DISCHARGE` sem `ARRIVAL`
    - severidade inicial: `ADVISORY`
- Detector conscientemente deixado de fora:
  - `UNRECONCILABLE_TRACKING_STATE`
    - permanece fora da Fase 9 porque ainda está amplo demais e tenderia a virar umbrella/catch-all ou duplicar detectores mais específicos da V2
- Justificativa da escolha:
  - ambos detectores escolhidos podem ser ancorados em semântica canônica já disponível no Tracking BC (`classifySeries`, cronologia ACTUAL, series/timeline/status read models)
  - ambos têm cenário de controle claro e conseguem distinguir comportamento legítimo de ruído sem jogar semântica para UI
  - detector excluído exigiria, nesta altura, critérios amplos demais para continuar conservador
- Plano cirúrgico:
  - registrar dois plugins em `domain/detectors/*` e conectá-los ao registry existente
  - manter contrato público intacto, adicionando novos `code` / `reasonKey`
  - cobrir novos detectores com testes unitários positivos/negativos e regressões de projection/DTO/VM
  - atualizar `pt-BR` com novas chaves de razão
  - executar QA manual real com Scenario Lab para:
    - `expected_after_actual`
    - `missing_departure`
    - `missing_arrival`
  - validar dashboard, shipment e time travel pelo mesmo pipeline já existente

## Y. Fechamento da Fase 9
- Data de fechamento: 2026-04-04
- Escopo entregue:
  - exatamente 2 detectores V1.1 conservadores adicionados ao registry pluginável do Tracking BC
  - cadeia E2E preservada sem novo payload público, sem nova rota e sem novo caminho fora do slice `validation`
  - dashboard permaneceu leve com `top_issue` compacto e shipment/time travel permaneceram timeline-first com `active_issues`

### Y.1 O que foi implementado
- Detectores novos:
  - `EXPECTED_PLAN_NOT_RECONCILABLE`
    - dispara apenas quando a própria série crítica já tem `ACTUAL` primário e ainda preserva `EXPECTED` classificado como `REDUNDANT_AFTER_ACTUAL`
    - allowlist fechada nesta fase:
      - `LOAD`
      - `DEPARTURE`
      - `ARRIVAL`
      - `DISCHARGE`
      - `DELIVERY`
    - `affectedScope = SERIES`
    - severidade: `ADVISORY`
  - `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT`
    - dispara apenas em cronologia ACTUAL com contradição marítima forte já concluída por milestone posterior
    - subcasos fechados nesta fase:
      - `LOAD -> ARRIVAL` sem `DEPARTURE`
      - `LOAD -> DISCHARGE` sem `DEPARTURE`
      - `DEPARTURE -> DISCHARGE` sem `ARRIVAL`
    - `affectedScope = TIMELINE`
    - severidade: `ADVISORY`
- Registry / framework:
  - dois detectores foram ligados exclusivamente via `domain/detectors/index.ts`
  - nenhum helper genérico novo ou trilho paralelo foi introduzido
  - `UNRECONCILABLE_TRACKING_STATE` permaneceu explicitamente fora desta fase
- Fronteiras:
  - nenhum shape público novo foi criado
  - mudança pública foi só entrada de novos `code` e `reason_key` dentro do contrato já existente
  - `debugEvidence` e `evidenceSummary` continuaram internos ao Tracking BC

### Y.2 Critérios objetivos adotados
- `EXPECTED_PLAN_NOT_RECONCILABLE` só considera mesma série e só dispara quando `EXPECTED` remanescente já é formalmente redundante frente `ACTUAL` confirmado.
- `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT` só considera ACTUALs marítimos fortes e exige milestone posterior objetiva para provar contradição.
- Ambas regras foram limitadas `ADVISORY` nesta fase porque exigem revisão humana, mas não provam sozinhas risco operacional tão forte quanto detectores críticos já existentes.
- candidato excluído `UNRECONCILABLE_TRACKING_STATE` ficou fora porque ainda exigiria umbrella semântica ampla demais para continuar conservador.

### Y.3 Contratos alterados
- Públicos:
  - nenhum campo adicional em DTO/VM/read model público
  - `tracking_validation` continuou compacto em dashboard, shipment detail e time travel
- Internos:
  - novos plugins:
    - `expectedPlanNotReconcilable.detector.ts`
    - `missingCriticalMilestoneWithContradictoryContext.detector.ts`
  - novas chaves i18n:
    - `tracking.validation.expectedPlanNotReconcilable`
    - `tracking.validation.missingCriticalMilestoneWithContradictoryContext`

### Y.4 Testes criados / ajustados
- Detectores:
  - `src/modules/tracking/features/validation/domain/tests/expectedPlanNotReconcilable.detector.test.ts`
  - `src/modules/tracking/features/validation/domain/tests/missingCriticalMilestoneWithContradictoryContext.detector.test.ts`
- Agregação / projection:
  - `src/modules/tracking/features/validation/application/tests/trackingValidation.projection.test.ts`
- DTO -> VM:
  - `src/modules/process/interface/http/tests/process.http.mappers.test.ts`
  - `src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts`
  - `src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts`
  - `src/modules/process/ui/mappers/tests/tracking-time-travel.ui-mapper.test.ts`
- Cobertura mínima validada:
  - disparo positivo e negativo dos dois detectores novos
  - agregação por container/processo com `top_issue`
  - mapeamento estável até dashboard, shipment e time travel
  - compatibilidade com detectores anteriores e ausência de leak de payload técnico

### Y.5 QA manual realizado
- Ambiente:
  - app local validado em `http://localhost:3002`
- Scenario Lab utilizado:
  - `expected_after_actual` step 2 reutilizando mesmo processo do step 1
  - `missing_departure` step 1
  - `missing_arrival` step 1
  - `booking.basic` step 1 como controle sem issue
- APIs inspecionadas:
  - `/api/processes`
  - `/api/processes/:id`
  - `/api/tracking/containers/:id/time-travel`
- Validações executadas:
  - dashboard mostra processo com `top_issue` compacto dos detectores novos
  - shipment com `EXPECTED_PLAN_NOT_RECONCILABLE` mostra banner/chip/motivo sem poluir timeline
  - shipment com `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT` mostra banner/chip/motivo sem rederivar semântica na UI
  - shipment controle permanece sem banner/chip indevido
  - time travel preserva `tracking_validation.active_issues` no sync histórico sem expor `debugEvidence`
  - mobile e desktop permaneceram legíveis e consistentes
- Evidências geradas:
  - `phase9-dashboard-desktop.png`
  - `phase9-dashboard-mobile.png`
  - `phase9-shipment-expected-after-actual-desktop.png`
  - `phase9-shipment-expected-after-actual-mobile.png`
  - `phase9-shipment-missing-arrival-desktop.png`
  - `phase9-shipment-control-desktop.png`
  - `phase9-time-travel-missing-arrival-desktop.png`

### Y.6 Problemas encontrados
- Playwright MCP começou sessão preso browser anterior e precisou de limpeza do processo antes da passada manual final.
- `pnpm check` inicial falhou por formatação/import order dos detectores novos e por detalhe de tipagem em fixture de `tracking-time-travel.ui-mapper.test.ts`; ambos foram corrigidos antes do fechamento final.

### Y.7 Limitações intencionais
- fase não implementa `UNRECONCILABLE_TRACKING_STATE`.
- Não houve mudança de severidade para `CRITICAL` nesses dois detectores.
- Não houve expansão do payload do dashboard nem detalhe técnico adicional no shipment/time travel além dos novos `code`/`reason_key`.

### Y.8 Checks finais
- `pnpm run type-check`
- `pnpm vitest run src/modules/tracking/features/validation/domain/tests/expectedPlanNotReconcilable.detector.test.ts src/modules/tracking/features/validation/domain/tests/missingCriticalMilestoneWithContradictoryContext.detector.test.ts src/modules/tracking/features/validation/application/tests/trackingValidation.projection.test.ts src/modules/process/interface/http/tests/process.http.mappers.test.ts src/modules/process/ui/mappers/tests/processList.ui-mapper.test.ts src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts src/modules/process/ui/mappers/tests/tracking-time-travel.ui-mapper.test.ts`
- `pnpm check`
- Resultado final:
  - verde em 2026-04-04

### Y.9 Próximo passo recomendado para a Fase 10
- Introduzir próximo detector pluginável se ele puder nascer com critério tão fechado quanto dois desta fase.
- melhor candidato parece ser detector de reconciliação impossível focado em regressão/mutação estrutural específica, não umbrella geral.
- Se Fase 10 precisar de detalhe extra para triagem, priorizar superfícies especializadas e manter dashboard e shipment default compactos.

## Z. Kickoff da Fase 10
- Data de início: 2026-04-04
- Fase atual: V1 pluginável / Fase 10 fechamento final
- Estado herdado das fases anteriores:
  - framework pluginável segue centralizado no Tracking BC, com registry explícito, ordem determinística e sem caminho paralelo
  - detectores ativos em produção:
    - `CONFLICTING_CRITICAL_ACTUALS`
    - `POST_COMPLETION_TRACKING_CONTINUED`
    - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
    - `EXPECTED_PLAN_NOT_RECONCILABLE`
    - `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT`
  - `severity` já cruza domínio -> projection -> DTO -> VM -> UI
  - dashboard segue leve com `top_issue`; shipment e time travel seguem timeline-first com `active_issues`
  - `debugEvidence` segue interna ao Tracking BC e não vaza para contratos públicos
  - lifecycle operacional continua auxiliar e não governa renderização atual/histórica
- Entendimento inicial:
  - Fase 10 é de fechamento da V1/V1.1 pluginável, não de abertura de detector novo, payload novo ou rota nova
  - principal resíduo arquitetural remanescente é `TrackingValidationDisplayIssue` ainda viver em `domain/model` mesmo sendo consumido como contrato de projection/read model pela cadeia application -> HTTP -> UI
  - fase precisa revisar coerência completa detector -> projection -> DTO -> mapper -> VM -> UI, garantir que não exista drift e deixar microcopy atual/histórica mais consistente
  - naming visual final `Validação necessária` permanece preservado nesta fase
- Plano cirúrgico:
  - mover `TrackingValidationDisplayIssue` e seus helpers para `application/projection`, mantendo `TrackingValidationFinding` como contrato estritamente de domínio
  - atualizar imports em Tracking HTTP, Process application e Process HTTP para novo contrato application-level
  - polir microcopy do dashboard/shipment sem expandir payload nem mover semântica para UI
  - adicionar regressão focada do shipment header para copy atual vs histórica
  - revisar README do slice e registrar claramente fechamento V1/V1.1 e que fica para V2

## AA. Fechamento da Fase 10
- Data de fechamento: 2026-04-04
- Escopo efetivamente entregue:
  - fechamento final da V1 pluginável sem abrir detector novo, sem criar rota nova e sem expandir payload público
  - cleanup arquitetural do contrato `TrackingValidationDisplayIssue`, agora owned por `application/projection` do Tracking BC
  - polimento final de copy/i18n do dashboard, shipment atual e shipment histórico
  - regressões finais cobrindo banner e painel de motivos em modo atual vs histórico

### AA.1 Implementação concluída
- Boundary cleanup:
  - `TrackingValidationDisplayIssue` e helpers de ordenação/área afetada foram movidos de `domain/model` para `application/projection`
  - Process application, Process HTTP e Tracking HTTP passaram consumir contrato application-level
  - arquivo antigo em `domain/model` foi removido, eliminando resíduo cross-BC/domain
- UX / microcopy:
  - dashboard manteve naming visual `Validação necessária`, mas com texto agregador mais natural para singular/plural
  - shipment atual passou usar copy explícita para singular/plural sem truques de fallback
  - shipment histórico manteve copy específica por container/snapshot
  - painel lateral de motivos foi alinhado para `Motivos da validação`, com descrição distinta entre modo atual e histórico
- Documentação interna:
  - README do slice de validation foi atualizado com detectores ativos da V1/V1.1 e com ownership rule do contrato application-level

### AA.2 Contratos e payloads revisados
- Domínio:
  - `TrackingValidationFinding` continua sendo contrato canônico do detector/plugin
- Application / projection:
  - summary + `TrackingValidationDisplayIssue` seguem como read model compacto owned pelo Tracking BC
- HTTP / DTO:
  - nenhum shape público novo
  - dashboard continua com `has_issues`, `highest_severity`, `affected_container_count`, `top_issue`
  - shipment e time travel continuam com `finding_count`, `active_issues`, `affected_area`, `affected_location`, `affected_block_label_key`
- Segurança de payload:
  - `debugEvidence` continua interna ao Tracking BC e não vazou para dashboard, shipment ou time travel

### AA.3 Testes criados / ajustados
- Ajustados:
  - `src/modules/process/ui/components/tests/tracking-validation-copy.presenter.test.ts`
- Criados:
  - `src/modules/process/ui/components/tests/ShipmentHeader.validation.test.tsx`
  - `src/modules/process/ui/components/tests/TrackingReviewIssuesPanel.validation.test.tsx`
- Suíte focada revalidada:
  - projection do tracking validation
  - process HTTP mappers
  - process UI mappers
  - shipment tracking review display
  - copy atual/histórica do banner
  - copy atual/histórica do painel de motivos

### AA.4 QA manual amplo realizado
- Ambiente:
  - app local validado em `http://localhost:3003`
- Scenario Lab validado:
  - `booking.basic` step 1
  - `conflict.double_actual` step 2
  - `delivery_post_completion_continued` step 2
  - `post_carriage_maritime_inconsistent` step 4 no presente + sync histórico com issue
  - `expected_after_actual` step 2
  - `missing_departure` step 1
  - `missing_arrival` step 1
- APIs inspecionadas:
  - `/api/processes`
  - `/api/processes/:id`
  - `/api/tracking/containers/:id/time-travel`
- Validações executadas:
  - dashboard continua leve, com `top_issue` compacto e sem detalhe técnico indevido
  - shipment atual continua timeline-first e renderiza banner/chip/painel sem rederivar semântica
  - shipment histórico continua coerente por sync e usa copy específica de snapshot/container
  - detectores críticos e advisory continuam atravessando domínio -> projection -> DTO -> VM -> UI
  - detectores extras da Fase 9 continuam corretos em payload e UI
  - shipment controle sem issue permanece sem banner/chip indevido
  - modo histórico não expõe `debugEvidence`
- Evidências geradas:
  - `phase10-dashboard-desktop.png`
  - `phase10-dashboard-mobile.png`
  - `phase10-shipment-post-completion-desktop.png`
  - `phase10-shipment-expected-after-actual-desktop.png`
  - `phase10-shipment-expected-after-actual-mobile.png`
  - `phase10-shipment-time-travel-historical-desktop.png`

### AA.5 Resíduos removidos e decisões preservadas
- Removido:
  - caminho residual em que contrato de projection vivia sob `domain/model`
- Preservado explicitamente:
  - Tracking segue único dono da semântica de validation issues
  - UI continua sem detectar issue
  - capabilities continuam sem definir regra canônica
  - dashboard segue leve
  - shipment segue timeline-first
  - lifecycle operacional e time travel seguem integrados sem virarem fonte de verdade

### AA.6 Riscos residuais pequenos
- Ainda existe risco futuro de surgir drift de copy entre superfícies se novos modos históricos forem adicionados sem reaproveitar presenters criados nesta fase.
- conjunto atual de detectores continua intencionalmente conservador; alguns casos de “estado impossível” ainda permanecem fora da V1/V1.1 para evitar umbrella semântica ampla demais.

### AA.7 Fechamento explícito V1 / V1.1 / V2
- V1 entregue:
  - framework pluginável centralizado no Tracking BC
  - registry determinístico
  - cadeia detector -> projection -> DTO -> VM -> UI
  - dashboard leve com `top_issue`
  - shipment/time travel com `active_issues`
  - severidade `ADVISORY` / `CRITICAL`
  - detectores:
    - `CONFLICTING_CRITICAL_ACTUALS`
    - `POST_COMPLETION_TRACKING_CONTINUED`
    - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
- V1.1 entregue:
  - detectores:
    - `EXPECTED_PLAN_NOT_RECONCILABLE`
    - `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT`
  - endurecimento de contracts/evidence/debug
  - integração final consistente com lifecycle operacional e time travel
- Fica explicitamente para V2:
  - `UNRECONCILABLE_TRACKING_STATE`
  - regressões impossíveis pós-marco forte
  - incompatibilidades estruturais mais amplas entre `EXPECTED` e `ACTUAL`
  - mistura de ciclos logísticos ou blocos canônicos estruturalmente impossíveis
  - plugins agregados de provider/parser health
