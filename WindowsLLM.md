Windows build & context (conversa / instruções detalhadas)
=====================================

Objetivo
--------
Documentar com contexto completo tudo o que foi tentado e como gerar um .exe Windows funcional para este projeto "Container Tracker" (Electron + servidor local + Maersk handler com Puppeteer).

Resumo do que estamos construindo
--------------------------------
- Frontend: SolidStart (vinxi) + Vite (build outputs em `.vinxi/build`)
- Desktop: Electron que abre a UI apontando para o servidor local (ou serve arquivos estáticos)
- Servidor shim: `server/index.js` — servidor Express leve que serve os assets e implementa `/api/refresh` para vários carriers (usa arquivos `collections/*/*.txt` com curl payloads)
- Servidor Maersk: `server/maersk-server.cjs` — servidor separado que usa `puppeteer-extra` + `puppeteer-extra-plugin-stealth` para capturar a API de tracking da Maersk via CDP e escrever `collections/maersk/<container>.json`.

Decisão de empacotamento recomendada
------------------------------------
Após muitos testes, a estratégia mais robusta é gerar dois artefatos separados (opção "1B" que recomendamos):

1. App Windows principal — Electron + cliente + servidor shim leve (sem Puppeteer). Este App é responsável por abrir a UI e oferecer as APIs normais que não exigem Chromium/puppeteer.
2. Binário/App Windows do Maersk server — um executável independente (por exemplo gerado com `pkg`) que contém Node embutido e as dependências necessárias (incluindo puppeteer). O App principal vai spawnar esse binário (localizado em `resources` ou em um caminho conhecido) quando precisar do handler Maersk.

Motivos para separar
- Evita rodar (ou empacotar) Chromium dentro do AppImage principal (muito grande e sujeito a problemas de execução dentro do mount do AppImage ou `app.asar`).
- Evita ENOTDIR / problemas de spawn/execution ao tentar executar arquivos diretamente dentro do mount do AppImage.
- Isola dependências nativas (node_modules) e o download de Chromium (puppeteer) no binário do Maersk.

Arquivos-chave (mudanças feitas no repositório)
- `electron/main.cjs` — atualizado para procurar e spawnar um servidor principal e (opcionalmente) um `maersk-server` externo. Inclui vários fallbacks: require/import, extrair para tmp e spawnar.
- `server/index.js` — servidor Express "shim" que serve a UI e implementa `/api/refresh` (redireciona para `/api/refresh-maersk/:container` quando provider=maersk).
- `server/maersk-server.cjs` — servidor standalone que usa puppeteer-extra para capturar a resposta da API Maersk.
- `package.json` — scripts adicionados:
  - `build:maersk:win` — gera `dist/maersk-server.exe` usando `pkg` (target node22-win-x64)
  - `electron:build:win` — workflow para construir o maersk exe e rodar `electron-builder --win`

Requisitos para build Windows
----------------------------
- Windows host (recomendado) com:
  - Node.js >= 22 (ex.: v22.20.0)
  - pnpm (ou npm/yarn, ajustar comandos)
  - git
  - Conexão com internet (para baixar dependências e Chromium via puppeteer)
  - Espaço em disco (puppeteer/Chromium consome centenas de MB)

Notas sobre CI/ambientes não-Windows
- É possível construir artefatos Windows a partir do Linux; no entanto, se você quiser um instalador NSIS, normalmente precisa de `wine` na máquina Linux. Para apenas gerar um .exe portátil (diretório unpacked), o build no Linux pode funcionar, mas a forma mais direta e confiável é construir no Windows.

Comandos sugeridos (no Windows)
--------------------------------
1) Clonar + instalar
```powershell
git clone <repo-url>
cd aGaryImport
pnpm install
```

2) Gerar binário Maersk (pkg)
```powershell
# usa pkg para gerar um executável Windows com Node embutido
pnpm run build:maersk:win
# saída esperada: dist/maersk-server.exe
```

3) Empacotar Electron para Windows
```powershell
# roda o build do maersk binary, build do front (vinxi build) e electron-builder para Windows
pnpm run electron:build:win
# saída esperada em dist/: instalador/portable .exe e/ou pasta unpacked
```

4) Teste manual local (após gerar `maersk-server.exe` e o electron exe)
```powershell
# opcional: rodar o maersk server isolado
.\dist\maersk-server.exe

# rodar o executável principal do Electron (ou o instalador que instalou o app)
.\dist\Container\ Tracker-0.0.0.exe  # nome exato depende do builder

# test API
curl -i -X POST "http://localhost:4300/api/refresh-maersk/MRKU2733926"
# ou via servidor principal que redireciona
curl -i -X POST "http://localhost:3000/api/refresh" -H "Content-Type: application/json" -d '{"container":"MRKU2733926"}'
```

Observações importantes e solução de problemas
--------------------------------------------
1) Erros que vimos durante os testes (e como contornar):
  - Top-level await / Nitro/esbuild em `vinxi build`:
    - Em builds SSR o Nitro gerou código com top-level await que exigia alvo ES moderno.
    - O repositório já contém `vite.config.ts` com `build.target = 'es2022'`. Se tiver problemas, atualize alvos de build e versão do esbuild/Nitro.

  - ENOTDIR ao spawnar arquivos dentro do AppImage:
    - Problema comum quando você tenta executar um arquivo direto do mount do AppImage.
    - Solução robusta: empacotar o servidor Maersk como binário (.exe) e incluí-lo nas resources, então spawnar o binário (não o .cjs) ou extrair para tmp antes de spawn.

  - `MODULE_NOT_FOUND` (ex: `express`) quando require roda dentro do AppImage:
    - Significa que `node_modules` não está disponível no contexto onde `require` foi executado (por exemplo, dentro do `app.asar`).
    - Solução: garantir `node_modules` em `app.asar.unpacked` ou empacotar servidor como binário com `pkg`.

2) Puppeteer/Chromium
  - Puppeteer baixa um Chromium por padrão (grande). Em ambientes controlados, você pode usar `CHROME_PATH` para apontar para um Chrome/Chromium já instalado no sistema e evitar o download.
  - Variáveis úteis: `CHROME_PATH`, `CHROME_USER_DATA_DIR`.

3) Permissões e antivírus no Windows
  - Antivírus/Windows Defender podem bloquear execuções de binários gerados por `pkg` ou downloads de Chromium. Teste após permitir ou numa pasta confiável.

4) Tamanho do artefato
  - Incluir puppeteer e Chromium faz o binário/installer crescer centenas de MB. Se isso for problema, considere uma arquitetura híbrida: servidor Maersk em uma máquina/serviço separado.

Checklist para eu ou você rodar localmente (guia de verificação)
--------------------------------------------------------------
 - [ ] Clonar repo
 - [ ] pnpm install (Node >=22)
 - [ ] pnpm run build:maersk:win  -> confirmar `dist/maersk-server.exe` existe
 - [ ] pnpm run electron:build:win -> confirmar `dist/` contém o instalador/portable Windows
 - [ ] Executar `maersk-server.exe` separadamente e testar endpoints
 - [ ] Executar o Electron exe e testar UI e chamada de refresh via UI

Contexto da conversa (resumo rápido)
-----------------------------------
No chat anterior eu:
- Analisei o repo e adicionei um servidor Express shim e um servidor Maersk em `server/maersk-server.cjs`.
- Tentei empacotar tudo numa AppImage (1A). O build gerou a AppImage, porém ao rodar encontramos problemas de runtime:
  - spawn ENOTDIR ao tentar executar dentro do mount do AppImage
  - `require('express')` não resolvido quando tentei require direto dentro do contexto do AppImage
- Por esses motivos preferimos a abordagem 1B (app principal + binário/AppImage separado para Maersk).

Se for útil para contexto no Windows LLM chat
-----------------------------------------
Copie esse arquivo `WindowsLLM.md` para a conversa no Windows e diga qual abordagem prefere (1B recomendado). Se você marcar para eu gerar os artefatos aqui, eu posso tentar rodar `pnpm install` e as builds, mas note que neste ambiente de execução anterior houve falha ao instalar algumas dependências; recomenda-se rodar localmente no Windows.