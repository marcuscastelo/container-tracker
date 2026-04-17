# Supabase Local: Staging Compartilhado + Dev Emancipada

Este repositório usa Supabase **100% local** nesta fase.

Arquitetura operacional:
- `Prod`: remoto/manual, fora do tooling automático.
- `Staging`: stack Supabase local compartilhada, padrão para worktrees não emancipadas.
- `Dev`: stack Supabase completa e isolada por worktree, criada via `pnpm db:emancipate`.

Regras obrigatórias:
- Não usar `supabase link`.
- Não usar `supabase db push` remoto.
- Não usar preview/persistent branches remotas.
- Não automatizar promoção para staging/prod.
- Fonte de verdade do schema: `supabase/migrations/*.sql` versionadas no Git.

## Pré-requisitos

- `pnpm install`
- Docker ativo
- Node/pnpm suportados pelo projeto
- Supabase CLI via `npx`

## Fluxo padrão de worktree

```bash
git worktree add ../wt-feature minha-branch
cd ../wt-feature
pnpm initialize-worktree
```

Resultado:
- `.env` configurado para `staging`
- `.worktree-state.json` gravado
- nenhuma stack própria criada por padrão

## Fluxo isolado para migrations e testes destrutivos

```bash
pnpm db:emancipate
```

Resultado:
- stack Supabase completa e isolada para a worktree
- `.env` rebinding para a stack Dev local
- `supabase:reset`, `supabase:db:diff` e `supabase:gen-types` liberados

Para voltar ao compartilhado:

```bash
pnpm db:rejoin
```

## Comandos principais

Ambiente ativo da worktree:

```bash
pnpm supabase:start
pnpm supabase:status
pnpm supabase:status:env
pnpm supabase:stop
```

Regras:
- em `staging`, `supabase:start` garante a stack compartilhada
- em `emancipated`, `supabase:start` sobe a stack isolada da worktree
- `supabase:stop` só para a stack isolada; ele falha em `staging` por guardrail

Schema/migrations:

```bash
pnpm supabase:migration:new -- nome_da_migration
pnpm supabase:reset
pnpm supabase:db:diff -- --file nome_da_migration
pnpm supabase:gen-types
```

Regras:
- `supabase:migration:new` sempre atua no diretório versionado `supabase/` da branch atual
- `supabase:reset`, `supabase:db:diff` e `supabase:gen-types` falham em worktree não emancipada
- rode `pnpm db:emancipate` antes de qualquer mutation estrutural

Staging compartilhado:

```bash
pnpm db:stage:ensure
pnpm db:stage:status
pnpm db:stage:refresh-local-snapshot
pnpm db:stage:rebuild
```

## Destroy da worktree

```bash
pnpm destroy-worktree
```

Esse comando:
- remove a worktree Git atual
- limpa metadata local da worktree
- remove a stack Dev emancipada dessa worktree, se existir
- nunca toca em `staging`, `prod` ou outras worktrees

## Fluxos manuais de refresh a partir de prod

Scripts antigos `db:prod:*` continuam manuais.
Nesta fase, quando usados para hidratar um ambiente local, eles devem ser tratados como operações sobre o `staging` compartilhado, nunca sobre a Dev emancipada da worktree atual.

## Guardrails

- Fluxo atual é **local-only**.
- Worktree não emancipada pode usar o app normalmente, mas não deve fazer mutation estrutural.
- Worktree emancipada é o único lugar para migrations, resets e testes destrutivos.
- Push/sync remoto continuam manuais e fora do escopo deste tooling.
