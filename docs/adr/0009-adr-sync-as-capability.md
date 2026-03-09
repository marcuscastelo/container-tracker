# ADR — Introduce Sync Capability

## Status

Proposed

## Context

O sistema atualmente possui múltiplos mecanismos de sincronização:

- dashboard refresh
- process refresh
- container refresh (planejado)

A implementação atual localiza a lógica dentro do BC `process`.

Entretanto a sincronização:

- orquestra múltiplos BCs
- depende de runtime operacional (sync_requests)
- não pertence semanticamente ao domínio process

Isso viola parcialmente o princípio arquitetural:

"Capabilities orchestrate multiple bounded contexts."

## Decision

Criar uma capability dedicada:

```
capabilities/sync
```

Essa capability será responsável por:

- resolução de targets de sync
- enqueue de jobs
- agregação de status operacional

O domínio tracking permanece responsável por:

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

Capabilities são a camada correta.

## Implementation plan

1. Criar capability sync
2. Mover usecases existentes
3. Criar resolver de targets
4. Atualizar controllers
5. Remover process-sync