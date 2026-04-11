# ADR — Coverage Policy v0

- Status: Proposed
- Date: 2026-04-10
- Owner: Repository maintainers

## Context

O repositório precisa começar a metrificar coverage, mas um número global isolado não é suficiente para representar segurança operacional real.

No Container Tracker:

- a verdade canônica vive no domínio, especialmente em `tracking`
- `tracking` é responsável por interpretação semântica de eventos, séries, timeline, status e alerts
- UI, routes e capabilities consomem essa verdade, mas não podem rederivá-la
- portanto, coverage útil precisa refletir risco arquitetural e semântico, não apenas quantidade de linhas executadas

Sem essa distinção, o repositório corre o risco de:

- inflar coverage com testes baratos de utilitários ou UI cosmética
- manter baixo coverage nas regras canônicas mais sensíveis
- criar falsa sensação de segurança
- premiar volume de testes em vez de proteção de invariantes

---

## Decision

Adotar uma **Coverage Policy v0** orientada a risco arquitetural.

A policy passa a tratar coverage em três níveis:

1. **Coverage macro**
   - line / branch / function / statement globais
   - usado para tendência e anti-regressão grosseira

2. **Coverage estrutural**
   - report por bounded context / capability
   - report por camada arquitetural

3. **Coverage crítico**
   - foco explícito nas áreas canônicas do tracking e demais fluxos operacionais relevantes

A métrica principal do projeto passa a ser:

**branch coverage do domínio crítico**, com prioridade para:

- `modules/tracking/domain`
- `modules/tracking/application`

Coverage global continua existindo, mas deixa de ser a métrica principal de confiança.

---

## Rationale

Essa decisão existe para alinhar a metrificação de testes com a arquitetura oficial do projeto.

Como o tracking é dono de:

- normalização de observations
- grouping/classification de series
- safe-first primary selection
- interpretação ACTUAL vs EXPECTED
- derivação de timeline
- derivação de status
- derivação de alerts

é nessa camada que uma regressão semântica traz mais risco operacional.

Logo:

- cobertura de `shared/utils` não pode mascarar buraco em `tracking`
- cobertura de UI não pode compensar ausência de testes no domínio
- cobertura de endpoint happy-path não pode ser tratada como prova de semântica protegida

---

## Scope

A policy cobre:

- `modules/process/**`
- `modules/container/**`
- `modules/tracking/**`
- `capabilities/**`
- `shared/**`

E exige leitura separada por:

- módulo
- camada
- área crítica

---

## Official Metrics

### 1. Macro metrics
Coletar em CI:

- global line coverage
- global branch coverage
- global function coverage
- global statement coverage

### 2. Coverage by module
Coletar separadamente:

- process
- container
- tracking
- capabilities
- shared

### 3. Coverage by architectural layer
Coletar separadamente:

- domain
- application
- infrastructure
- interface/http
- ui

### 4. Critical coverage
Manter visibilidade explícita para áreas canônicas:

#### Tracking
- observation
- series
- timeline
- status
- alerts

#### Critical behavioral checklist
A policy também exige checklist explícito de proteção para:

- fingerprint determinístico / idempotência
- ACTUAL vencendo EXPECTED
- ACTIVE_EXPECTED vs EXPIRED_EXPECTED
- EXPECTED redundante após ACTUAL
- conflito com múltiplos ACTUAL
- timeline derivada do histórico completo
- status derivado e monotônico quando possível
- alertas fact vs monitoring
- não supressão de conflitos

---

## Non-Goals

Esta policy não tem como objetivo inicial:

- impor threshold global alto imediatamente
- bloquear PRs por meta arbitrária sem baseline
- maximizar percentual a qualquer custo
- incentivar snapshots ou testes cosméticos apenas para inflar score

---

## Initial Enforcement Model

Na v0, a policy é de **instrumentação + observabilidade + anti-regressão básica**.

### Required now
- CI deve gerar report de coverage
- CI deve publicar breakdown por módulo
- CI deve publicar breakdown por camada
- baseline inicial deve ser capturado
- quedas relevantes devem ser visíveis e justificadas em PR

### Not required yet
- threshold global rígido
- gates agressivos por diretório
- changed-files threshold automático obrigatório

---

## Future Evolution

Após baseline estável, a policy pode evoluir para:

1. **anti-regressão formal**
   - impedir queda do baseline global
   - impedir queda do baseline de tracking crítico

2. **thresholds direcionados**
   - thresholds próprios para `modules/tracking/domain`
   - thresholds próprios para `modules/tracking/application`

3. **policy para arquivos alterados**
   - mudanças em semântica crítica devem vir com teste correspondente

---

## Consequences

### Positive
- coverage passa a refletir risco real
- maior foco em tracking crítico
- menos confiança falsa baseada em score global
- backlog de testes guiado por semântica e arquitetura
- melhor compatibilidade com boundaries oficiais

### Tradeoffs
- mais relatórios
- mais granularidade na leitura
- eventual necessidade de naming/convenções para mapear camadas com precisão
- coverage global fica menos “bonito” como KPI único

Esses tradeoffs são aceitáveis porque privilegiam auditabilidade e determinismo.

---

## Summary

O repositório passa a adotar uma policy em que:

- coverage global é secundário
- coverage por módulo e camada é obrigatório
- tracking crítico recebe prioridade explícita
- branch coverage de domínio crítico é a principal referência de confiança
- rollout começa por observabilidade, não por gate agressivo

## TL;DR

### Decisão
Adotar **Coverage Policy v0** orientada a risco arquitetural.

### Métrica principal
**Branch coverage de domínio crítico**, principalmente tracking.

### O que medir já
- global
- por módulo
- por camada
- áreas críticas de tracking

### O que não fazer
- perseguir percentual global cego
- mascarar buracos semânticos com testes baratos

### Próximo passo
Implementar instrumentação de coverage no CI e gerar baseline inicial.