# Modelo de Persistência — Snapshots, Observações e Derivações

Este documento descreve o **modelo de dados recomendado** para o Container Tracker considerando:

* APIs externas inconsistentes
* Persistência por **snapshots imutáveis**
* Derivação controlada de observações, status e alertas
* MVP simples, mas sem becos sem saída arquiteturais

---

## Visão Geral (camadas)

```
[External Carrier API]
        ↓
container_tracking_snapshots   (fatos brutos, imutáveis)
        ↓
container_observations         (deduplicação e memória)
        ↓
status / timeline / alerts     (DERIVADOS, não-fonte)
```

---

## 1. processes

Representa o **Processo / Shipment** (aggregate root).

```sql
processes
---------
id UUID PK

client_id UUID NULL

importer_name TEXT NULL
exporter_name TEXT NULL
ref_castro TEXT NULL
ref_imp TEXT NULL

origin_port_code TEXT NULL
destination_port_code TEXT NULL

bill_of_lading TEXT NULL
booking_number TEXT NULL

created_at TIMESTAMP NOT NULL
archived_at TIMESTAMP NULL
```

Notas:

* Origem/destino são **intenção comercial**, não derivadas de containers
* BL e Booking são campos distintos
* `archived_at` = soft delete

---

## 2. containers

Container físico associado a um processo.

```sql
containers
----------
id UUID PK
process_id UUID FK → processes.id

container_number TEXT NOT NULL
carrier_code TEXT NOT NULL

container_type TEXT NULL
container_size TEXT NULL

created_at TIMESTAMP NOT NULL
removed_at TIMESTAMP NULL
```

Constraints recomendadas:

* UNIQUE(process_id, container_number)
* CHECK(container_number ~ ISO6346 regex) **(warning na UI, não erro)**

---

## 3. container_tracking_snapshots (CRÍTICO)

Snapshot imutável de uma chamada à API externa.

```sql
container_tracking_snapshots
----------------------------
id UUID PK
container_id UUID FK → containers.id

carrier_code TEXT NOT NULL
fetched_at TIMESTAMP NOT NULL

raw_payload JSONB NOT NULL
```

Regras:

* Apenas INSERT (append-only)
* Nunca atualizar ou deletar
* Fonte primária de verdade externa

Índices:

* INDEX(container_id, fetched_at DESC)

---

## 4. container_observations (memória normalizada)

Representa **observações detectadas** a partir dos snapshots.

```sql
container_observations
----------------------
fingerprint TEXT PK

container_id UUID FK → containers.id

activity_code TEXT NOT NULL
event_time TIMESTAMP NOT NULL
location_code TEXT NULL

first_seen_at TIMESTAMP NOT NULL
last_seen_at TIMESTAMP NOT NULL

source_snapshot_id UUID FK → container_tracking_snapshots.id
```

Notas importantes:

* fingerprint = hash(activity + event_time + location + carrier)
* Se um carrier apagar um evento, a observation **permanece**
* `last_seen_at` ajuda a entender flapping / inconsistência

---

## 5. container_events (opcional no MVP)

Eventos de **domínio**, derivados pelo sistema.

```sql
container_events
----------------
id UUID PK
container_id UUID FK → containers.id

event_type TEXT NOT NULL

event_time TIMESTAMP NOT NULL

source ENUM('derived', 'manual', 'system')

derived_from_fingerprint TEXT NULL
created_at TIMESTAMP NOT NULL
```

Regra:

* Não vêm direto da API
* Sempre gerados por regras internas

---

## 6. alerts

Alertas operacionais derivados.

```sql
alerts
------
id UUID PK
container_id UUID FK → containers.id

alert_type TEXT NOT NULL
severity ENUM('info', 'warning', 'critical')

status ENUM('active', 'acked', 'dismissed')

triggered_at TIMESTAMP NOT NULL
acked_at TIMESTAMP NULL
dismissed_at TIMESTAMP NULL

related_observation_fingerprint TEXT NULL
```

Notas:

* Alertas são **estado**, não fatos
* Podem ser recalculados
* Ack/Dismiss persistem decisão do usuário

---

## 7. (Opcional) alert_notifications

Controle de e-mails enviados.

```sql
alert_notifications
-------------------
id UUID PK
alert_id UUID FK → alerts.id

channel ENUM('email')
sent_at TIMESTAMP NOT NULL
```

Evita spam e duplicações.

---

## Relacionamentos (resumo)

```
processes
  └── containers
        └── container_tracking_snapshots
        └── container_observations
        └── container_events (opcional)
        └── alerts
              └── alert_notifications
```

---

## Regras de Ouro

* Snapshots são fatos externos imutáveis
* Observations são memória técnica
* Eventos e alertas são **opinião do sistema**
* Nunca confiar na API como fonte histórica
* Timeline pode ser 100% derivada no MVP

---

## Próximo passo natural

* Definir algoritmo de diff snapshot → observations
* Definir fingerprints canônicos
* Desenhar motor P0.1 em cima **desse modelo**, não o contrário
