# Project Structure — Container Tracker (2026-02-04)

Este documento define **estrutura oficial do projeto** seguindo **DDD (Domain‑Driven Design)**, alinhada aos **bounded contexts mapeados**, às decisões de produto e às necessidades práticas do Container Tracker.

Ele serve como:

* fonte única de verdade estrutural
* guia de onboarding para novos devs / LLMs
* referência para refactors e PR reviews

> **Regra de ouro:**
> Se você não sabe onde colocar arquivo, problema não é estrutura — é falta de clareza de domínio.

---

## 1. Estrutura Base do `src/`

```txt
src/
├─ modules/                # Núcleo de domínio (DDD)
│  ├─ process/
│  ├─ container/
│  ├─ event-timeline/
│  ├─ status-derivation/
│  ├─ alerting/
│  ├─ carrier-integration/
│  ├─ notification/
│  ├─ read-models/
│  └─ search/
│
├─ shared/                 # Cross-cutting (não-domínio)
│  ├─ domain/              # ValueObjects genéricos (DateRange, Pagination)
│  ├─ utils/               # Helpers puros
│  ├─ types/               # Tipos globais
│  ├─ i18n/                # Chaves de tradução
│  └─ telemetry/           # Observabilidade
│
├─ routes/                 # SolidStart (controllers)
├─ components/             # UI pura
├─ styles/
└─ env.ts
```

### Observações importantes

* `modules/` **nunca importa UI**
* `components/` **nunca conhece domínio**
* `routes/` orquestram chamadas de `application`

---

## 2. Estrutura padrão de um módulo

Todo módulo DDD segue **exatamente mesmo shape**, mesmo que alguns diretórios comecem vazios.

```txt
src/modules/<contexto>/
├─ domain/
│  ├─ entities.ts          # Entidades (identidade forte)
│  ├─ value-objects.ts     # Objetos de valor
│  ├─ enums.ts             # Estados, tipos, categorias
│  ├─ invariants.ts        # Regras sempre verdadeiras
│  └─ errors.ts            # Erros de domínio
│
├─ application/
│  ├─ commands/            # Intenções que mutam estado
│  ├─ queries/             # Leitura (quando não é read-model)
│  ├─ services/            # Orquestrações
│  └─ ports.ts             # Interfaces (repos, gateways)
│
├─ infrastructure/
│  ├─ persistence/         # DB, Supabase, SQL
│  ├─ adapters/            # APIs externas
│  ├─ repositories.ts
│  └─ mappers.ts
│
├─ index.ts                # API pública do módulo
└─ README.md               # Contexto e decisões
```

### Convenções

* **domain nunca importa application**
* **application nunca importa UI ou DB direto**
* **infrastructure nunca contém regra de negócio**

---

## 3. Módulos por Bounded Context

### 3.1 Process Management

`modules/process/`

Responsável pela **existência e metadados** do Shipment (processo).

```txt
domain/
  Shipment.ts
  ShipmentMeta.ts
application/
  commands/CreateShipment.ts
  commands/UpdateShipmentMeta.ts
```

**Invariantes:**

* Shipment pode existir incompleto
* Shipment **não tem status**

---

### 3.2 Container Management

`modules/container/`

```txt
domain/
  Container.ts
  ContainerNumber.ts
application/
  commands/AddContainerToShipment.ts
  commands/RemoveContainerFromShipment.ts
```

**Observações:**

* ISO 6346 é **warning**, não erro fatal
* Container sempre pertence Shipment

---

### 3.3 Event Timeline (Core)

`modules/event-timeline/`

```txt
domain/
  CanonicalEvent.ts
  EventType.ts
  EventSource.ts
application/
  commands/AppendEvents.ts
  queries/GetTimeline.ts
```

**Regras duras:**

* Eventos são imutáveis
* `event_time` manda
* `raw_payload` sempre preservado

---

### 3.4 Status Derivation (P0.1)

`modules/status-derivation/`

```txt
domain/
  ContainerStatus.ts
  DerivedContainerState.ts
application/
  deriveContainerState.ts
  deriveProcessSummary.ts
```

**Características:**

* Funções puras
* Zero DB
* Totalmente testável

---

### 3.5 Alerting

`modules/alerting/`

```txt
domain/
  Alert.ts
  AlertCategory.ts
  AlertSeverity.ts
application/
  GenerateAlerts.ts
  AcknowledgeAlert.ts
  ExpireAlerts.ts
```

**Notas de produto:**

* Foco forte em **transbordo**
* Alertas de long periods sem movimento
* Alertas são re-deriváveis

---

### 3.6 Carrier Integration (ACL)

`modules/carrier-integration/`

```txt
infrastructure/
  maersk/
    adapter.ts
    mapper.ts
    schema.ts
  msc/
  cmacgm/
```

**Regras:**

* Nenhuma lógica de domínio
* Falha de schema → alerta interno dev

---

### 3.7 Notification

`modules/notification/`

```txt
application/
  SendAlertEmail.ts
infrastructure/
  email/
```

**Nota:** entrega mensagens

---

### 3.8 Read Models / Dashboard

`modules/read-models/`

```txt
application/
  BuildDashboardView.ts
  BuildShipmentView.ts
```

**Características:**

* Read-only
* Pode duplicar dados
* Pode ser reconstruído

---

### 3.9 Search

`modules/search/`

```txt
application/
  SearchProcesses.ts
  SearchContainers.ts
```

Usado por Ctrl+K, filtros e power users.

---

## 4. O que NÃO é domínio

* UI
* Auth / Billing
* BI pesado

Esses consomem domínio, mas não definem.

---

## 5. Regras de Arquitetura (Checklist de PR)

* [ ] Domínio sem dependências externas
* [ ] Status só derivado no status-derivation
* [ ] Eventos nunca apagados
* [ ] Infra sem regra de negócio
* [ ] Read-models só leitura

---

## 6. Regra Final

> Se regra começa aparecer em mais de módulo,
> ela está no lugar errado.

Este documento deve evoluir junto com produto — nunca depois.
