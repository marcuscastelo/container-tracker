# Pós-fix — notas + dívidas novas (para não esquecer)

## ✅ Estado atual
- build-release passou a materializar deps via `pnpm deploy --prod` (sem copiar `node_modules`).
- preflight agora garante presença de `@supabase/functions-js/package.json`.
- `pnpm agent:rebuild-restart` deixa o serviço `RUNNING`.
- logs WinSW sem `ERR_MODULE_NOT_FOUND`.

---

# 1) Dívidas/Riscos introduzidos pelo fix

## 1.1 Necessidade de flags pnpm específicas
Você precisou usar:
- `--legacy`
- `--node-linker=hoisted`

**Risco:**
- Dependência de comportamento específico do pnpm v10.
- Mudanças futuras de pnpm podem quebrar o release silenciosamente.

**Mitigação recomendada (curto prazo):**
- Fixar versão do pnpm no repo (packageManager no package.json / corepack).
- Documentar explicitamente no `docs/agent-installer.md` e/ou `apps/agent/src/README`:
  - que o release depende dessas flags e por quê.

**Mitigação recomendada (médio prazo):**
- Criar um modo de build do agent que não dependa de `node-linker=hoisted` (ex.: deploy isolado do package do agent, ou bundling).

---

## 1.2 Execução via `cmd.exe /c` para pnpm no Windows
Você teve EINVAL ao usar `spawn('pnpm.cmd', { shell:false })` e contornou com `cmd.exe /c pnpm.cmd ...`.

**Risco:**
- quoting/escaping no Windows vira fonte de bugs (especialmente paths com espaços).
- dependendo do ambiente, `cmd.exe` pode resolver pnpm diferente (PATH).

**Mitigação recomendada:**
- Garantir quoting robusto dos args.
- Logar no modo verbose (sem secrets) o comando final (somente o “shape”, sem tokens).
- Considerar detectar e usar `process.env.ComSpec` em vez de hardcode `cmd.exe`.

---

# 2) Melhorias rápidas sugeridas (sem mudar comportamento)

## 2.1 Preflight mais “semântico”
Além de checar `@supabase/functions-js`, checar também:
- `release/app/node_modules/@supabase/supabase-js/package.json`
- e pelo menos 1 dependency “core” do agent (evita fixar num pacote específico).

Objetivo: reduzir “false confidence” se supabase sair do stack.

---

## 2.2 Mensagem de erro de preflight com ação
Quando o check falhar, incluir:
- “Release deps parecem incompletas. Rode agent:release novamente. Verifique pnpm deploy flags no build-release.ts.”

Evita debug lento.

---

# 3) Atualizar a lista de dívidas do MVP (append)
Adicionar ao doc de dívidas (ex.: docs/debt/0003-agent-runtime-enrolment.md):

- Dependência de flags pnpm (`--legacy`, `--node-linker=hoisted`) para materializar deps no release.
- Execução via `cmd.exe /c` no Windows por limitação do spawn com pnpm.cmd.

Essas duas entram como “dívidas de build/release”.

---
# 4) Nova divida (installer MAERSK + browser)

- `bootstrap.env` agora e instalado com `MAERSK_ENABLED=1` por default.
- O setup agora bloqueia instalacao quando `MAERSK_ENABLED=1` e nao existe Chrome/Chromium detectavel localmente.

Impacto:
- O cliente passa a ter dependencia forte de browser instalado para concluir install padrao.
- Se quiser operar sem MAERSK, sera necessario um modo futuro (feature flag backend ou installer switch) fora do escopo atual.
