# Tracking module

Este módulo implementa o motor canônico de rastreamento (F0.2 do roadmap) que
transforma *snapshots* brutos de carriers em *observations* normalizadas,
monta a *timeline*, deriva o *status* colapsado e gera *alerts* (fact-based e
monitoring).

Objetivos principais

- Preservar payloads brutos (snapshots) como fonte de input imutável.
- Normalizar fatos operacionais em Observations idempotentes e deduplicáveis.
- Construir Timeline ordenada e derivar Status monotônico.
- Gerar Alertas explicáveis (fact vs monitoring). Retroatividade apenas para fact alerts.
- Manter validação forte com Zod e evitar `any`/`as` (exceto em pontos documentados onde a tipagem depende de tabelas DB que ainda não existem).

Onde estão os arquivos

- Domain
  - `src/modules/tracking/domain/` — tipos canônicos, Zod schemas e regras puras
    - `snapshot.ts`, `observation.ts`, `containerStatus.ts`, `timeline.ts`, `trackingAlert.ts`, `transshipment.ts`, `fingerprint.ts`, etc.
- Application
  - `src/modules/tracking/application/` — orquestração da pipeline: normalize, diff, persist, derive timeline/status/alerts
  - `pipeline.ts` é o ponto de entrada principal para processamento de um snapshot
- Infrastructure
  - `src/modules/tracking/infrastructure/` — adaptadores por provider (ex.: `mscNormalizer.ts`) e implementações de persistência
  - Repositórios Supabase: `supabaseSnapshotRepository.ts`, `supabaseObservationRepository.ts`, `supabaseTrackingAlertRepository.ts`
  - `supabaseUntypedTable.ts` — helper temporário para tabelas que ainda não existem em `shared/supabase/database.types.ts`

Princípios e convenções

- Tipagem forte
  - Use `zod/v4` para os schemas do tracking module (consistente com outros módulos novos).
  - Somente `as const` é permitido para assertions literais; evite `as` em outros locais.
  - Sempre usamos `safeParse` ao consumir dados externos / retornos do banco para transformar `unknown` → tipos canônicos.
- Imutabilidade e idempotência
  - Snapshots são imutáveis.
  - Observations possuem `fingerprint` determinístico para deduplicação.
- Separação de responsabilidades
  - Domain: regras puras (normalize → observationDrafts, deriveTimeline, deriveStatus, deriveAlerts)
  - Application: orquestra, diferencia (diffObservations), persiste
  - Infrastructure: adapters (carrier → observationDrafts) e persistência (Supabase)

Como funciona a pipeline (resumo)

1. Persistir o snapshot bruto (container_snapshots)
2. `normalizeSnapshot(snapshot)` → `ObservationDraft[]` (dispatcher por provider)
3. `diffObservations(existingFingerprints, drafts)` → novos `Observation[]`
4. Persistir novas observations em `container_observations`
5. `deriveTimeline(observations)` → Timeline (ordenada, com detecção de "holes")
6. `deriveStatus(timeline)` → ContainerStatus (monotônico)
7. `deriveAlerts(timeline, status, existingAlertTypes, isBackfill, now)` → novos alerts
8. Persistir alerts em `tracking_alerts`

APIs principais (uso rápido)

- Pipeline

  import { processSnapshot } from '~/modules/tracking/application/pipeline'

  const result = await processSnapshot(snapshot, containerId, containerNumber, deps)

  // result contém:
  // { persistedSnapshots, newObservations, timeline, status, newAlerts }

- Normalizadores

  - `normalizeMscSnapshot(snapshot)` — implementado como exemplo. Para adicionar outro carrier, crie um adapter `normalize<Provider>Snapshot` que retorne `ObservationDraft[]`.

Persistência / Migração (SQL)

A seguir são exemplos mínimos de DDL para criar as tabelas esperadas pelo módulo. Ajuste tipos e constraints conforme sua convenção de migrations.

-- container_snapshots
CREATE TABLE public.container_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL,
  provider text NOT NULL,
  fetched_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  parse_error text NULL,
  created_at timestamptz DEFAULT now()
);

-- container_observations
CREATE TABLE public.container_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  container_id uuid NOT NULL,
  container_number text NOT NULL,
  type text NOT NULL,
  event_time timestamptz NULL,
  location_code text NULL,
  location_display text NULL,
  vessel_name text NULL,
  voyage text NULL,
  is_empty boolean NULL,
  confidence text NOT NULL,
  provider text NOT NULL,
  created_from_snapshot_id uuid NULL,
  created_at timestamptz DEFAULT now(),
  retroactive boolean DEFAULT false
);
CREATE INDEX ON public.container_observations (container_id);
CREATE UNIQUE INDEX ON public.container_observations (fingerprint, container_id);

-- tracking_alerts
CREATE TABLE public.tracking_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL,
  category text NOT NULL,
  type text NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  detected_at timestamptz NOT NULL,
  triggered_at timestamptz NOT NULL,
  source_observation_fingerprints jsonb NOT NULL,
  retroactive boolean DEFAULT false,
  provider text NULL,
  acked_at timestamptz NULL,
  dismissed_at timestamptz NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON public.tracking_alerts (container_id);

Observability & Validation

- Todos os pontos onde dados externos são consumidos usam `zod.safeParse` e lançam um erro se a validação falhar. Isso garante que records inválidos não fluam pelo motor.
- `fingerprint` usa SHA-256 sobre campos semânticos (container_number|type|date|location_code|vessel|voyage) — isso garante estabilidade e deduplicação.

Tests

- Tests de domínio (golden tests) estão em `src/modules/tracking/domain/__tests__/`
- Tests do normalizador MSC estão em `src/modules/tracking/infrastructure/__tests__/`
- Para rodar só os testes do tracking:

```bash
pnpm vitest run src/modules/tracking
```

- Para rodar type-check:

```bash
pnpm type-check
```

Notas operacionais / TODOs

- `src/modules/tracking/infrastructure/persistence/supabaseUntypedTable.ts` é uma shim temporária para permitir desenvolvimento antes de gerar `database.types.ts` com as novas tabelas. Depois de aplicar as migrations, gere os types do Supabase e remova este arquivo, alterando os repositórios para usar `supabase.from('table_name')` diretamente.
- Ao adicionar novas chaves i18n ou mensagens de alerta, siga a regra do projeto e atualize `src/locales/*` imediatamente.
- Evite lógica de domínio na UI — todas as derivações devem ocorrer no domain/application.

Contato

Se algo no motor estiver ambíguo, abra uma issue com o título `[tracking] question: <resumo>` e referencie `docs/master-consolidated-0209.md`.

----

Feito por automação do módulo de tracking — revise os trechos de DDL e ajuste restrições/foreign-keys conforme o seu esquema de banco de dados.
