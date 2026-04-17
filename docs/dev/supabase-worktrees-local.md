# Worktrees: Staging Compartilhado e Dev Emancipada

Este guia define o fluxo operacional para múltiplas worktrees locais com isolamento real por stack Supabase, sem depender de branching remoto.

Modelo adotado:
- `Prod`: ambiente real, manual, fora do tooling local
- `Staging`: stack Supabase local compartilhada por todas as worktrees não emancipadas
- `Dev`: stack Supabase completa isolada por worktree, criada sob demanda via `pnpm db:emancipate`

## Entry point

```bash
git worktree add ../wt-feature minha-branch
cd ../wt-feature
pnpm initialize-worktree
```

`pnpm initialize-worktree` continua sendo o bootstrap canônico e executa:
1. cópia de `.env`
2. `pnpm install`
3. `pnpm db:worktree:init`

Resultado esperado:
- worktree em `mode=staging`
- `.worktree-state.json` persistido localmente
- `.env` com bloco gerenciado apontando para `staging`
- nenhuma stack própria emancipada criada por padrão

## Metadata da worktree

Arquivo local canônico:
- `.worktree-state.json`

Ele persiste:
- `worktreeId`
- `mode`
- `staging.projectId`, `workdir`, `snapshotPath`, `ports`
- `emancipated.projectId`, `workdir`, `ports`, `status`, `preserved`
- `generatedFiles`

As secrets/keys não são persistidas na metadata. Elas são reidratadas via `supabase status -o env` no ambiente ativo.

## Runtime root compartilhado

Todos os artefatos compartilhados ficam em:

```text
$(git rev-parse --git-common-dir)/ct-local-envs/
```

Estrutura:
- `staging/project/`: projeto Supabase compartilhado de staging
- `staging/snapshots/staging.dump`: snapshot local reutilizável
- `worktrees/<worktree-id>/project/`: projeto Supabase da worktree emancipada
- `worktrees/<worktree-id>/state.json`: espelho compartilhado do estado da worktree
- `locks/`: locks locais para rebuild/snapshot/alocação

## Staging compartilhado

Comandos:

```bash
pnpm db:stage:ensure
pnpm db:stage:status
pnpm db:stage:refresh-local-snapshot
pnpm db:stage:rebuild
```

Semântica:
- `db:stage:ensure`: materializa e sobe o `staging` compartilhado
- `db:stage:refresh-local-snapshot`: atualiza o snapshot local usado por futuras emancipações
- `db:stage:rebuild`: recria explicitamente o projeto compartilhado de staging e renova o snapshot

Regras:
- branches comuns usam `staging` por padrão
- não execute migrations destrutivas diretamente em `staging`
- `staging` não é playground para testes destrutivos de agents

## Emancipação

```bash
pnpm db:emancipate
pnpm db:emancipate -- --fresh
```

Semântica:
- sobe ou reutiliza a stack isolada da worktree
- rebinda `.env` para a stack Dev da worktree
- atualiza `.worktree-state.json` para `mode=emancipated`

Política:
- sem `--fresh`, reaproveita a stack preservada da worktree quando existir
- com `--fresh`, recria a stack Dev a partir do snapshot local de `staging`

Depois da emancipação, a worktree pode rodar:

```bash
pnpm supabase:reset
pnpm supabase:db:diff -- --file nome_da_migration
pnpm supabase:gen-types
```

## Rejoin para staging

```bash
pnpm db:rejoin
```

Semântica:
- volta a apontar para `staging`
- para a stack Dev da worktree sem destruir seus volumes
- mantém a stack isolada preservada para futura reemancipação

## Destroy seguro da worktree

```bash
pnpm destroy-worktree
pnpm destroy-worktree -- --force
```

Semântica:
- falha no checkout canônico principal
- se houver stack Dev emancipada, para e remove somente os recursos dela
- remove `.worktree-state.json` e metadata legada da worktree atual
- executa `git worktree remove` com preflight de segurança
- nunca toca em `staging`, `prod` ou worktrees alheias

## Bloco gerenciado no `.env`

O `.env` recebe um bloco auto-gerado com:
- `CT_WORKTREE_ENV_MODE`
- `CT_WORKTREE_ID`
- `CT_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_JWT_SECRET`
- `AGENT_ENROLL_SUPABASE_URL`
- `AGENT_ENROLL_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_SUPABASE_URL`
- `VITE_PUBLIC_SUPABASE_ANON_KEY`
- `POSTGRES_HOST`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_PRISMA_URL`
- `LOCAL_DB_URL`

Esse bloco é idempotente e substitui automaticamente o bloco legado DB-only.

## Limitações conhecidas

- O snapshot local usado para emancipação está pragmáticamente limitado a dados do schema `public`; isso evita colisões com ownership e objetos internos gerenciados pelo Supabase.
- Se o checkout canônico principal ainda não tiver `supabase/config.toml`, o `staging` compartilhado cai em fallback para o scaffold da worktree atual até o checkout principal ficar completo.
- `storage` continua desligado enquanto o `supabase/config.toml` versionado do repo permanecer assim.
- Não existe promoção remota automática, preview branches remotas nem deploy automático de migrations nesta fase.
