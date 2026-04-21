# ADR 0031 — Generation-Based Tracking Replay and Hidden Internal Admin Surface

Date: 2026-04-12  
Status: Accepted

## Context

O sistema preserva snapshots históricos, mas não possuía mecanismo operacional oficial para reconstruir derivações de tracking por container usando a lógica atual.

Isso gerava problemas recorrentes:

- bugs históricos de normalização/fingerprint permanecendo ativos nas derivadas;
- correções em parser/normalizer sem saneamento automático do passado;
- ausência de fluxo oficial de preview/apply/rollback;
- risco operacional alto em purge manual.

Ao mesmo tempo, o domínio exige:

- snapshots imutáveis;
- observations append-only;
- status/alerts como derivados;
- preservação de auditabilidade e reversibilidade;
- tracking como dono canônico da derivação.

## Decision

Adotar replay administrativo por container com estratégia de gerações derivadas + ponteiro ativo.

A solução inclui:

- replay determinístico por container;
- dry-run com diff resumido persistido;
- apply com ativação atômica da nova geração;
- rollback formal para geração anterior;
- lock operacional por container com heartbeat;
- superfície interna oculta em `/dev/tracking-replay`, server-first, sem semântica no frontend.

## Boundaries

### Tracking BC

Responsável por:

- engine de replay;
- ordenação de snapshots;
- reconstrução de observations/alerts;
- diff semântico resumido;
- ativação/rollback de geração;
- lock operacional de replay.

### HTTP Interface

Responsável por:

- validação de request;
- delegação para use cases;
- serialização DTO.

### UI Interna

Responsável por:

- lookup de alvo;
- disparo de preview/apply/rollback;
- renderização de summary/run/diff.

A UI não recalcula semântica de tracking.

## Rationale

Geração derivada + ponteiro ativo foi escolhida por preservar:

- auditabilidade;
- reversibilidade;
- segurança operacional;
- consistência com invariantes append-only;
- compatibilidade com pipeline canônico existente.

Alternativas rejeitadas:

- purge destrutivo + rebuild como contrato principal;
- backfill SQL sem replay pelo pipeline canônico.

## Consequences

### Positivas

- replay oficial por container;
- rollback simples e auditável;
- redução de risco operacional em correções históricas;
- base para saneamento de débitos de retrocompatibilidade temporal.

### Negativas

- aumento de complexidade estrutural;
- novas tabelas operacionais;
- adaptação do read path para geração ativa.

Trade-off aceito.

## Follow-ups

- avaliar retenção/pruning de gerações candidatas de dry-run;
- evoluir observabilidade específica de replay;
- considerar replay em lote em fases futuras, fora do MVP.
