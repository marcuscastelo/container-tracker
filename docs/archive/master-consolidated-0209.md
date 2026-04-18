# Container Tracking Platform — Master Technical & Product Document (0209)

> Documento unificado e canônico do projeto.
> Destinado: novos devs, assistentes LLM, revisão arquitetural e alinhamento produto–engenharia.
> Este arquivo **substitui** e **absorve** documentos anteriores, sem depender da estrutura ou nomenclatura antiga.

---

## 1. Visão Geral do Produto

Plataforma de tracking de containers multi-armador (CMA CGM, Maersk, MSC, etc.) com foco em:

* confiabilidade de dados mesmo com APIs inconsistentes
* visibilidade operacional (timeline, status, alertas)
* UX limpa, moderna e explicável
* base sólida para evolução (alertas, emails, auditoria, integrações)

sistema **não confia em eventos crus das APIs**. Ele coleta snapshots, deriva fatos, estados e alertas internamente.

---

## 2. Conceitos Fundamentais (Domínio)

### 2.1 Shipment (Processo)

Representa processo logístico único, criado manualmente pelo usuário.

* Pode conter **1..N containers**
* É unidade principal de organização e dashboard
* Campos principais:

  * client_name
  * importer_name
  * exporter_name
  * refs (Castro, Imp, internas)
  * Bill of Lading (BL)
  * Booking Number

> Shipment ≠ Container. Shipment **agrega** containers.

---

### 2.2 Container

Entidade física rastreável.

* Identificado por container_number (ISO 6346 *não obrigatório*)
* Pertence exatamente 1 Shipment
* Origem, destino, ETA e status **são derivados**, não inseridos manualmente

---

### 2.3 Snapshot (Fonte da Verdade Externa)

Cada chamada API externa gera **snapshot imutável**.

* Não é evento
* Não é status
* É: " que API retornou naquele momento"

Motivação:

* APIs podem apagar eventos
* APIs podem reordenar histórico
* APIs podem mudar sem aviso

> Nunca confiamos que API seja event stream consistente.

---

### 2.4 Observation (Fato Normalizado)

Resultado da normalização de snapshots.

Exemplos:

* "container foi carregado em navio X no porto Y"
* "container chegou ao porto Z"

Observations:

* são idempotentes
* são deduplicáveis
* são internas

Definição operacional (importante):

* Observation representa fato semântico normalizado derivado de ou mais registros brutos do carrier — é unidade de verdade (C), não verbatim event () nem estado técnico (B).
* Observations são frases/tuplas semânticas (ex.: "LOADED_on_vessel_X_at_port_Y") que permitem raciocínio e comparações determinísticas.
* Observations devem incluir fingerprint determinístico que permita deduplicação segura. fingerprint deve ser calculado partir dos campos semânticos relevantes e deve ignorar campos instáveis (ex.: event_id do carrier, timestamps de ingestão, campos de debug).
* Observations preservam payload raw referenciado (link para snapshot) e armazenam metadados de confiança/uncertainty quando aplicável.

---

### 2.5 Timeline

Sequência ordenada de Observations.

* Pode conter ciclos (LOAD → DISCHARGE → LOAD)
* Transbordo é natural
* Timeline **não impõe linearidade**

---

### 2.6 Status

Status é **projeção colapsada**, derivada da timeline.

Princípios:

* Status **não volta**
* É calculado por dominância semântica
* Representa estágio mais avançado relevante

Exemplos:

* IN_TRANSIT
* ARRIVED_AT_POD
* DISCHARGED

Nota importante: Timeline pode repetir, voltar ou conter sinais contraditórios (por exemplo em backfills ou APIs inconsistentes). Isso é aceitável. Status, por definição, é monotônico (não volta) — contraste entre Timeline (histórico de fatos) e Status (projeção) deve ser preservado e exibido claramente na UI.

---

### 2.7 Transbordo

Transbordo **não é status**.

É atributo derivado:

* hasTransshipment: boolean
* transshipmentCount: number

Usado para:

* alertas
* badges
* compliance

---

## 3. Alertas

### 3.1 Tipos de Alertas

Divisão **não negociável**:

#### A) Alertas de Fato (fact-based)

* Transbordo ocorrido
* Customs hold
* Mudança de porto final

Características:

* Podem ser retroativos
* Disparam no onboarding
* Importantes para compliance

Regra de contenção para retroatividade (MVP):

* Alertas retroativos serão permitidos para alertas do tipo "fact". Alertas de monitoring NÃO devem ser gerados retroativamente.
* Alertas retroativos devem ser marcados com metadado `retroactive: true` e rótulo `historical` na UI para evitar confusão e spam. Implementações futuras podem oferecer filtros/compactação para backfills.

#### B) Alertas de Monitoramento (monitoring)

* No movement há X dias
* ETA atrasado

Características:

* Não retroativos
* Baseados em tempo
* Evitam spam inicial

---

### 3.2 Persistência de Alertas

Campos principais:

* alert_type
* category: fact | monitoring
* detected_at
* triggered_at
* acked_at
* dismissed_at

Regras:

* Alertas fact disparam vez
* Alertas monitoring podem reaparecer
* Ack/Dismiss é persistido
* Undo opcional no futuro

---

### 3.3 Email Alerts (MVP)

* Enviar emails para alertas fact
* Inicialmente: enviar todos
* Futuro: configurável por usuário

---

## 4. Algoritmo Central — Snapshot → Observations → Status/Alerts

### 4.1 Pipeline Geral

```
API Response
   ↓
Snapshot (persistido)
   ↓
Normalize → Observations
   ↓
Merge com histórico
   ↓
Derive Timeline
   ↓
Derive Status
   ↓
Derive Alerts
```

---

### 4.2 Diff de Snapshots

Pseudocódigo:

```
prev = lastSnapshot
curr = currentSnapshot

prevObs = normalize(prev)
currObs = normalize(curr)

newObs = currObs - prevObs

persist(newObs)
```

* Deduplicação por fingerprint
* Nunca removemos observações antigas

#### 4.2.1 Fingerprint e deduplicação (regras)

* Cada Observation deve expor `fingerprint` determinístico usado para deduplicação e comparações.
* fingerprint NÃO é hash do snapshot completo. Deve ser derivado dos campos semânticos relevantes (por exemplo: tipo de observation, container_number, porto, vessel, event_datetime normalizado) e explicitamente ignorar campos instáveis (ex.: event_id do carrier, ingest_timestamp, debug).
* Fingerprints devem ser estáveis entre execuções e independentes de metadados de ingestão.
* deduplicação é feita comparando fingerprints; quando fingerprint novo aparece, persiste-se Observation e linka-se ao snapshot de origem.
* Em caso de dúvida (fingerprint collision ou campos conflitantes), preservar ambos registros e criar `Alert[data]` indicando conflito para revisão humana.

---

### 4.3 Derivação de Status

```
if delivered → DELIVERED
else if discharged_at_final → DISCHARGED
else if arrived_at_final → ARRIVED_AT_POD
else if any_departure → IN_TRANSIT
else if any_load → LOADED
else → IN_PROGRESS
```

---

### 4.4 Derivação de Transbordo

```
ports = unique ports of LOAD/DISCHARGE
if ports.length > 2:
  hasTransshipment = true
  count = ports.length - 2
```

---

### 4.5 Derivação de Alertas

```
if hasTransshipment and not alerted:
  create FACT alert

if daysSinceLastEvent > threshold:
  create MONITORING alert
```

---

## 5. Banco de Dados (Simplificado)

### processes

* id (PK)
* client_name
* importer_name
* exporter_name
* refs
* bl_number
* booking_number

### containers

* id (PK)
* process_id (FK)
* container_number

### container_snapshots

* id (PK)
* container_id (FK)
* source
* payload_json
* fetched_at

### alerts

* id (PK)
* container_id (FK)
* type
* category
* detected_at
* acked_at
* dismissed_at

---

## 6. Arquitetura (DDD)

Bounded Contexts principais:

* Shipment Management
* Container Management
* Tracking & Normalization
* Status & Alerting
* Notification

Estrutura:

```
src/modules/<context>/
  domain/
  application/
  infrastructure/
```

Regras:

* UI nunca deriva status
* Domain não conhece infra
* Adapters são isolados

Responsabilidade (ownership) — quem faz quê:

* Domain: contém regras puras de derivação de Observations → Timeline → Status; validações canônicas; tipos fechados.
* Application: orquestra pipelines (fetch → snapshot → normalize → persist → derive alerts); aplica versionamento e coordenação entre adaptadores; coordena retries e backfills.
* Infrastructure: implementa fetchers, connectors, persistência e adaptação de payloads brutos. Não contém regras de negócio além de transformação/normalização e validação.
* UI: apresenta projeções derivadas (Status) e histórico (Timeline/Observations) com metadados de incerteza; nunca calcula regras de domínio.

---

## 7. UX & Produto — Regras Importantes

* ISO 6346: warning, não bloqueio
* Fechar form com dados → warning
* Timeline mostra ciclos claramente
* Alertas de transbordo em destaque
* Dashboard mostra 1 container + badge +N

---

## 8. Prioridades Imediatas

1. Consolidar motor puro de derivação
2. Finalizar alertas (fact + monitoring)
3. Email alerts MVP
4. Timeline confiável
5. Observabilidade (Sentry/OTel)

---

## 9. Princípios Não-Negociáveis

* Nunca confiar em APIs como fonte de verdade
* Status não é evento
* Timeline aceita inconsistência
* Alertas devem ser explicáveis
* UX não deve punir usuário

---

## 10. Estado Atual

* Criação de processos: DONE
* Snapshots: conceitualmente definidos
* Motor de derivação: em refinamento (P0.1)

---

**Este documento é vivo.**
Atualize conforme sistema evolui, sempre preservando princípios acima.
