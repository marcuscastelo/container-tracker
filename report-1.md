✅ Encontrado  

# Mapa de derivação de ALERTAS — container-tracker

Resumo detalhado do que foi encontrado no código fonte sobre como os alerts são derivados hoje.

---

1️⃣ Localize a função principal de derivação

- Paths e funções envolvidas
  - src/modules/tracking/domain/deriveAlerts.ts
    - funções: deriveAlerts, deriveTransshipment
    - assinatura principal (deriveAlerts):
      export function deriveAlerts(
        timeline: Timeline,
        status: ContainerStatus,
        existingAlertTypes: ReadonlySet<string>,
        isBackfill: boolean = false,
        now: Date = new Date(),
      ): NewTrackingAlert[]

  - src/modules/tracking/domain/trackingAlert.ts
    - definições de tipo: TrackingAlert, NewTrackingAlert, enums/zond for type/category/severity

  - src/modules/tracking/application/pipeline.ts
    - chama deriveAlerts (v. pipeline)

  - src/modules/tracking/application/tracking.alert.repository.ts
    - interface TrackingAlertRepository (insertMany, findActiveByContainerId, findActiveTypesByContainerId, acknowledge, dismiss)

  - src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts
    - implementação concreta que persiste alerts via supabase (insertMany, findActiveByContainerId, findActiveTypesByContainerId)

  - src/modules/tracking/infrastructure/persistence/tracking.persistence.mappers.ts
    - mapeadores alertRowToDomain e alertToInsertRow (conversão Row <-> Domain)

2️⃣ Entenda o fluxo

1. Quem chama deriveAlerts?
  - Chamado por: src/modules/tracking/application/pipeline.ts → função processSnapshot

2. Em que momento do pipeline ela roda?
  - Roda após: normalizeSnapshot → persistir observações novas → deriveTimeline → deriveStatus
  - Especificamente: Step 7 no pipeline descrito em processSnapshot (comentário no topo do arquivo)

3. Ela recebe o quê?
  - Parâmetros: timeline (Timeline), status (ContainerStatus), existingAlertTypes (ReadonlySet<string>), isBackfill (boolean), now (Date opcional)
  - Não recebe o snapshot diretamente — a entrada é o Timeline derivado (baseado em todas as observations)

Fluxo (5–10 linhas):
  - Uma snapshot é normalizada em ObservationDrafts e comparada com observações persistidas (fingerprints) → novas observações são inseridas.
  - Em seguida o pipeline lê todas as observações persistidas para construir o Timeline (deriveTimeline) e deriva o Status (deriveStatus).
  - O pipeline pergunta ao repositório por tipos de alertas ativos (findActiveTypesByContainerId) para evitar duplicação e chama deriveAlerts(timeline, status, existingAlertTypes, isBackfill).
  - deriveAlerts gera descritores (NewTrackingAlert[]) para alertas fact-based e monitoring conforme regras (transshipment, customs hold, no-movement, etc.).
  - O pipeline então persiste novos alerts via trackingAlertRepository.insertMany.

3️⃣ Estrutura do Alert

AlertDomainFields:
- id (uuid)
- container_id (uuid)
- category ("fact" | "monitoring")
- type (one of 'TRANSSHIPMENT'|'CUSTOMS_HOLD'|'PORT_CHANGE'|'NO_MOVEMENT'|'ETA_PASSED'|'ETA_MISSING'|'DATA_INCONSISTENT')
- severity ('info'|'warning'|'danger')
- message (string)
- detected_at (ISO datetime string)
- triggered_at (ISO datetime string)
- source_observation_fingerprints (string[])
- retroactive (boolean)
- provider (nullable provider enum)
- acked_at (nullable ISO string)
- dismissed_at (nullable ISO string)

AlertRowFields: (db row `tracking_alerts` — see src/shared/supabase/database.types.ts)
- id
- container_id
- category
- type
- severity
- message
- detected_at
- triggered_at
- source_observation_fingerprints (Json)
- retroactive
- provider
- acked_at
- dismissed_at
- created_at

AlertResponseDTOFields: (HTTP DTO — src/modules/tracking/interface/http/tracking.schemas.ts / mappers)
- id
- category
- type
- severity
- message
- detected_at
- triggered_at
- retroactive
- provider (nullable)
- acked_at (nullable)
- dismissed_at (nullable)

AlertViewModelFields: (frontend presenter — src/modules/tracking/application/tracking.alert.presenter.ts)
- id: string
- type: 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'
- severity: 'info' | 'warning' | 'danger'
- message: string
- timestamp: string (formatRelativeTime on triggered_at)
- category: 'fact' | 'monitoring'
- retroactive: boolean

4️⃣ Dedupe e confiabilidade

- Existe fingerprint?
  - Observations têm fingerprint (see observation.fingerprint). Alerts NÃO têm um fingerprint próprio; eles carregam `source_observation_fingerprints: string[]` referenciando as fingerprints das observações que dispararam o alerta.

- Como evita criar o mesmo alerta duas vezes?
  - Antes de chamar deriveAlerts, o pipeline carrega tipos de alertas ativos com trackingAlertRepository.findActiveTypesByContainerId(containerId).
  - deriveAlerts recebe esse conjunto (`existingAlertTypes`) e checa `existingAlertTypes.has('<TYPE>')` antes de criar um novo alerta do mesmo tipo.
  - Ou seja: dedupe é baseada em `type` (e no fato de o alerta anterior ainda ser ativo — não dismissed/acked).

- Alert fact-based dispara retroativamente?
  - Sim, deriveAlerts aceita o parâmetro `isBackfill` (passado pelo pipeline). Para fact alerts o campo `retroactive` é setado como `isBackfill`. O pipeline controla quando roda em backfill/onboarding e passa true para permitir alertas retroativos.

- Monitoring alerta reaparece?
  - Monitoring alerts são gerados somente quando `isBackfill` === false (o código explicitamente evita gerar monitoring alerts durante backfill).
  - A deduplicação usa `existingAlertTypes` (tipos ativos). Se um monitoring alert anterior estiver ainda ativo, um novo não será criado. Se o usuário ack/dismiss ou o alerta deixar de ser ativo, a mesma condição pode reaparecer em execuções futuras — ou seja, monitoring alerts podem reaparecer depois de ack/dismiss.

Observação: se for necessário evitar re-criação baseada em fingerprints (por exemplo para fact alert que poderia ser re-criado quando novo evidence aparece), atualmente isso NÃO é feito — a verificação é apenas por tipo ativo.

5️⃣ Location no alerta

- Onde o código monta descrição com porto/local?
  - Em deriveAlerts (src/modules/tracking/domain/deriveAlerts.ts):
    - Para TRANSSHIPMENT a `message` inclui `transshipment.ports.join(', ')` (ports são coletadas em deriveTransshipment a partir de `obs.location_code`.)
    - Para CUSTOMS_HOLD a `message` usa `firstHold?.location_display ?? firstHold?.location_code ?? 'unknown location'`.

- Hoje o alerta usa:
  - customs hold: prefere `location_display`, cai para `location_code` se `location_display` for nulo.
  - transshipment: constrói lista de ports a partir de `location_code` (uppercased) — não usa `location_display` para compor `ports`.
  - fallback: 'unknown location' (para customs hold quando ambos ausentes).

- Onde isso é resolvido?
  - `location_display` é definido durante normalização (provider normalizers) e preservado em Observation.
    - Normalizers: src/modules/tracking/infrastructure/adapters/*.normalizer.ts (ex.: maersk.normalizer.ts, msc.normalizer.ts)
  - `location_code` vem preferencialmente do carrier (unlocode) durante normalização; deriveTimeline/deriveTransshipment também normalizam via `.toUpperCase()` ao agrupar/contar ports.

---

🟡 Parcial

- createAlert / create_alert function: não encontrado — persistência é feita via repository.insertMany (supabaseTrackingAlertRepository.insertMany). Não existe uma função helper global `createAlert` no código.

🔴 Não encontrado

- Alert fingerprint (alert-level fingerprint) — não existe: “não encontrado” (não há hash único do alert além do id gerado pelo banco de dados).

---

Arquivos chave citados (paths completos):
- src/modules/tracking/domain/deriveAlerts.ts
- src/modules/tracking/domain/trackingAlert.ts
- src/modules/tracking/application/pipeline.ts
- src/modules/tracking/application/tracking.alert.repository.ts
- src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts
- src/modules/tracking/infrastructure/persistence/tracking.persistence.mappers.ts
- src/shared/supabase/database.types.ts
- src/modules/tracking/interface/http/tracking.schemas.ts
- src/modules/tracking/interface/http/tracking.http.mappers.ts
- src/modules/tracking/application/tracking.alert.presenter.ts
- src/modules/tracking/infrastructure/adapters/maersk.normalizer.ts
- src/modules/tracking/infrastructure/adapters/msc.normalizer.ts

---

Conclusão curta: deriveAlerts é uma função pura em src/modules/tracking/domain/deriveAlerts.ts chamada pelo pipeline após derivar timeline/status. A deduplicação atual evita re-criar alerts comparando tipos ativos (findActiveTypesByContainerId) e não usa um fingerprint de alerta. Fact-alerts podem ser retroativos via parâmetro isBackfill; monitoring alerts não são gerados retroativamente.
