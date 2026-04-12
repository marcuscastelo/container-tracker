# Supabase Local (Branch Local-Only)

Este repositório usa **Supabase 100% local** para desenvolvimento de schema/migrations nesta fase.

Regra de time (obrigatória):
- Não usar `supabase link`.
- Não usar `db push` remoto.
- Não usar dashboard/projeto Supabase Cloud para evoluir schema.
- Fonte de verdade do schema local: `supabase/migrations/*.sql` versionadas no Git.

## Pré-requisitos

- `pnpm install`
- Docker ativo
- Node/pnpm já suportados pelo projeto
- Supabase CLI via `npx` (scripts já usam `npx supabase ...`)
- Perfil local de env: `cp .env.example .env` (ajuste `INSTALLER_TOKEN` quando necessário)

## Primeira subida

```bash
pnpm supabase:start
pnpm supabase:status
```

Opcional (export em formato `.env`):

```bash
pnpm supabase:status:env
```

Mapeamento mínimo para o app:

- `SUPABASE_URL` = `API_URL`
- `SUPABASE_SERVICE_ROLE_KEY` = `SERVICE_ROLE_KEY`
- `VITE_PUBLIC_SUPABASE_URL` = `API_URL`
- `VITE_PUBLIC_SUPABASE_ANON_KEY` = `ANON_KEY`
- `AGENT_ENROLL_SUPABASE_URL` = `API_URL`
- `AGENT_ENROLL_SUPABASE_ANON_KEY` = `ANON_KEY`

## Reset local reproduzível

```bash
pnpm supabase:reset
```

`supabase:reset` reaplica migrations versionadas e executa `supabase/seed.sql`.

## Criar nova migration

Fluxo SQL-first (recomendado):

```bash
pnpm supabase:migration:new -- nome_da_migration
# editar o arquivo gerado em supabase/migrations/
pnpm supabase:reset
```

Fluxo diff-first (opcional):

```bash
pnpm supabase:db:diff -- --file nome_da_migration
pnpm supabase:reset
```

## Parar stack local

```bash
pnpm supabase:stop
```

## Seed e bootstrap

- `supabase/seed.sql` é intencionalmente mínimo (sem dados reais).
- Bootstrap de tabelas legadas necessárias para reset local está em migration versionada:
  `supabase/migrations/2026022401_local_bootstrap_core_tables.sql`.

## Guardrails desta fase

- Fluxo atual é **local-only**.
- `supabase/config.toml` está com `storage.enabled = false` para manter o reset local estável neste setup.
- Não existe promoção para QA/Prod.
- Não existe preview branch/persistent branch remota.
- Não existe automação de deploy de migration nesta etapa.
