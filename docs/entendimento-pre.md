# Entendimento prévio do projeto Container Tracker

Este documento registra entendimento inicial do repositório "Container Tracker" antes do recebimento de informações adicionais. Foi gerado partir da inspeção da estrutura do repositório, dos documentos em `docs/` e dos principais artefatos no diretório `src/`.

## Visão geral
- Projeto: Container Tracker — aplicação web para track & trace de containers (logística marítima).
- Objetivo: ingerir, persistir e apresentar eventos/observações sobre containers e processos de transporte, derivar timelines/status/alerts e fornecer UI B2B para operadores/usuários.
- Arquitetura: organizada em bounded contexts (modules) e capacidades (capabilities), com forte separação entre domínio e features transversais.

## Documentos canônicos identificados
- `docs/MASTER_v2.md` — visão do produto e modelo conceitual.
- `docs/TRACKING_INVARIANTS.md` — invariantes do tracking (append-only, snapshots imutáveis, fingerprinting).
- `docs/TRACKING_EVENT_SERIES.md` — semântica de series de eventos (primary per series, EXPECTED vs ACTUAL).
- `docs/ALERT_POLICY.md` — política de alertas (fact alerts vs monitoring alerts e retroatividade).
- `docs/BOUNDARIES.md` e `docs/arquitetura_de_tipos_e_camadas_container_tracker_guia_definitivo-0211.md` — regras de camadas, tipagem e dependências.

Esses documentos definem regras e invariantes fundamentais do domínio que devem ser preservadas em código e UI.

## Estrutura do código e artefatos relevantes
- Frontend / app: `app.tsx`, `entry-client.tsx`, `entry-server.tsx`, `routes/`, `locales/` — aplicação SolidJS/TypeScript com i18n.
- Módulos de domínio: `src/modules/` contém `container/`, `process/`, `tracking/` — cada módulo segue divisão `application/`, `domain/`, `infrastructure/`, `ui/`.
- Capabilities: `src/capabilities/` (ex.: `search/`) — orquestram BCs e dependem de `modules/*/application`.
- Shared/infra: `shared/` (ex.: `supabase`, `api-schemas`) — integração com serviços e contratos.
- Exemplos/fixtures: `examples/` e `test/fixtures/` com payloads de carriers (Maersk, MSC, etc.).
- Ferramentas: pnpm, Vitest, scripts de i18n, linter/biome/eslint.

Stack técnico inferido:
- TypeScript, SolidJS, pnpm, Vitest, possivelmente Supabase/Postgres.

## Princípios e regras de domínio (resumo)
- Snapshots são imutáveis — persistir raw payload sempre.
- Observations são append-only — correções são adicionadas, não sobrescritas.
- Status é derivado da timeline/observations, e não fonte de verdade.
- Eventos têm `event_time_type` = ACTUAL | EXPECTED; EXPECTED pode expirar e ser marcado `EXPIRED_EXPECTED`.
- Event Series: eventos relacionados formam séries; timeline exibe primary por série (safe-first). EXPECTED posteriores ACTUAL não apagam fatos.
- Alert Policy: fact alerts (retroativos) vs monitoring alerts (tempo real, não retroativos).
- Tipagem forte: evitar `any`, preferir `unknown` + guards, `as const` quando necessário.
- Separação de camadas: Rows (DB) ≠ Entities (domínio) ≠ DTOs ≠ ViewModels.

## Fluxos de dados e casos de uso esperados
- Ingestão de eventos (webhooks, polling, uploads ou integrações externas) → persistência de snapshot raw + criação de observation com fingerprint.
- Agrupamento em Event Series → derivação de timeline/status → geração de alerts (fact e/ou monitoring).
- UI consome read models das camadas `application` dos módulos e apresenta timeline, ETAs, alertas, etc.
- Correções/human-in--loop feitas via novos observations (append-only), nunca alteração in-place.

## Integrações e artefatos externos
- Arquivos em `examples/api/` mostram payloads/contratos com carriers (Maersk, MSC, etc.).
- `shared/supabase` sugere uso de Supabase (provavelmente Postgres) para persistência/infra.

## Pontos a confirmar / riscos
1. Pipeline de ingestão: conectores existentes (webhooks, polling, batch uploads, filas) e onde rodam.
2. Persistência: DB primário (Postgres via Supabase?), esquema das tabelas e migrações.
3. Volume e performance: taxa esperada de eventos, exigências de deduplicação em escala.
4. Segurança / multitenancy: escopos e isolamento entre clientes.
5. UI: tratamento UX para conflitos (múltiplos ACTUAL na mesma série) e eventos EXPECTED expirados.
6. Cobertura de testes para invariantes (append-only, fingerprinting, derivação de status).
7. Operação e deploy: destino (Vercel, infra própria), CI/CD e observabilidade.

## Perguntas rápidas para afinar entendimento
- Quais são fontes de eventos (webhook, polling, arquivos)? Existe catálogo de conectores?
- Qual é banco de dados primário e papel do Supabase em produção?
- Há microserviço separado para ingestão ou tudo roda na mesma aplicação/monorepo?
- Requisitos de multitenancy / isolamento por cliente?
- Existem contratos OpenAPI/JSON Schema para payloads dos carriers?

## Próximos passos planejados
- Ao receber informações adicionais, reconciliar e produzir delta: que muda no entendimento, implicações arquiteturais, alterações necessárias no código/tests e riscos.
- Validar se código atual implementa invariantes documentadas e propor correções/tests/migrations quando necessário.

---
Registro criado automaticamente partir da inspeção do repositório em 2026-02-17.
