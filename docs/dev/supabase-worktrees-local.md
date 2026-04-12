# Supabase Local por Worktree (Stack Compartilhada)

Este guia define o fluxo operacional para múltiplas worktrees locais com isolamento de banco por worktree.

Modelo adotado:
- 1 stack Supabase local compartilhada (containers únicos)
- 1 template compartilhado (`ct_template_seeded`)
- 1 database isolado por worktree (`ct_wt_<slug>_<hash>`)

## O que este fluxo resolve

Quando múltiplos agents/LLMs rodam em paralelo, cada worktree usa seu próprio DB local.
Isso evita contaminação de estado entre migrations e diffs.

## Regras obrigatórias

- Tudo é **local-only**.
- Não usar `supabase link`.
- Não usar `db push` remoto.
- Não usar preview branches remotas.
- Push/promoção remota continuam manuais e fora do escopo deste fluxo.

## Bootstrap de uma worktree

```bash
git worktree add ../wt-feature minha-branch
cd ../wt-feature
pnpm initialize-worktree
```

`pnpm initialize-worktree` agora executa:
1. cópia de `.env`
2. `pnpm install`
3. `pnpm db:worktree:init`

Resultado esperado:
- stack local garantida
- template compartilhado garantido
- DB isolado da worktree criado/reusado
- `.env` atualizado com bloco gerenciado de DB
- metadata local gravada em `.worktree-db.local.json`

## Comandos operacionais

```bash
pnpm db:local:stack:ensure
pnpm db:template:ensure
pnpm db:template:refresh
pnpm db:worktree:init
pnpm db:worktree:reset
pnpm db:worktree:status
pnpm db:worktree:drop
```

## Como o template funciona

- `db:template:ensure`: cria `ct_template_seeded` só se não existir.
- `db:template:refresh`: recria explicitamente o template (drop + create + reset + seed).
- O template usa migrations versionadas e `supabase/seed.sql` como base reproduzível.

## Como migrations são validadas por worktree

Scripts de migration usam `LOCAL_DB_URL` da worktree atual:

```bash
pnpm supabase:reset
pnpm supabase:db:diff -- --file nome_da_migration
pnpm supabase:gen-types
```

Notas:
- `supabase:reset` recria o DB isolado da worktree clonando `ct_template_seeded`.
- `supabase:db:diff` e `supabase:gen-types` usam `LOCAL_DB_URL` da worktree atual.
- Guardrail: comandos falham se `LOCAL_DB_URL` apontar para `postgres` (DB administrativo) ou template.

## Política de idempotência

- Reexecutar `pnpm db:worktree:init` é seguro.
- Se DB da worktree já existir: ele é reutilizado (não reseta automaticamente).
- Reset destrutivo é explícito via comando (`supabase:reset` / `db:worktree:reset` / `db:worktree:drop` / `db:template:refresh`).
- `db:template:refresh` não derruba worktrees automaticamente, mas atualiza a base usada por resets futuros.

## Configuração local gerada

O `.env` recebe um bloco delimitado:

- `POSTGRES_DATABASE`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `LOCAL_DB_URL`

Esse bloco é gerenciado automaticamente por `pnpm db:worktree:init`.

## Limitações conhecidas

- Fluxo depende de Docker + Supabase CLI local.
- O lock de template é local ao repositório (via `git-common-dir`) e evita corrida entre worktrees do mesmo repo local.
- Não existe sincronização remota automática entre branches.
- `supabase:db:diff` pode incluir ruído de grants/ownership quando comparar DB isolado vs shadow DB. Trate como ruído operacional e foque em alterações semânticas de schema/migration.

## Integração manual após trabalho local

O agent/worktree produz migrations no Git local.
Qualquer promoção/sync remoto continua manual, fora deste fluxo.
