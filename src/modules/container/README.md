# Container Module (Bounded Context)

Represents physical container identity and lifecycle association.

## Responsibilities

- Container creation
- Identity validation (container number / ids)
- Process linkage
- Persistence mapping

Container does not:

- Derive timeline
- Classify alerts
- Perform tracking logic

Tracking owns event semantics.

---

## Internal Structure

- domain/
  - entity + validation + identity VOs
- application/
  - repository contract + usecases
- infrastructure/
  - persistence adapters (row/mappers/repository) + bootstrap
- ui/
  - UI helpers if needed (no domain rules)

---

## Key Types

- Domain
  - `ContainerEntity` — `domain/container.entity.ts`
  - `ContainerNumber`, `ContainerId`, `ProcessId`, `CarrierCode` — `domain/identity/*`
- Application
  - `ContainerRepository` — `application/container.repository.ts`
- Infrastructure
  - `ContainerRow` — `infrastructure/persistence/container.row.ts`

---

## Rules / Pitfalls

- Domain must not import infra.
- Do not leak snake_case rows into application/ui (use mappers).
- Avoid `Partial<Entity>` as input shapes.
- Validate container number via VO before persistence.

---

## Near-Term Improvements

- Add `interface/http` only if container needs a first-class API.
- Tighten ContainerNumber validation and mapper integration tests.