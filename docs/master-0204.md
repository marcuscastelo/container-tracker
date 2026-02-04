# Container Tracker — Documento Mestre de Produto e Domínio

> Documento de onboarding para desenvolvedores, designers e assistentes LLM.
> Fonte única de verdade conceitual do produto.

---

## 1. Visão Geral do Produto

**Container Tracker** é um sistema B2B de rastreamento marítimo focado em **visibilidade operacional**, **detecção de exceções** e **honestidade de dados**.

O sistema consolida dados de múltiplos carriers (MSC, Maersk, CMA CGM etc.) em um **modelo canônico orientado a eventos**, tolerante a dados incompletos, retroativos ou inconsistentes.

### Princípios fundamentais

* O sistema **não inventa informação**.
* Incerteza é explícita.
* Exceções são mais importantes que o fluxo feliz.
* O domínio manda na UI.

---

## 2. Conceitos Fundamentais de Domínio

### Processo

Entidade de produto criada pelo usuário.

* Representa a **intenção de acompanhamento**.
* Não é um evento logístico.
* Pode existir sem BL, booking ou carrier.
* Agrupa um ou mais Shipments (no MVP: 1 processo = 1 shipment).

---

### Shipment

Entidade lógica/logística.

* Agrupador comercial.
* Possui origem e destino **planejados** (intenção).
* Contém **1 ou N containers**.
* Não possui eventos próprios.

---

### Container

Unidade operacional real.

* Possui número único (ISO 6346).
* Possui eventos.
* Possui timeline própria.
* Pode divergir de outros containers do mesmo shipment.

---

### Evento

Fato logístico imutável.

* Sempre ocorre em um tempo e local.
* Pode ser ACTUAL ou EXPECTED.
* Nunca é editado, apenas acrescido.

---

### Alerta

Derivação lógica baseada em eventos, estados e regras temporais.

* Pode ser descartado (dismiss).
* Pode expirar (TTL).
* Nunca altera eventos.

---

## 3. Arquitetura Orientada a Eventos

### Princípios

* Eventos são a **fonte da verdade**.
* Estados são sempre derivados.
* Eventos retroativos são permitidos.
* A ordem correta é:

```
Evento → Estado derivado → Alerta → UI
```

---

## 4. Roadmap Macro de Features

### F0 — Fundacional

* Modelo canônico de dados
* Persistência de eventos brutos
* Derivação de estados

### F1 — Criação Manual (MVP)

* Criar processo sem autenticação
* Associar 1 ou N containers
* UI funcional mesmo sem dados operacionais

### F2 — Timeline & Estados

* Timeline por container
* Suporte a eventos retroativos
* Estados derivados visíveis

### F3 — Alertas

* ETA, atraso, missing data
* Persistência pós-dismiss
* TTL e limpeza automática

### F4 — Integrações

* Sync com carriers
* Normalização de eventos

---

## 5. Estados Canônicos de Container

```ts
enum ContainerStatus {
  UNKNOWN
  AWAITING_DATA
  GATE_IN
  LOADED_ON_VESSEL
  DEPARTED
  IN_TRANSIT
  ARRIVED_AT_POD
  DISCHARGED
  CUSTOMS_HOLD
  CUSTOMS_RELEASED
  AVAILABLE_FOR_PICKUP
  DELIVERED
  EMPTY_RETURNED
  CANCELLED
}
```

---

## 6. Tipos Canônicos de Evento

```ts
enum EventActivity {
  GATE_IN
  GATE_OUT
  LOAD
  DISCHARGE
  DEPARTURE
  ARRIVAL
  CUSTOMS_HOLD
  CUSTOMS_RELEASE
  DELIVERY
  EMPTY_RETURN
  OTHER
}
```

```ts
enum EventTimeType {
  ACTUAL
  EXPECTED
}
```

---

## 7. Esquemas Human-Readable

### Processo

```
Process
- id
- reference?
- planned_origin?
- planned_destination?
- created_at
- containers[]
```

### Container

```
Container
- id
- container_number
- iso_type?
- events[]
```

### Event

```
Event
- id
- activity
- event_time
- event_time_type (ACTUAL | EXPECTED)
- location
- vessel?
- voyage?
- source_payload
```

---

## 8. Regras de Derivação de Dados

### Status do Container

```
if no events → AWAITING_DATA
else last relevant event defines status
```

### ETA do Container

```
ETA = last EXPECTED arrival/delivery event
```

### Status do Shipment

```
if all containers AWAITING_DATA → AWAITING_DATA
if any container delayed → DELAYED
else → IN_PROGRESS
```

### ETA do Shipment

```
ETA = max(container ETAs)
```

---

## 9. Alertas

### Categorias

```
ETA
MOVEMENT
CUSTOMS
STATUS
DATA
```

### Severidade

```
INFO
WARNING
DANGER
SUCCESS
```

### Persistência

* Alertas são armazenados separadamente
* Podem ser dismissados
* Possuem TTL
* São apagados quando o processo é apagado

---

## 10. Dashboard (Home)

### Cada linha representa

* 1 processo

### Campos derivados

* Origem → Destino: intenção
* Containers: count
* Status: agregado
* ETA: derivada

---

## 11. Shipment View

* Sempre focada em 1 container por vez
* Timeline é a fonte da verdade
* Alertas são contextuais

---

## 12. Princípios de UX

* Dense-first
* Desktop-first
* Sem wizard
* Incerteza visível
* Power users não penalizados

---

## 13. Regra de Ouro

> O sistema nunca deve esconder dados ausentes ou inventar estados.

---

## 14. Para Novos Devs / LLMs

Antes de implementar qualquer feature:

1. Pergunte: isso é evento ou estado?
2. Pergunte: isso é intenção ou observação?
3. Pergunte: isso pode estar ausente?

Se alguma resposta for ignorada, a feature provavelmente está errada.

---

Fim do Documento Mestre
