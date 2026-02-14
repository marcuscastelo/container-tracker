# modules/container

1. Propósito do Módulo

- Bounded context: gestão de containers (entidade física associada a um `Process`/shipment).
- Responsável por: tipos canônicos de container, value objects (IDs, container number, carrier code), factories e persistência (contratos de repository e implementações em `infrastructure/persistence`).
- NÃO responsável por: derivação de status, snapshots de carrier, normalizadores de eventos — isso pertence ao módulo `tracking`.

2. Estrutura interna (presente nesta pasta)

- domain/
  - `container.entity.ts` — `ContainerEntity` e `createContainerEntity`.
  - `container.types.ts`, `container.validation.ts` — helpers e validações de domínio.
  - `value-objects/` — `ContainerNumber`, `ContainerId`, `ProcessId`, `CarrierCode`.
- application/
  - `container.repository.ts` — contratos de repositório: `InsertContainerRecord`, `ContainerRepository` e use-cases em `application/usecases/`.
- infrastructure/
  - `persistence/container.row.ts` — `ContainerRow` mapeado para o schema do DB.
  - Implementações e mappers de persistência em `infrastructure/persistence/`.
- ui/
  - Mapeadores / view models (quando aplicável).

3. Fluxo interno (exemplo de criação via HTTP)

HTTP Request → Interface (controller) → Request DTO (Zod) → Command → Use Case (application) → Repository (insert record) → Entity → Response DTO

4. Tipos principais (arquivo / camada)

- `ContainerEntity` — `src/modules/container/domain/container.entity.ts` (Domain).
- Value objects — `src/modules/container/domain/value-objects/*` (`ContainerNumber`, `ContainerId`, `ProcessId`, `CarrierCode`).
- `InsertContainerRecord`, `UpdateContainerRecord` — `src/modules/container/application/container.repository.ts` (Application / Repository contract).
- `ContainerRow` — `src/modules/container/infrastructure/persistence/container.row.ts` (Infra / DB row type).

5. Regras arquiteturais do módulo

- Domain não conhece infra: factories e entidades vivem em `domain/` e não importam clientes de DB.
- Repositório: contratos em `application/` — implementações em `infrastructure/`.
- Repositórios lançam exceções em caso de erro (padrão do projeto).
- Snake_case (rows) não deve vazar para Application/UI; use mappers em `infrastructure/persistence`.

6. Pontos sensíveis / armadilhas

- Não usar `Partial<Entity>`/`Omit<Entity, ...>` como shape de input.
- Validar `ContainerNumber` com value-object helpers antes de persistir.
- Não misturar responsabilidades com `tracking` (status/observations).

7. Evolução futura (curto)

- Padronizar controllers em `interface/http` com Zod schemas compartilhados.
- Melhorar validação ISO do `ContainerNumber` e adicionar testes de integração para mappers.
