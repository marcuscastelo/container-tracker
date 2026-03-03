# PRD — Dev Feature: Skill LLM + Script de Worktree para Implementação de PRDs (ralph loops)

## Resumo

Criar uma **feature de dev tooling** que permite, **dentro do DevContainer na worktree main**, disparar um comando único (ex.: **`$wt-implement`**) que:

1. cria uma **git worktree** para implementar um PRD existente em `tasks/*.md`;
2. faz **seed determinístico** de arquivos **não-tracked** (ex.: `.env`) para a nova worktree (com política explícita e auditável);
3. copia o **PRD** e **metadados do ralph** para dentro da worktree;
4. abre o VS Code **já apontando para a nova worktree** (preferencialmente no DevContainer);
5. imprime (e salva em arquivo) o comando `pnpm run <script-ralph> ...` com parâmetros gerados para melhor DX;

O objetivo é: depois de executar `$wt-implement`, o dev só precisa **trocar para a janela do VS Code recém-aberta** e **rodar o comando gerado** — sem copiar nada manualmente.

---

## Objetivo

* Reduzir a fricção para rodar PRDs com **ralph loops autônomos**.
* Tornar o setup de worktree e seed de arquivos locais **determinístico, auditável e repetível**.
* Padronizar convenções: nome de branch, layout de pastas, logs, metadados e “handoff” para execução do `pnpm run <script-ralph>`.

## Não-objetivos (fora de escopo)

* Automatizar merge/rebase/PR (pode ser fase futura).
* Resolver conflitos de worktree automaticamente.
* Garantir abertura 100% confiável do VS Code “já dentro” do DevContainer em todos os ambientes (teremos *best effort* + fallback determinístico).
* Criar regras de domínio/produto (isso é tooling; não toca invariantes do produto).

---

## Usuário e contexto

**Usuário**: você como dev.

**Contexto**:

* Você está na worktree `main` dentro de um **DevContainer**.
* Existe um PRD em `tasks/*.md`.
* Existe um script existente `pnpm run <script-ralph>` (nome e contrato atuais permanecem; a feature só melhora DX via parâmetros e metadados).

---

## UX / Fluxo (happy path)

### 1) Comando único

Você executa (exemplo):

* `$wt-implement tasks/PRD-dashboard-sort.md`

### 2) Saídas esperadas

O comando:

* cria uma worktree em `../wt/<slug>` (ou outro root configurável);
* cria branch `feat/<slug>` (ou `prd/<slug>` — configurável);
* faz seed determinístico de arquivos locais (ex.: `.env`);
* copia o PRD para `wt/<slug>/tasks/<slug>.md` (e mantém referência ao path original);
* cria `wt/<slug>/.ralph/` com manifest de execução, origem, timestamps e comando recomendado;
* tenta abrir VS Code na nova worktree;
* imprime o comando `pnpm run <script-ralph> ...` (e salva em `wt/<slug>/.ralph/command.txt`).

### 3) Execução do ralph

Você entra na janela do VS Code recém-aberta e roda exatamente o comando gerado.

---

## Requisitos funcionais

### RF-01 — Seleção de PRD

* Entrada: path para um arquivo markdown existente em `tasks/*.md`.
* O comando deve validar:

  * arquivo existe
  * extensão `.md`
  * está dentro de `tasks/` (por default)

### RF-02 — Nome da worktree e branch

* O nome padrão (`<slug>`) deve ser derivado do PRD:

  * baseado no nome do arquivo, normalizado (lowercase, `-`)
  * opcionalmente prefixado com data curta (`2026-03-03-...`) para evitar colisão
* Branch padrão:

  * `feat/<slug>` (configurável)

### RF-03 — Criação da worktree

* Criar via `git worktree add`.
* Regras:

  * se o path já existir, falhar com mensagem clara (não sobrescrever)
  * se branch já existir, permitir “attach” ou falhar com instrução (configurável)

### RF-04 — Seed determinístico de arquivos não-tracked

**Problema**: `.env` e afins são locais, fora do git, e precisam existir na nova worktree.

**Solução obrigatória**: seed por **manifest explícito**, determinístico e auditável.

* Deve existir um arquivo de configuração no repo, por exemplo:

  * `tools/worktrees/seed.config.json`

Conteúdo mínimo:

* `include`: lista de paths e/ou glob patterns permitidos
* `exclude`: lista de patterns proibidos
* `mode`: `copy` (default) | `symlink` (opcional futuro)

Regras:

* Por default, **copiar apenas allowlist**.
* Deve registrar no log:

  * quais arquivos foram copiados
  * quais foram ignorados
  * checksum (opcional) / tamanho
* Deve falhar se algum arquivo required do allowlist não existir (configurável por item: `required: true/false`).

Sugestão de allowlist inicial (ajustável):

* `.env`
* `.env.local`
* `.env.development.local`
* `supabase/.env`
* `apps/**/.env*` (se existir monorepo)
* `secrets/*.json` (somente se já houver diretório padronizado)

### RF-05 — Copiar PRD + metadados ralph

* Copiar o PRD para dentro da worktree, em path estável (ex.):

  * `<wtRoot>/.ralph/prd.md`
* Criar metadados mínimos:

  * `<wtRoot>/.ralph/run.json` com:

    * `sourcePrdPath`
    * `worktreePath`
    * `branch`
    * `createdAt`
    * `recommendedCommand`
    * `seedManifestUsed`

### RF-06 — Gerar comando ralph (melhor DX)

* O comando deve ser gerado com:

  * path do PRD **na worktree** (não o original)
  * um “run id”/tag derivado do slug
  * diretório de output/logs em `.ralph/out/`

Exemplo (placeholder):

* `pnpm run <script-ralph> -- --task ./.ralph/prd.md --run-id <slug> --out ./.ralph/out`

Regras:

* Deve imprimir no final.
* Deve salvar em `.ralph/command.txt`.

### RF-07 — Abrir VS Code apontando para a worktree

* Best-effort:

  * `code -n <worktreePath>`
* Se possível, acionar “Reopen in Container” automaticamente (dependente do ambiente).

**Fallback determinístico (obrigatório)**:

* Se não conseguir reabrir automaticamente no DevContainer, imprimir instruções claras:

  * “Abra `code -n <worktreePath>` e use ‘Dev Containers: Reopen in Container’.”

### RF-08 — Idempotência / reexecução segura

* Se a worktree já existir, o script deve:

  * detectar
  * não recopy de seed sem flag `--force-seed`
  * ainda assim poder reimprimir o comando `ralph`

---

## Requisitos não-funcionais

### RNF-01 — Determinismo

* Dado o mesmo PRD + config, o seed e o layout gerado devem ser iguais.

### RNF-02 — Auditabilidade

* Sempre registrar:

  * seed config usada
  * lista de arquivos copiados
  * comando recomendado
  * data/hora

### RNF-03 — Segurança de secrets

* Não copiar “qualquer untracked” por default.
* O allowlist é obrigatório.
* Opção `--include-untracked` (se existir) deve ser explicitamente perigosa e desabilitada por default.

### RNF-04 — Portabilidade

* Rodar no DevContainer (Linux).
* Idealmente suportar host Windows/macOS como *nice to have*, mas o contrato principal é no container.

---

## Interface proposta

### Comando principal (skill do Codex)

* `$wt-implement <pathPrd> [flags]`

### Flags

* `--wt-root <path>` (default: `../wt`)
* `--branch-prefix <prefix>` (default: `feat/`)
* `--slug <slug>` (override)
* `--force-seed`
* `--no-open` (não abrir VS Code)
* `--print-only` (não cria worktree, só calcula o plano e imprime)

---

## Artefatos gerados (layout)

Em `<worktreePath>`:

* `.ralph/`

  * `prd.md` (cópia do PRD)
  * `run.json` (metadados)
  * `command.txt` (comando final)
  * `seed.log` (arquivos copiados + erros)
  * `out/` (logs e outputs do ralph)

---

## Detalhes de implementação (proposta técnica)

### 1) Scripts

Adicionar scripts no repo:

* `tools/worktrees/wt-implement.sh` (entrada principal)
* `tools/worktrees/seed.config.json` (config allowlist)
* `tools/worktrees/lib/*.sh` (helpers: slugify, logging, validations)

Opcional:

* `tools/worktrees/wt-status.sh` (listar worktrees e últimos runs)

### 2) Algoritmo de seed

* Ler `seed.config.json`.
* Para cada item do `include`:

  * resolver globs
  * copiar preservando diretórios
  * respeitar `exclude`
* Registrar resultado em `.ralph/seed.log`.

### 3) Integração com o ralph

* Não mudar o ralph.
* Só padronizar parâmetros gerados.
* Copiar PRD para `.ralph/prd.md` para garantir path estável.

### 4) Integração “Skill LLM”

* A skill `$wt-implement` é a UX.
* A implementação real é o script.
* O LLM:

  * escolhe slug/branch (ou usa default)
  * chama o script
  * retorna o comando final + fallback instructions

---

## Critérios de aceite

### CA-01 — Setup end-to-end

Dado um PRD em `tasks/*.md`, ao rodar `$wt-implement tasks/X.md`:

* worktree é criada
* PRD é copiado para `.ralph/prd.md`
* allowlist de seed é aplicada
* `command.txt` é criado
* VS Code abre no path da worktree (ou imprime fallback)

### CA-02 — Determinismo e segurança

* Não copiar arquivos fora do allowlist.
* Logs refletem exatamente o que foi copiado.
* `--print-only` não modifica nada.

### CA-03 — Reexecução

* Rodar o comando duas vezes não quebra o estado.
* Sem `--force-seed`, não sobrescreve seed existente.

---

## Plano de implementação (fases)

### Fase 1 — MVP (1 PRD → 1 worktree)

* `wt-implement.sh`
* `seed.config.json` allowlist mínimo
* `.ralph` artifacts + comando gerado
* `code -n` best-effort + fallback

### Fase 2 — DX e ergonomia

* `--print-only`
* `--force-seed`
* melhor slugify + detecção de colisão
* `wt-status.sh`

### Fase 3 — Automação de container reopen (se viável)

* investigar `devcontainer` CLI / `code --folder-uri` em ambiente real
* adicionar detecção do ambiente (Codespaces vs local)

---

## Riscos e mitigação

1. **Copiar secrets indevidamente**

* Mitigação: allowlist obrigatória, logs, flags perigosas explícitas.

2. **VS Code não abrir no DevContainer automaticamente**

* Mitigação: fallback instruído e determinístico.

3. **Colisão de nomes de worktree/branch**

* Mitigação: slug com data ou sufixo incremental.

---

## Telemetria (opcional)

* Contagem de execuções (local) não é necessária no MVP.
* Pode registrar apenas localmente em `.ralph/`.
