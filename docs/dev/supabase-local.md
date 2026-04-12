# Supabase Local (Local-Only)

Este repositório usa Supabase **100% local** nesta fase.

Regras obrigatórias:
- Não usar `supabase link`.
- Não usar `supabase db push` remoto.
- Não usar preview/persistent branches remotas.
- Fonte de verdade do schema: `supabase/migrations/*.sql` versionadas no Git.

## Pré-requisitos

- `pnpm install`
- Docker ativo
- Node/pnpm suportados pelo projeto
- Supabase CLI via `npx`

## Stack local

```bash
pnpm supabase:start
pnpm supabase:status
pnpm supabase:stop
```

Opcional:

```bash
pnpm supabase:status:env
```

## Migrations locais

```bash
pnpm supabase:migration:new -- nome_da_migration
pnpm supabase:reset
pnpm supabase:db:diff -- --file nome_da_migration
pnpm supabase:gen-types
```

`supabase:reset` recria o DB isolado da worktree a partir do template local seedado.
Quando houver alteração em migration/seed que deva entrar na base do reset, rode `pnpm db:template:refresh`.

## Worktrees com DB isolado

Para paralelismo local seguro (múltiplos agents/worktrees), use:

- [docs/dev/supabase-worktrees-local.md](./supabase-worktrees-local.md)

Esse fluxo provisiona um DB por worktree, reutilizando a mesma stack local compartilhada.

## Guardrails

- Fluxo atual é **local-only**.
- Não existe promoção automática QA/Prod.
- Não existe deploy automático de migrations nesta etapa.
- Push/sync remoto continuam manuais e fora do escopo do tooling local.
