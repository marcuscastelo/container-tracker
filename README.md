# Container Tracker

Painel operacional para rastreio marítimo com foco em consistência de domínio, auditabilidade e visibilidade de exceções.

## Screenshots

### Desktop

![Dashboard desktop](./public/screenshots/dashboard-desktop.png)

### Mobile

![Dashboard mobile](./public/screenshots/dashboard-mobile.png)

## Fase 1: Como um despachante usaria

1. Acessa o painel e busca um processo de embarque pelo número de referência ou container.
2. Visualiza o status atual derivado automaticamente (ex.: em trânsito, descarregado, entregue), sem precisar reconciliar manualmente dados de múltiplos carriers.
3. Consulta a timeline do processo para entender o que já aconteceu (ACTUAL) e o que era esperado (EXPECTED), incluindo mudanças de previsão.
4. Recebe alertas operacionais para agir cedo em risco de atraso, conflitos de informação ou ausência de atualização.
5. Usa o histórico preservado para auditoria: cada atualização é rastreável ao snapshot bruto recebido do carrier.

## Fase 2: Como funciona em termos leigos

1. O sistema coleta atualizações de transportadoras diferentes.
2. Cada atualização original é guardada exatamente como veio, sem sobrescrever histórico.
3. Depois, essas atualizações são convertidas em fatos padronizados (observações).
4. A partir desses fatos, o sistema calcula status, timeline e alertas.
5. Se houver incerteza ou conflito, isso é mostrado explicitamente em vez de ser escondido.

Resumo: o sistema não “chuta” estado. Ele deriva estado a partir de eventos reais e preserva todo o histórico para explicar qualquer decisão.

## Fase 3: Pitch técnico para dev sênior + instalação

### Por que a arquitetura é boa

- Bounded Contexts claros em `src/modules/*`:
  - `process`: agrupamento/logística de processo
  - `container`: identidade e associação de container
  - `tracking`: snapshots, observações e derivações (status/timeline/alerts)
- Capabilities em `src/capabilities/*` orquestram casos cross-context sem capturar semântica de domínio.
- Regras de dependência evitam acoplamento acidental: módulo não depende de capability; UI não define verdade de domínio.
- Invariantes fortes de rastreio:
  - snapshot imutável
  - observação append-only
  - status sempre derivado
  - conflito/incerteza expostos
- Contratos e fronteiras documentados em:
  - `docs/MASTER_v2.md`
  - `docs/TYPE_ARCHITECTURE.md`
  - `docs/BOUNDARIES.md`
  - `docs/TRACKING_INVARIANTS.md`
  - `docs/TRACKING_EVENT_SERIES.md`
  - `docs/ALERT_POLICY.md`

### Stack

- Node.js `>= 22`
- TypeScript
- SolidStart/SolidJS (Vinxi)
- Zod para validação
- Vitest para testes
- Biome + ESLint para qualidade de código

### Instalação e execução

```bash
pnpm install
pnpm run dev
```

Aplicação em desenvolvimento via `vinxi dev`.

### Scripts úteis

```bash
pnpm run build       # build de produção
pnpm run start       # sobe build de produção
pnpm run test        # testes (vitest)
pnpm run type-check  # checagem de tipos
pnpm run lint        # lint + regras
pnpm run check       # fix/lint + type-check + test
pnpm run i18n:check  # valida chaves de i18n
pnpm run maersk:smoke:puppeteer # smoke técnico de launch headless do Puppeteer
```

### Smoke técnico Puppeteer (devcontainer)

Use este comando para validar rapidamente se o browser do devcontainer está compatível com launch headless:

```bash
pnpm run maersk:smoke:puppeteer
```

Saída esperada em sucesso: `[maersk-smoke] PASS`.

Em falha, o comando classifica a causa com hints acionáveis:

- `missing_browser_binary`: Chrome/Chromium não encontrado no ambiente.
- `invalid_chrome_path`: `CHROME_PATH` definido para caminho inválido/não executável.
- `launch_incompatibility`: browser encontrado, mas `puppeteer.launch(...)` falhou.

### Smoke da rota `/api/refresh-maersk/:container` (devcontainer)

Procedimento reproduzível para validar que o browser deixou de ser o bloqueio principal:

1. Em um terminal no devcontainer, valide primeiro o launch técnico:

```bash
pnpm run maersk:smoke:puppeteer
```

2. Suba a aplicação local:

```bash
pnpm run dev
```

3. Em outro terminal, chame o endpoint Maersk:

```bash
CONTAINER=MRKU1234567
curl -sS "http://localhost:3000/api/refresh-maersk/${CONTAINER}?headless=1&hold=0&timeout=70000" \
  | tee /tmp/maersk-refresh-smoke.json
```

4. Verifique o critério mínimo de sucesso:

```bash
if grep -q "Browser launch failed" /tmp/maersk-refresh-smoke.json; then
  echo "FAIL: browser launch ainda bloqueando o endpoint"
else
  echo "PASS: browser launch não é o bloqueio atual"
fi
```

Regras de avaliação:

- Critério mínimo: a saída do endpoint não pode conter `Browser launch failed`.
- Erros externos do provider (por exemplo `403 Access Denied by Akamai` ou `502 No API response captured`) não reprovam este smoke, desde que o erro de launch não apareça.
- Se aparecer `Browser launch failed`, revise `CHROME_PATH` e repita `pnpm run maersk:smoke:puppeteer` antes de depurar integração Maersk.

### Loop autônomo com Codex (Ralph + Devcontainer)

Guia completo de setup, comandos `ai:loop:*`, fluxo container/host e troubleshooting:

- `docs/AI_LOOP_CODEX.md`

### Quality Gate (CI)

- Workflow obrigatório: `.github/workflows/quality.yml`
- Checks executados em `pull_request` e `push` para `main`:
  - `pnpm run lint`
  - `pnpm run type-check`
  - `pnpm run test`
- Recomenda-se branch protection exigindo os três checks acima antes de merge.

### Estrutura rápida do código

```text
src/
  modules/       # contexto de domínio
  capabilities/  # orquestração cross-context
  routes/        # camada de interface web
  shared/        # utilitários e infraestrutura compartilhada
```

### Princípio central

Estados são derivados de eventos.  
Eventos são derivados de snapshots.  
Snapshots nunca são descartados.
