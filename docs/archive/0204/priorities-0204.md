# Próximos Passos — Priorização Integrada

Este documento consolida **prioridades práticas** do produto Container Tracker, integrando:

* Roadmap técnico
* Feedback real de uso
* Ideias exploratórias
* Débitos técnicos

objetivo é servir como **guia simples de acompanhamento**, mantendo clareza do *porquê* de cada item.

---

## 🔴 P0 — Fundamentação Crítica (bloqueia evolução segura)

> Sem isso, qualquer feature nova aumenta risco e retrabalho.

### P0.1 — Motor Canônico de Derivação (F0.2)

**Objetivo**: Tornar explícita e testável semântica do sistema.

**Entregáveis**:

* `deriveContainerState(events[])`
* `deriveShipmentSummary(containers[])`
* Testes unitários com eventos reais (retroativos, buracos, conflitos)

**Desbloqueia**:

* Alertas confiáveis
* Timeline consistente
* Dashboard sem gambiarras

---

### P0.2 — Normalização definitiva da camada de dados

**Problema atual**: UI e rotas fazem parsing/enrichment demais.

**Ações**:

* Mover parsing/enrichment para adapters/data layer
* Eliminar lógica de domínio na UI
* Tornar tudo testável

**Relacionado ao débito técnico**:

* ShipmentView / Dashboard / routes com lógica duplicada

---

## 🟠 P1 — Operação Real (primeiro uso sério)

> Aqui sistema começa *trabalhar* para usuário.

### P1.1 — Registro Manual de Eventos (F1.2)

**Objetivo**: Permitir correção/adição de fatos operacionais.

**Regras de domínio**:

* Evento tem `source: manual | carrier`
* Eventos manuais não sobrescrevem carrier
* Alertas gerados com cautela (ou não gerados)

---

### P1.2 — Alertas: regras + gestão (F3.1 + F3.2)

**Inclui**:

Pedido do cliente:
* Transbordo como subcategoria
* Severidade diferenciada
* Visual distinto

Outros:
* Alertas de long periods sem movement (ex: 7 dias)
* Ack/dismiss por alerta (inclusive estruturais: sem ETA)
* Seção separada para alertas dismissed (auditoria)
* Undo básico (curto prazo) para ack/dismiss

**Não objetivo agora**:

* Sistema complexo de snooze recorrente

---

### P1.3 — Timeline confiável

**Ajustes necessários**:

* Ordem garantida por `event_time`
* Diferenciar ACTUAL vs EXPECTED
* Buracos explícitos (não inferidos)
* Links para fonte original do carrier (URL salva no banco) (falta migrar url para banco, está hardcoded hoje)

---

## 🟡 P2 — UX de Eficiência (power users)

> Aqui produto começa *encantar*.

### P2.1 — Busca global (Ctrl + K)

**Escopo inicial**:

* Buscar por container, process ID, BL, cliente, origem/destino, status
* Ações rápidas: novo processo, recentes, favoritos

---

### P2.2 — Dashboard mais escaneável

**Melhorias**:

* Exibir 1º container + badge `+N`
* Hover com lista completa
* Ícone do armador (carrier) na tabela e ShipmentView

---

### P2.3 — UX defensiva

* Warning ao fechar CreateProcessDialog com dados preenchidos
* ISO 6346 como warning (não bloqueio) + badge amarelo

---

## 🟢 P3 — Exportação, Auditoria e Confiança

### P3.1 — Exports

**Tipos**:

1. Static export (metadata estável)
2. Full export (eventos, alertas, estados)

**Formatos**:

* CSV, PDF, XLSX, JSON, key-value style

### P3.1a - Delivery de alertas via email (MVP)

- Canal UI (default)
- Canal Email (MVP, decidir: alertas críticos, resumo diário, etc)

---

### P3.2 — Observabilidade & confiabilidade

* Telemetria (Sentry / OTel)
* Validação server-side de payload vs schema
* Notificação automática ao dev quando adapter quebra
* Considerar LGPD: anonimização / consentimento

---

## 🔵 P4 — Evolução de Domínio

### P4.1 — Dados adicionais solicitados

* Nome do importador
* Exportador
* Ref. Castro / Ref. Imp
* Tipo e tamanho do container (preferencialmente do carrier)

---

### P4.2 — Limpeza conceitual

* Separar Booking Number e Bill of Lading (BL)
* Renomear BL para `Bill of Lading (BL)` em toda UI
* Locale i18n para alertas (não strings fixas no DB)

---

## ⚫ P5 — Gestão de ciclo de vida

### P5.1 — Delete / Archive

**Perguntas responder**:

* Soft delete vs hard delete
* Archive como estado?
* TTL automático (shipment apagado → alertas apagados)

---

## 🛠️ Débito Técnico (contínuo)

* Deduplicar clipboard utils (CopyButton / ShipmentView)
* Refatorar CreateProcessDialog para hook/componente reutilizável
* Melhorar check de container existente (erro explícito vs genérico)
* Revisar mappers duplicados / APIs deprecated

---

## Regra de ouro de priorização

> **Nada novo entra se quebrar semântica central.**

Se item não respeita:

* evento ≠ estado
* intenção ≠ observação
* ausência explícita ≠ inferência

Ele não entra.

---

Este documento deve ser atualizado conforme itens migram de P0 → P1 → P2 → P3 → P4 → P5.
