Container Tracker — Desktop (two-artifact) instructions

Quick TL;DR
- We provide two artifacts: the Electron AppImage (UI) and a standalone server binary.
- Start the server binary first, then launch the AppImage. The UI will connect to http://localhost:3000.

Build steps (Linux)
1) Install dependencies:
   pnpm install

2) Build client assets:
   pnpm run build
   Container Tracker — Desktop (two-artifact) instructions

   Quick TL;DR
   - We provide two artifacts: the Electron AppImage (UI) and a standalone server binary.
   - Start the server binary first, then launch the AppImage. The UI will connect to http://localhost:3000.

   Build steps (Linux)
   1) Install dependencies:
      pnpm install

   2) Build client assets:
      pnpm run build

   3) Build server binaries (uses pkg, targets node18):
      pnpm run build:servers:linux

   4) Build the AppImage UI:
      pnpm run electron:build

   Run (combined)
   You can use the provided helper to start server + UI together (from repo root):
      pnpm run run:desktop-with-server

   Or run manually:
      # in one terminal
      PORT=3000 ./dist/servers/server-linux

      # in another
      ./dist/Container\ Tracker-0.0.0.AppImage

   Notes & caveats
   - The maersk capture server uses puppeteer and ships as a separate binary (dist/servers/maersk-linux). Packaging puppeteer/chromium into a single executable is complex — you may prefer to run the maersk server in a separate environment where Chromium is available or provide the local-chromium dir alongside the binary.
   - The single-AppImage approach (auto-extracting and running servers from inside the mount) is fragile due to squashfs/asar constraints. This two-artifact approach is more robust for distribution.

   If you want me to automate creating a single-install bundle or Windows builds, tell me and I'll add scripts and docs.

   ---

   ```markdown
   # RELATÓRIO COMPLETO — Migração para Electron / Empacotamento

   Este documento registra TUDO que foi tentado para rodar o projeto "Container Tracker" como aplicativo de desktop (Electron) e todas as falhas encontradas. Objetivo: entregar um histórico técnico para o próximo agente humano/automático não repetir os mesmo erros.

   ---

   ## Resumo executivo

   - Abordagem adotada: mover a UI (SolidStart / Vite) para Electron e prover um servidor Express local que serve os assets e a API (rota `/api/refresh`).
   - Resultado prático: solução estável entregue como *dois artefatos* — (1) AppImage do Electron (UI) e (2) binários standalone de servidor (produzidos com `pkg`).
   - Tentativa de empacotar tudo num único AppImage que inicia servidor internamente: fracassou por limitações do ambiente (squashfs/asar, spawn ENOTDIR, resolução de módulos dentro do asar) — detalhes completos abaixo.

   ---

   ## Objetivos originais

   1. Rodar a aplicação SolidStart dentro do Electron em vez de navegador + servidor remoto.
   2. Preferência do usuário: um único executável (.exe / AppImage) que inicialize o servidor e a UI.
   3. Usar Express como shim para servir assets e expor a API (aceito pelo usuário).

   ---

   ## Alterações aplicadas (arquivos criados/alterados)

   - `electron/main.cjs` — Processo principal do Electron. Tenta localizar e iniciar o servidor (vários *fallbacks*: require/import, spawn, copiar para `/tmp`, etc.). Adiciona logging e heurísticas para localizar servidores em `resourcesPath` e `app.asar.unpacked`.
   - `electron/preload.cjs` — (se presente) carregamento seguro para render process.
   - `server/index.cjs` — Nova entrada CommonJS para o servidor Express, compatível com `pkg`. Serve assets estáticos (`.vinxi/build/client/_build`) e implementa `/api/refresh` que opera sobre `collections/`.
   - `server/maersk-server.cjs` — Servidor de captura Maersk (puppeteer). Mantido como binário separado porque Chromium não é embutido automaticamente pelo `pkg`.
   - `scripts/run-with-server.sh` — Helper para iniciar o binário do servidor e, em seguida, o AppImage, aguardando o servidor ficar pronto.
   - `package.json` — novos scripts e configurações de build:
     - `build:servers:linux` (usa `pkg` para gerar `dist/servers/*`)
     - `electron:build` / `electron:dev` / `run:desktop-with-server`
     - ajustes em `build.files`, `asarUnpack`, `extraResources` para incluir `server/` e `dist/servers`.
   - `README-ELECTRON.md` (este arquivo) — documentação e relatório.

   ---

   ## Principais comandos executados (reprodução)

   1. Instalação e build da UI

   ```bash
   pnpm install
   pnpm run build    # vinxi/vite -> gera .vinxi/build e SSR bundles
   ```

   2. Gerar binários do servidor (pkg)

   ```bash
   pnpm run build:servers:linux   # usa pkg (target node18-linux-x64) -> dist/servers/
   ```

   3. Gerar AppImage do Electron (UI)

   ```bash
   pnpm run electron:build   # empacota electron, app.asar, produz dist/Container\ Tracker-0.0.0.AppImage
   ```

   4. Rodar combinado (helper)

   ```bash
   pnpm run run:desktop-with-server
   # ou manualmente:
   # in terminal 1
   PORT=3000 ./dist/servers/server-linux
   # in terminal 2
   ./dist/Container\ Tracker-0.0.0.AppImage --no-sandbox
   ```

   ---

   ## Resultados funcionais (sucessos)

   - A UI rodando em Electron (AppImage) funciona quando o servidor está executando externamente (binário `dist/servers/server-linux`).
   - O servidor Express (`server/index.cjs`) empacotado com `pkg` inicia com sucesso quando executado como binário no host e serve assets e endpoints; verificado com `curl`.
   - A abordagem de dois artefatos (AppImage UI + binários server) é reprodutível e documentada.

   ---

   ## Falhas, erros e causas raiz (registro detalhado — salvar tudo para o próximo agente)

   ATENÇÃO: abaixo está o registro de TODAS as falhas relevantes encontradas durante a migração. Copie para o seu pipeline de debugging.

   1) Erro do Nitro / esbuild — "Top-level await is not available in the configured target environment ('es2019')"

   - Sintoma: `pnpm run build` (vinxi / nitro / esbuild transform) falhou durante a etapa de bundling SSR.
   - Exceção exibida: mensagem indicando que top-level await foi gerado e alvo de esbuild era `es2019`.
   - Causa provável: Nitro/vite geraram código com top-level await; esbuild target padrão não suporta. Configurar NITRO_ESBUILD_TARGET=es2022 ajudou parcialmente, mas não resolveu todos os transforms.
   - Impacto: impossibilita (sem ajustes) incluir o SSR node bundle tal como saía do `vinxi` num único runtime controlável por `pkg` / electron. Foi a motivação para a estratégia pragmática de dois artefatos.

   2) Erro ao tentar executar o servidor de dentro do AppImage / app.asar — spawn ENOTDIR

   - Sintoma: ao executar o AppImage (o binário do Electron empacotado), o `electron/main.cjs` tentou `spawn()` ou `execFile()` em arquivos localizados no caminho montado pela AppImage (`/tmp/.mount_*`), e o Node retornou `Error: spawn ENOTDIR`.
   - Observação: o arquivo existia (copiado para `/tmp` em tentativas subsequentes), mas a tentativa de execução ainda falhava em alguns cenários por causa de como o AppImage monta/serve recursos e permissões de execução no squashfs.
   - Causa provável: execução direta de binários ou de arquivos JS que dependem de `node_modules` a partir do filesystem montado pelo AppImage causa problemas (squashfs / permissões / caminhos não-rotulados). Em alguns casos, o processo falhava ao resolver módulos porque `require()` procurava em `node_modules` que não estavam presentes dentro do `app.asar`.

   3) Erro "Cannot find module 'express'" e dependências faltantes quando `require()` de arquivos dentro do app.asar

   - Sintoma: `electron/main.cjs` tentou `require('/path/to/app.asar/resources/server/maersk-server.cjs')` e recebeu `Cannot find module 'express'` (e `body-parser`, etc.).
   - Causa: módulos não estavam embutidos/visíveis dentro do `app.asar` no runtime Node do Electron, ou a resolução de módulos é inibida pelo layout do asar.
   - Impacto: tentativa de executar servidor via `require()` a partir do asar não é confiável a menos que se inclua explicitamente `node_modules` no `asarUnpack`/files e se garanta que os caminhos estejam corretos.

   4) `pkg` limitações com puppeteer / Chromium — warnings e falta do diretório `.local-chromium`

   - Sintoma: `pkg` conclui a geração do binário, mas emite avisos do tipo "Cannot include directory ... puppeteer/.local-chromium" e similar.
   - Causa: `pkg` embute arquivos em um snapshot VFS e não inclui diretórios grandes dinâmicos como os downloads do Chromium. Puppeteer procura por um diretório `local-chromium` contendo o executável do Chromium; sem isso, o binário não consegue iniciar o navegador automático.
   - Impacto: o binário do `maersk-server` empacotado com `pkg` não traz o Chromium e portanto não consegue executar as rotinas de captura; é necessário distribuir o `local-chromium` ao lado do binário e ajustar caminhos.

   5) Erros mistos de módulo ES vs CJS ("To load an ES module, set \"type\": \"module\" in package.json or use .mjs")

   - Sintoma: mensagens de aviso sobre tentar carregar ES modules quando um arquivo `.cjs`/`.js` foi usado indevidamente.
   - Causa: presença de misturas de módulos ESM e CJS nas dependências e no output do build; empacotar ambos corretamente exige atenção ao campo `type` e/ou usar arquivos `.mjs`/`.cjs` adequados.
   - Impacto: torna o uso de `require()` vs `import()` inconsistente quando o runtime tenta executar bundles gerados pelo Nitro.

   6) Problema recorrente: executar arquivos empacotados dentro do AppImage falha por razões variadas

   - Tentativas: (a) require() direto do `app.asar` (falha por módulos não encontrados), (b) spawn direto do arquivo dentro do `AppImage` (spawn ENOTDIR), (c) copiar arquivo para `/tmp` e executar (em alguns testes a cópia funcionou, em outros o spawn ainda retornou ENOTDIR), (d) extrair `asar` e executar (complexo e frágil no instalador).
   - Conclusão: executar um servidor Node complexo de dentro de um AppImage/asar não é confiável sem uma etapa explícita de extração em disco e sem incluir `node_modules` e assets externos (Chromium). Por isso a abordagem final foi separar os artefatos.

   ---

   ## Logs e mensagens de erro relevantes (excertos)

   - Nitro/esbuild:

   ```
   Error: Top-level await is not available in the configured target environment ('es2019')
       at ... (stack trace truncated)
   ```

   - AppImage runtime (exemplos):

   ```
   Error: Cannot find module 'express'
       at Function.Module._resolveFilename (internal/modules/cjs/loader.js:...) 
       at Function.require (internal/modules/cjs/helpers.js:...)

   Failed to spawn /tmp/.mount_.../resources/server/maersk-server.cjs Error: spawn ENOTDIR

   Warning: To load an ES module, set "type": "module" in package.json or use .mjs
   ```

   - pkg warnings:

   ```
   Warning! Cannot include directory: node_modules/puppeteer/.local-chromium
   Warning! Cannot include directory: node_modules/puppeteer/.local-chromium/linux-xxxx
   ```

   ---

   ## Workarounds implementadas

   1. Estratégia final: dois artefatos

   - Produzir `dist/servers/*` com `pkg` (binaries standalone) e empacotar o Electron AppImage apenas com a UI (sem tentar executar servidores internos). O AppImage assume a existência de um servidor em `http://localhost:3000`.

   2. Helper `scripts/run-with-server.sh`

   - Um script que inicia o binário do servidor (aguarda prontidão com polling HTTP) e só então executa a AppImage. Isso contorna a necessidade de iniciar o servidor de dentro do AppImage.

   3. Instruções claras no README para distribuir `local-chromium` ao lado do binário do maersk-server quando for gerar o pacote com captura via puppeteer.

   ---

   ## Artefatos produzidos

   - `dist/Container Tracker-0.0.0.AppImage` — AppImage da UI (Electron). Requer servidor externo.
   - `dist/servers/server-linux` — binary `pkg` do servidor Express.
   - `dist/servers/maersk-linux` — binary `pkg` do maersk-server (ATENÇÃO: Chromium não incluído automaticamente).

   ---

   ## Recomendações para o próximo agente / equipe (passo-a-passo, para não cometer os mesmos erros)

   1. Preferir a abordagem dois-artifatos inicialmente — é mais simples e robusta. Só tente embutir o servidor dentro do AppImage se houver forte necessidade de um único ficheiro.

   2. Se for obrigatório um único AppImage com servidor embutido, siga esta rota exaustiva:
      - Na primeira execução do AppImage, extrair explicitamente todo o conteúdo relevante para um diretório em `~/.local/share/<app>/` ou `/var/tmp/<app>-<hash>/` com permissões corretas.
      - Garantir que `node_modules` e quaisquer dependências nativas estejam presentes no local extraído. Isso pode demandar executar `npm ci` na máquina alvo (não ideal) ou empacotar `node_modules` fora do asar usando `asarUnpack` + `extraResources` e depois executar dos diretórios desempacotados.
      - Distribuir o binário do Chromium (ou instruir o maersk-server a baixar Chromium para o local extraído). Evitar confiar no `pkg` para incluir `puppeteer/.local-chromium`.

   3. Para empacotar com `pkg` e puppeteer:
      - Produzir o binário com `pkg` mas distribuir também o diretório `node_modules/puppeteer/.local-chromium` ao lado do binário ou configurar `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` e fornecer um Chrome/Chromium externo no PATH.

   4. Ajustes no build do Nitro:
      - Investigar configuração do `nitro`/`esbuild` para forçar um target capaz de lidar com top-level await (ES2022+) ou instruir Nitro a transpilar para compatibilidade. Atualizar variáveis de ambiente: `NITRO_ESBUILD_TARGET=es2022` e revisar `tsconfig`/`package.json` `type` e `module` settings.

   5. Testes e CI:
      - Automatizar as etapas de build e verificação no CI (Linux) com runners que executem `pnpm run build`, `pnpm run build:servers:linux`, e `pnpm exec electron-builder` e validem que o `server-linux` inicia e responde a uma requisição HTTP.

   ---

   ## Próximos passos sugeridos (priorizados)

   1. Criar um *bundle* de distribuição que agrupe `dist/Container Tracker-0.0.0.AppImage`, `dist/servers/server-linux`, `dist/servers/maersk-linux`, e `scripts/run-with-server.sh` num `tar.gz` ou `zip` com instruções de instalação. (Baixo esforço, alto valor.)

   2. Se quiser realmente um único executável:
      - Implementar extração at-first-run e testar exaustivamente (permits, SELinux, AppImage mounts). Este é um esforço médio-alto.

   3. Resolver Nitro/esbuild:
      - Ajustar target para ES2022+ e garantir bundles SSR compatíveis para `pkg` (ou separar por completo SSR e servir apenas os assets client-side).

   4. Documentar o empacotamento do Puppeteer:
      - Adicionar um script `scripts/package-chromium.sh` que copia `node_modules/puppeteer/.local-chromium` para o pacote de distribuição.

   ---

   ## Conclusão

   Eu (o agente) empacotei uma solução funcional e reprodutível como dois artefatos e documentei todas as falhas e os detalhes técnicos encontrados — exatamente como você pediu. O caminho para um único AppImage que auto-inicie servidores é possível, mas exige trabalho considerável (extração confiável, inclusão de node_modules/Chromium, resolver esbuild/Nitro TLA). Recomendo seguir com o bundle dois-artifatos para entrega imediata e só depois investir na unificação se for imprescindível.

   Se quiser, amanhã eu:
   - automatizo o `tar.gz` de distribuição (AppImage + servers + launcher);
   - ou começo a implementar extração at-first-run para tentar produzir um único AppImage.

   ```

   ---

   ## Notas finais para o próximo agente (se você não voltar)

   Se você encontrou este repositório depois que eu parti, aqui vão instruções claras, práticas e ações prioritárias que você pode executar imediatamente. Salvei tudo que ajude a reproduzir, consertar e melhorar a entrega.

   1) Localização dos artefatos
      - AppImage UI: `dist/Container Tracker-0.0.0.AppImage`
      - Server binaries (pkg): `dist/servers/server-linux`, `dist/servers/maersk-linux`
      - Helper script: `scripts/run-with-server.sh`

   2) Comandos úteis (Linux, zsh)

      - Instalar dependências e gerar builds:
        ```bash
        pnpm install
        pnpm run build
        pnpm run build:servers:linux
        pnpm run electron:build
        ```

      - Rodar server manualmente e testar:
        ```bash
        PORT=3000 ./dist/servers/server-linux &
        curl -sS http://localhost:3000/ || echo "server down"
        ```

      - Usar o helper para iniciar server + UI (espera o server):
        ```bash
        pnpm run run:desktop-with-server
        ```

      - Matar processos que possam usar portas 3000 ou 4XXX (com cuidado):
        ```bash
        # encontra pids escutando nas portas e mata (zsh)
        ss -ltnp | egrep ':3000\b|:4[0-9]{3}\b' -o
        # ou mate processos Node específicos (cuidado com outros serviços)
        ps aux | grep node | grep -E 'server-linux|maersk' | awk '{print $2}' | xargs --no-run-if-empty kill -9
        ```

   3) Logs e artefatos de debugging
      - Logs do servidor (se iniciado manualmente) podem ser redirecionados com `nohup` ou `&>` para `/tmp`.
      - Mensagens de erro críticas estão no histórico da sessão: Nitro/esbuild TLA, spawn ENOTDIR, Cannot find module 'express', pkg warnings sobre `puppeteer/.local-chromium`.

   4) Mudanças de código (curto resumo)
      - `electron/main.cjs`: lógica de inicialização do servidor com múltiplos fallbacks e logging extensivo.
      - `server/index.cjs`: nova entrada CommonJS para o servidor Express, compatível com `pkg`.
      - `server/maersk-server.cjs`: maersk capture server (puppeteer) — exige Chromium.
      - `package.json`: scripts e configurações de empacotamento (`build.files`, `asarUnpack`, `extraResources`).

   5) Dicas rápidas para não repetir minhas tentativas frustradas
      - Não tente executar o servidor rodando direto do `app.asar` ou do mount do AppImage sem primeiro extrair tudo para o disco e garantir `node_modules` e binários nativos.
      - Se precisar tentar um único AppImage, implemente explicitamente uma etapa de extração (descompactar `asar` ou copiar `extraResources`) para `~/.local/share/<app>/` com permissões executáveis e execute a partir daí.
      - Para o `maersk-server`, coloque o diretório `node_modules/puppeteer/.local-chromium` ao lado do binário, ou configure o servidor para usar um Chrome/Chromium já presente no sistema (via PATH).

   6) Prioridade mínima recomendada ao retomar o trabalho
      - Verificar que `pnpm run build` conclui sem erro (ajustar `NITRO_ESBUILD_TARGET` para `es2022` se necessário).
      - Reproduzir `pkg` build e confirmar que `dist/servers/server-linux` inicia.
      - Confirmar que AppImage abre quando servidor já está rodando.
      - Automatizar criação de um `tar.gz` com AppImage + servers + launcher.

   7) Checklist de segurança/produção
      - Não distribua `node_modules` com credenciais ou arquivos sensíveis.
      - Evite executar binários obtidos por `pkg` em ambientes desconhecidos sem revisão — os binários são self-contained e difíceis de inspecionar.

   8) Onde encontrar mais contexto
      - Arquivos de interesse: `package.json`, `pnpm-lock.yaml`, `src/lib/collections.ts`, `server/*`, `electron/*`.
      - Logs de build e saída de `electron-builder` na pasta `dist/` durante empacotamento.

   ---

   Boa sorte — este relatório contém tudo que eu tentei e por que escolhi a solução de dois artefatos. Se você for o próximo agente, comece pela seção "Recomendações" deste arquivo.

