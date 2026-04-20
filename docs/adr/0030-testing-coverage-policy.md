# ADR — Coverage Policy v0

- Status: Proposed
- Date: 2026-04-10
- Owner: Repository maintainers

## Context

repositório precisa começar metrificar coverage, mas número global isolado não é suficiente para representar segurança operacional real.

No Container Tracker:

- verdade canônica vive no domínio, especialmente em `tracking`
- `tracking` é responsável por interpretação semântica de eventos, séries, timeline, status e alerts
- UI, routes e capabilities consomem essa verdade, mas não podem rederivá-la
- portanto, coverage útil precisa refletir risco arquitetural e semântico, não quantidade de linhas executadas

Sem essa distinção, repositório corre risco de:

- inflar coverage com testes baratos de utilitários ou UI cosmética
- manter baixo coverage nas regras canônicas mais sensíveis
- criar falsa sensação de segurança
- premiar volume de testes em vez de proteção de invariantes

---

## Decision

Adotar **Coverage Policy v0** orientada risco arquitetural.

policy passa tratar coverage em três níveis:

1. **Coverage macro**
   - line / branch / function / statement globais
   - usado para tendência e anti-regressão grosseira

2. **Coverage estrutural**
   - report por bounded context / capability
   - report por camada arquitetural

3. **Coverage crítico**
   - foco explícito nas áreas canônicas do tracking e demais fluxos operacionais relevantes

métrica principal do projeto passa ser:

**branch coverage do domínio crítico**, com prioridade para:

- `modules/tracking/domain`
- `modules/tracking/application`

Coverage global continua existindo, mas deixa de ser métrica principal de confiança.

---

## Rationale

Essa decisão existe para alinhar metrificação de testes com arquitetura oficial do projeto.

Como tracking é dono de:

- normalização de observations
- grouping/classification de series
- safe-first primary selection
- interpretação ACTUAL vs EXPECTED
- derivação de timeline
- derivação de status
- derivação de alerts

é nessa camada que regressão semântica traz mais risco operacional.

Logo:

- cobertura de `shared/utils` não pode mascarar buraco em `tracking`
- cobertura de UI não pode compensar ausência de testes no domínio
- cobertura de endpoint happy-path não pode ser tratada como prova de semântica protegida

---

## Scope

policy cobre:

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
policy também exige checklist explícito de proteção para:

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
- maximizar percentual qualquer custo
- incentivar snapshots ou testes cosméticos para inflar score

---

## Initial Enforcement Model

Na v0, policy é de **instrumentação + observabilidade + anti-regressão básica**.

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

Após baseline estável, policy pode evoluir para:

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
- coverage passa refletir risco real
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

repositório passa adotar policy em que:

- coverage global é secundário
- coverage por módulo e camada é obrigatório
- tracking crítico recebe prioridade explícita
- branch coverage de domínio crítico é principal referência de confiança
- rollout começa por observabilidade, não por gate agressivo

## TL;DR

### Decisão
Adotar **Coverage Policy v0** orientada risco arquitetural.

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