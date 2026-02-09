# Roadmap Técnico — v2 (Consolidado)

Este roadmap consolida **todas as decisões, ideias, feedbacks de cliente e discussões técnicas** até o momento. Ele é orientado a **execução**, não apenas visão. Cada fase descreve objetivos claros, entregáveis verificáveis e critérios de aceite.

---

## Princípios não-negociáveis (válidos para todo o roadmap)

* APIs externas **não são confiáveis** como source of truth
* Snapshots são **imutáveis** e sempre persistidos
* Observations são fatos semânticos, idempotentes, deduplicáveis
* Status é **projeção monotônica** (não regride)
* Alertas são derivados, auditáveis e explicáveis
* UI **nunca** deriva domínio
* Tipagem forte (sem `any`, sem `as`)

---

## FASE 0 — Fundação Canônica (invisível, obrigatória)

### F0.1 — Modelo Canônico Executável (DONE)

**Objetivo**
Estabelecer o vocabulário único do sistema.

**Inclui**

* Schemas canônicos (Shipment, Container, Snapshot, Observation, Alert)
* Zod schemas para payloads externos
* Exemplos reais de carriers (Maersk, MSC, CMA CGM)

**Critério de aceite**

* Todo payload externo valida ou gera `Alert[data]`

---

### F0.2 — Motor Canônico de Derivação (PRIORIDADE MÁXIMA)

**Objetivo**
Converter dados inconsistentes em verdade operacional confiável.

**Entregas**

* Funções puras:

  * `normalizeSnapshot → ObservationDraft[]`
  * `diffObservations(prev, curr) → Observation[]`
  * `deriveTimeline(observations)`
  * `deriveStatus(timeline)`
  * `deriveAlerts(timeline, status)`
* Suíte de testes de domínio (golden tests)

**Regras chave**

* Diff ocorre na Application layer
* Adapters não mantêm estado
* Fingerprint por tipo de Observation

---

## FASE 1 — Existência Operacional (habilitantes)

### F1.1 — Criação Manual de Shipment / Containers (DONE)

* CreateProcessDialog
* Validações (ISO 6346 como warning)
* Persistência no banco

---

### F1.2 — Criação Manual de Eventos (PARTIAL)

**Objetivo**
Permitir input humano quando APIs falham.

**Entregas**

* Form de evento manual
* Flag `source = manual`
* Eventos manuais nunca sobrescrevem automáticos

---

## FASE 2 — Visualização Operacional

### F2.1 — Dashboard Operacional

**Entregas**

* Tabela de Shipments
* Containers: mostrar 1º ID + badge +N
* Ícone do armador
* Status, ETA, alert count

---

### F2.2 — Timeline Canônica

**Entregas**

* Ordenação por event_time
* ACTUAL vs EXPECTED
* Buracos explícitos
* Links para site do carrier

---

## FASE 3 — Alertas (foco do cliente)

### F3.1 — Alertas Fact-based (transbordo prioritário)

**Inclui**

* Detecção de transbordo
* Alertas retroativos permitidos
* Marcação como histórico
* Campos: detected_at, triggered_at

---

### F3.2 — Alertas Monitoring

**Inclui**

* Sem movimento X dias
* Sem ETA
* Monitoring não retroativo

---

### F3.3 — Gestão de Alertas

* Ack / Dismiss
* Undo temporário
* Visualização de alertas históricos

---

## FASE 4 — Notificações

### F4.1 — Email Alerts (MVP)

* Envio de alertas fact por email
* Configurável no futuro

---

## FASE 5 — Busca, Power-User e Produtividade

### F5.1 — Ctrl+K Command Palette

* Busca global
* Ações rápidas (novo processo, favoritos)

---

### F5.2 — Exportações

* Static export (metadata)
* Full export (events, alerts)
* CSV / JSON / PDF

---

## FASE 6 — Confiabilidade e Operação

### F6.1 — Observabilidade

* Sentry / OTel
* Alertas internos de quebra de schema

---

### F6.2 — Data Quality Layer

* Alertas de inconsistência
* Auditoria de adapters

---

## FASE 7 — Débito Técnico e Refino

* Centralizar clipboard utils
* Refatorar CreateProcessDialog
* Mover parsing pesado para camada de dados
* Consolidar mappers duplicados

---

## Roadmap resumido (priorização)

1. **F0.2 — Motor de Derivação**
2. **F3.1 — Alertas de Transbordo**
3. **F2.2 — Timeline confiável**
4. **F4.1 — Email alerts**
5. **F5 — Power-user features**

---

Este roadmap é o **contrato técnico do projeto**. Qualquer nova feature deve se encaixar nele ou justificar claramente sua exceção.
