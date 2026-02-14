# modules/process

1. Propósito do Módulo

- Bounded context: gestão do shipment/processo de negócio (Process / Shipment).
- Responsável por: modelar metadados do processo (refs, BL, booking, importer/exporter), aggregate relacionado (ProcessAggregate), casos de uso para CRUD e read-models usados pela UI.
- NÃO responsável por: derivação de status por container (tracking), normalização de snapshots brutos.

2. Estrutura interna (presente nesta pasta)

- domain/
  - `process.entity.ts`, `process.aggregate.ts`, `process.types.ts` — entidade/aggregate e value objects (`value-objects/`).
- application/
  - use-cases e presenters (`application/process.presenter.ts`, `application/shipment.readmodel.ts`).
- infrastructure/
  - bootstrap (`infrastructure/bootstrap/process.bootstrap.ts`) que faz o wiring de use-cases e repositórios.
- interface/
  - `interface/http/` — controllers e mappers HTTP (composition root `process.controllers.bootstrap.ts`).
- ui/
  - componentes e mapeadores específicos de view (ex.: `ui/components/TimelinePanel.tsx`, `PredictionHistoryModal.tsx`).

3. Fluxo interno (exemplo de leitura detalhada)

HTTP Request → Controller (interface/http) → validação (Zod) → mapeamento para Query/Command → Use Case / Presenter (application) → Repos (infrastructure) → Response DTO → UI mapper → ViewModel

4. Tipos principais (arquivo / camada)

- `ProcessAggregate` / `ProcessEntity` — `src/modules/process/domain/process.aggregate.ts` / `process.entity.ts` (Domain).
- Value objects — `src/modules/process/domain/value-objects/*` (ex.: `ProcessId`, `Carrier`).
- Read models / presenters — `src/modules/process/application/*` (`shipment.readmodel`, `process.presenter`).
- Controllers / DTOs — `src/modules/process/interface/http/*` (Interface layer).

5. Regras arquiteturais do módulo

- Domain não conhece infra; aggregate e factories são puros.
- Controllers (interface) mapeiam Request DTO → Command e chamam o facade/use-cases; não chamam repositórios diretamente.
- Presenter (`application`) realiza a conversão de dados para `Response DTO`/read-models e usa o módulo `tracking` apenas via read DTOs (por exemplo: `deriveTimelineWithSeries` recebe observações já normalizadas do backend API).

6. Pontos sensíveis / armadilhas

- Não misturar read-models com agregados (separar projections para list views).
- Evitar lógica de derivação de status no presenter — usar funções do módulo `tracking` quando apropriado.
- Ao adicionar chaves i18n usadas por componentes do processo, atualize `src/locales/*` conforme as regras do projeto.

7. Evolução futura (curto)

- Consolidar campo de booking/BL e regras de validação nos value-objects do domínio.
- Expor endpoints que retornem status agregados por processo para acelerar o dashboard.
