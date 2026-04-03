# Tracking Validation Implementation Log

## A. Estado atual
- Fase atual: V1 pluginável / Fase 1
- Status atual: concluída
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
  - nenhum item da Fase 1
- Falta:
  - iniciar Fase 2 com detectores reais e backlog pluginável pós-V1

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
