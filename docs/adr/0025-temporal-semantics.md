# ADR-0025 — Temporal Semantics: Instant vs CalendarDate

## Status
Proposed

---

## Context

O sistema atual apresenta inconsistências críticas relacionadas a tempo, afetando diretamente a confiabilidade operacional.

### Sintomas observados

- Divergência entre replay e UI (ex: ETA diferente)
- Datas “mudando” sem mudança real de dado (efeito de timezone)
- Histórico de previsões sem granularidade suficiente (falta de horário)
- Comportamento inconsistente entre diferentes partes do sistema

### Causa raiz

Uso difuso e não controlado de:

```ts
new Date(...)
new Intl.DateTimeFormat(...)
```

Combinado com:

- parsing implícito de strings ISO
- heurísticas frágeis (ex: `00:00:00` → date-only)
- ausência de distinção semântica entre:
  - instante real
  - data civil
- lógica temporal espalhada por:
  - UI
  - mappers
  - persistence
  - normalizers
  - read models

### Violação arquitetural

- UI interpretando semântica de domínio
- perda de determinismo (dependência de timezone do ambiente)
- ausência de tipos canônicos para tempo
- dificuldade para LLMs manterem consistência

---

## Decision

Adotar um modelo explícito de tempo baseado em dois tipos fundamentais:

### 1. `Instant`
Representa um ponto absoluto no tempo (timestamp real).

### 2. `CalendarDate`
Representa uma data civil (sem timezone, sem horário).

---

## Design

### Tipos canônicos

```ts
class Instant {
  static fromEpochMs(ms: number): Instant
  static fromIso(iso: string): Instant
  static now(): Instant

  toEpochMs(): number
  toIsoString(): string

  compare(other: Instant): number

  toCalendarDate(timezone: IanaTimezone): CalendarDate
}
```

```ts
class CalendarDate {
  static fromIsoDate(iso: string): CalendarDate

  toIsoDate(): string

  compare(other: CalendarDate): number

  startOfDay(timezone: IanaTimezone): Instant
  endOfDay(timezone: IanaTimezone): Instant
}
```

---

### Modelo de ETA

```ts
type Eta =
  | { kind: 'date'; value: CalendarDate }
  | { kind: 'instant'; value: Instant }
```

Regra:

- Carrier sem horário → `CalendarDate`
- Carrier com horário → `Instant`

---

### Operações cruzadas (explícitas)

```ts
function isInstantInCalendarDate(
  instant: Instant,
  date: CalendarDate,
  timezone: IanaTimezone,
): boolean
```

```ts
function compareTemporal(
  a: Instant | CalendarDate,
  b: Instant | CalendarDate,
  options: {
    timezone: IanaTimezone
    strategy: 'start-of-day' | 'end-of-day'
  },
): number
```

---

## Regras obrigatórias

### 1. Proibição de `Date` fora de `shared/time`

```ts
new Date(...) ❌
```

Permitido apenas em:

```
shared/time/**
```

---

### 2. Proibição de `Intl.DateTimeFormat` fora de `shared/time`

---

### 3. Proibição de parsing implícito

```ts
new Date("2026-03-21") ❌
```

---

### 4. Sem inferência temporal

Nunca inferir:

- `00:00:00` → date-only
- ausência de horário → instant

---

### 5. Comparação heterogênea exige contexto

Sempre exigir:

- timezone
- strategy (`start-of-day` | `end-of-day`)

---

### 6. UI não interpreta tempo

UI:

- apenas renderiza
- não converte semântica
- não decide timezone implícito

---

## Enforcement

### ESLint

```json
{
  "no-restricted-globals": ["error", "Date"],
  "no-restricted-syntax": [
    {
      "selector": "NewExpression[callee.name='Date']",
      "message": "Use Instant or CalendarDate"
    },
    {
      "selector": "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']",
      "message": "Use shared/time formatters"
    }
  ]
}
```

---

## Consequences

### Positivas

- Consistência entre replay, backend e UI
- Eliminação de bugs de timezone
- Maior clareza semântica
- Melhor suporte para LLMs (menos ambiguidade)
- Código mais auditável

---

### Negativas

- Custo de migração inicial
- Necessidade de disciplina arquitetural
- Maior verbosidade em comparações heterogêneas

---

## Scope

Afeta:

- `tracking` (derivação de timeline, ETA, alerts)
- `process` (UI, viewmodels, projections)
- `container`
- `capabilities` (dashboard, search)
- `shared` (criação do módulo `time`)

---

## Migration Strategy

### Fase 1 — Infraestrutura
- Criar `shared/time`
- Implementar `Instant` e `CalendarDate`

### Fase 2 — Novos fluxos
- Novas features usam apenas os novos tipos

### Fase 3 — Hotspots
Refatorar:

- `formatDate.ts`
- `parseDate.ts`
- ETA UI
- Prediction history
- Timeline rendering
- Carrier normalizers

### Fase 4 — Enforcement
- Ativar ESLint
- Remover usos antigos

---

## Alternatives Considered

### 1. Manter `Date` + helpers
Rejeitado:
- mantém ambiguidade
- não resolve timezone bugs

### 2. Usar biblioteca externa (ex: Temporal API, Luxon)
Rejeitado:
- excesso de abstração
- perda de controle semântico
- não resolve distinção de domínio

---

## Alignment with Domain Principles

- Preserva determinismo
- Evita inferência implícita
- Expõe incerteza (CalendarDate vs Instant)
- Mantém domínio como fonte da verdade
- Evita lógica na UI

---

## Final Decision

Adotar `Instant` e `CalendarDate` como únicos tipos temporais canônicos, com:

- operações explícitas
- proibição de APIs nativas fora de `shared/time`
- enforcement via ESLint

Essa decisão é mandatória para garantir consistência operacional e evitar regressões futuras.