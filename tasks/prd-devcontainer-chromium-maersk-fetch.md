# PRD: Devcontainer com Chromium para habilitar fetch Maersk

## 1. Introducao / Overview

Esta feature resolve uma falha de ambiente de desenvolvimento: o endpoint de refresh Maersk (executado no server Vite/SolidStart) depende de browser para o Puppeteer, mas o devcontainer atual nao instala Chrome/Chromium.

Erro observado no front desde o uso de devcontainer:

```json
{"error":"Browser launch failed","hint":"Install Chrome/Chromium or set CHROME_PATH","details":"Error: Could not find Chrome (ver. 145.0.7632.46). This can occur if either\n 1. you did not perform an installation before running the script (e.g. `npx puppeteer browsers install chrome`) or\n 2. your cache path is incorrectly configured (which is: /home/node/.cache/puppeteer).\nFor (2), check out our guide on configuring puppeteer at https://pptr.dev/guides/configuration."}
```

## 2. Goals

- Garantir browser disponivel no devcontainer para o fetch Maersk funcionar.
- Eliminar erro `Browser launch failed` por ausencia de browser.
- Adicionar validacao objetiva (smoke tecnico + smoke de endpoint).
- Manter estabilidade de versao com politica pinada e bump manual via PR.

## 3. User Stories

### US-001: Provisionar browser no devcontainer

**Description:** Como dev, quero abrir o devcontainer e ter browser funcional para executar o refresh Maersk sem setup manual adicional.

**Acceptance Criteria:**

- [ ] `.devcontainer/Dockerfile` instala Chromium via APT.
- [ ] O ambiente do container define `CHROME_PATH` para um binario existente.
- [ ] Apos rebuild do container, `chromium --version` retorna sucesso.
- [ ] `pnpm run type-check` passa sem regressao.

### US-002: Validacao tecnica de launch do browser

**Description:** Como dev, quero um smoke test tecnico para identificar rapidamente quebra de launch do Puppeteer.

**Acceptance Criteria:**

- [ ] Existe script/comando de smoke para validar launch headless com Puppeteer no devcontainer.
- [ ] Em falha, a mensagem aponta causa acionavel (binario ausente/path invalido/incompatibilidade de launch).
- [ ] O comando de smoke esta documentado.
- [ ] `pnpm run test` continua passando.

### US-003: Validacao de endpoint Maersk no ambiente de devcontainer

**Description:** Como dev, quero validar o endpoint `/api/refresh-maersk/:container` para provar que o problema nao e mais "browser ausente".

**Acceptance Criteria:**

- [ ] Existe procedimento de smoke para chamada ao endpoint Maersk em ambiente de dev.
- [ ] O criterio minimo de sucesso e: resposta nao contem `Browser launch failed`.
- [ ] Erros externos (ex.: 403 Akamai/502 sem captura) nao bloqueiam aceite desta feature se o browser launch ocorreu.
- [ ] O procedimento esta documentado no repositorio.

### US-004: Politica de versao controlada

**Description:** Como time, quero evitar drift automatico de browser para reduzir mismatch inesperado com Puppeteer.

**Acceptance Criteria:**

- [ ] Nao existe auto-update de browser em `post-start` nem em fluxo de refresh.
- [ ] Atualizacao de versao e manual, via PR explicito.
- [ ] Documentacao descreve como executar bump de versao com seguranca.

## 4. Functional Requirements

1. FR-1: O devcontainer deve instalar Chromium no build (`.devcontainer/Dockerfile`).
2. FR-2: O devcontainer deve expor `CHROME_PATH` apontando para o executavel instalado.
3. FR-3: Deve existir smoke tecnico para validar launch headless do browser com Puppeteer.
4. FR-4: Deve existir smoke de endpoint para validar ausencia do erro `Browser launch failed`.
5. FR-5: A politica de versao do browser deve ser pinada, sem auto-update em background.
6. FR-6: A documentacao deve incluir passos de verificacao e troubleshooting basico.
7. FR-7: Nao alterar contrato externo de `POST /api/refresh` e `GET/POST /api/refresh-maersk/:container`.
8. FR-8: Mudancas desta feature ficam restritas ao escopo de devcontainer/desenvolvimento local.

## 5. Non-Goals (Out of Scope)

- Reescrever o fetcher Maersk, heuristicas anti-bot ou logica de stealth.
- Garantir sucesso funcional da API Maersk para qualquer container (bloqueios externos podem continuar).
- Levar browser para runtime de producao.
- Implementar atualizacao automatica de browser apos sucesso/falha.

## 6. Design Considerations

- Sem impacto de UX final para usuario de produto.
- Impacto apenas no setup e operacao de ambiente de desenvolvimento.

## 7. Technical Considerations

- Arquivos candidatos:
  - `.devcontainer/Dockerfile`
  - `.devcontainer/devcontainer.json`
  - `.devcontainer/post-create.sh` (ou script novo em `scripts/`)
  - Documentacao (`README.md` e/ou docs de devcontainer)
- O fetcher Maersk ja suporta descoberta por `CHROME_PATH`; a feature deve padronizar esse caminho no container.
- Politica de versao:
  - Versao pinada do pacote Chromium no build.
  - Bump manual com PR quando necessario.

## 8. Success Metrics

- Incidencia de erro "Could not find Chrome" no devcontainer cai para zero no fluxo padrao.
- Novo dev consegue executar refresh Maersk no container sem instalar browser manualmente.
- Tempo de troubleshooting de setup inicial reduzido.

## 9. Open Questions

- Nenhuma para iniciar implementacao.

## 10. Assumptions and Defaults

- Escopo decidido: somente devcontainer.
- Estrategia de browser: Chromium via APT.
- Validacao: smoke tecnico + endpoint check.
- Politica de update: versao pinada + bump manual por PR.

