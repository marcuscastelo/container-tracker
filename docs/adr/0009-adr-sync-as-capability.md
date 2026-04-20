# ADR — Introduce Sync Capability

## Status

Proposed

## Context

sistema atualmente possui múltiplos mecanismos de sincronização:

- dashboard refresh
- process refresh
- container refresh (planejado)

implementação atual localiza lógica dentro do BC `process`.

Entretanto sincronização:

- orquestra múltiplos BCs
- depende de runtime operacional (sync_requests)
- não pertence semanticamente ao domínio process

Isso viola parcialmente princípio arquitetural:

"Capabilities orchestrate multiple bounded contexts."

## Decision

Criar capability dedicada:

```
capabilities/sync
```

Essa capability será responsável por:

- resolução de targets de sync
- enqueue de jobs
- agregação de status operacional

domínio tracking permanece responsável por:

```
snapshot
observation
timeline
status
alerts
```

## Consequences

### Positivas

- remove orquestração cross-BC do process
- centraliza lógica de sync
- permite novos níveis de sync (container)
- melhora clareza arquitetural

### Negativas

- pequena duplicação de queries
- nova camada de aplicação

## Alternatives considered

### Manter dentro de process

Rejeitado porque:

- dashboard sync não pertence ao process
- container sync também não

### Criar BC sync

Rejeitado porque:

- sync não é domínio canônico
- é runtime operacional

Capabilities são camada correta.

## Implementation plan

1. Criar capability sync
2. Mover usecases existentes
3. Criar resolver de targets
4. Atualizar controllers
5. Remover process-sync