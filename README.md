# Container Tracker — Electron & Server (how to run)

Este repositório contém uma pequena PoC SolidStart (vinxi) que foi adaptada para rodar também como um aplicativo desktop com Electron.
O projeto pode rodar em três modos principais:

- Desenvolvimento web (vinxi dev) — servidor + browser (padrão dev)
- Empacotado como Electron App (dev/prod)
- AppImage único contendo Electron + servidores (experimental) — também suportamos executar um servidor Maersk separado para rastreio (usa Puppeteer)

Este README descreve o passo-a-passo para preparar um repositório recém-clonado e executar o app no modo Electron (desenvolvimento e empacotado), além de detalhes sobre o servidor Maersk que usa Puppeteer.

Prerequisitos
 - Node.js >= 22 (vou usar `v22.x` nos exemplos)
 - pnpm (ou npm/yarn, mas os scripts assumem pnpm)
 - git
 - (opcional) Para o handler Maersk: Chrome/Chromium instalado ou deixe o Puppeteer baixar um Chromium (só em ambiente com internet)

Rápido — comandos essenciais

1) Clonar e instalar dependências

```bash
git clone <repo-url>
cd aGaryImport
pnpm install
```

2) Rodar em modo desenvolvimento (web)

```bash
pnpm run dev
# abrir http://localhost:3000 (ou porta que vinxi indicar)
```

3) Rodar em modo Electron durante desenvolvimento (abre o browser dev e o Electron que usa a URL dev)

```bash
pnpm run electron:dev
```

4) Rodar o server shim local (serve client build e a API /api/refresh)

```bash
# servidor principal (shim) que serve os assets e as rotas API (sem Puppeteer)
PORT=4200 pnpm run start-server

# servidor Maersk (opcional; usa puppeteer-extra e Chromium)
PORT=4310 pnpm run start-maersk-server
```

Observações sobre o server Maersk
- O handler Maersk exige `puppeteer` (ou `puppeteer-core`) + `puppeteer-extra` + `puppeteer-extra-plugin-stealth` e um executável Chrome/Chromium no sistema ou o Puppeteer fará o download automático.
- No repositório há um servidor separado: `server/maersk-server.cjs`. Ele captura a chamada interna de tracking via CDP e grava `collections/maersk/<container>.json`.
- Para executar manualmente (testar):

```bash
# start maersk server (pode demorar no primeiro start por conta do download do Chromium)
PORT=4310 node server/maersk-server.cjs

# depois, disparar um refresh
curl -i -X POST "http://localhost:4310/api/refresh-maersk/MRKU2733926"
```

Building / Empacotar (AppImage)

Este repositório já tem configuração para `electron-builder` no `package.json` (target AppImage para Linux). Passos gerais:

1) Gerar a build do app (vinxi) — NOTA: este passo requer `vinxi` no PATH. Em alguns ambientes de CI/dev, vinxi pode não estar disponível globalmente.

```bash
pnpm run build
# (se vinxi não estiver disponível globalmente, instale-o ou use o comando que o projeto esperar)
```

2) Empacotar com electron-builder (gera `dist/Container Tracker-<version>.AppImage`)

```bash
pnpm exec electron-builder --linux --x64
```

3) Executar o AppImage gerado

```bash
chmod +x dist/Container\ Tracker-0.0.0.AppImage
./dist/Container\ Tracker-0.0.0.AppImage
```

Dicas e limitações importantes sobre empacotar tudo em um AppImage
- Empacotar Electron + servidor que depende de Puppeteer/Chromium em um único AppImage é possível, mas delicado.
- Problemas que podem ocorrer ao executar o AppImage:
  - spawn ENOTDIR ao tentar executar arquivos diretamente dentro do mount do AppImage;
  - módulos (node_modules) não resolvidos quando executados via require/import em contextos dentro do `app.asar`;
  - Puppeteer precisa de um Chromium executável disponível ou fará download (aumenta muito o tamanho do artefato).
- Recomenda-se a abordagem em duas peças para maior robustez:
  1) AppImage principal: Electron + cliente + servidor shim leve (sem Puppeteer);
  2) AppImage/binário separado: Maersk server (com Puppeteer/Chromium) — o App principal pode spawnar esse binário via um caminho conhecido em `resources`.

Como empacotar o servidor Maersk separadamente (recomendado)

Opção A — gerar binário com `pkg` e empacotar como AppImage separado
 - Crie um `package.json` mínimo para o servidor ou configure `pkg` (não incluso automaticamente aqui)
 - Gere binário: `pkg server/maersk-server.cjs --targets node22-linux-x64 --output maersk-server`
 - Empacote `maersk-server` em um AppImage ou distribua o binário como um recurso extra

Opção B — empacotar Node + node_modules em um AppImage separado (mais fácil para testes locais)

No nosso fluxo atual, o `electron/main.cjs` já tenta localizar e spawnar um `server/maersk-server.cjs` a partir de `resources` (extraResources) e também tenta extrair/copiar para um tmpdir se necessário, mas esse comportamento pode variar por plataforma.

Variáveis de ambiente úteis
- PORT — porta para o servidor principal (`server/index.js`), padrão 3000
- MAERSK_PORT — porta para o servidor Maersk (se iniciado pelo Electron), padrão 4300
- CHROME_PATH — caminho para o executável Chrome/Chromium a ser usado pelo Puppeteer
- CHROME_USER_DATA_DIR — pasta de profile para evitar captchas/limitações em Maersk

Testes rápidos das APIs

1) Refresh genérico (usa curl .txt nos collections)

```bash
curl -i -X POST "http://localhost:4200/api/refresh" -H "Content-Type: application/json" -d '{"container":"FSCU4565494"}'
```

2) Maersk via servidor separado (direto)

```bash
curl -i -X POST "http://localhost:4310/api/refresh-maersk/MRKU2733926"
```

Resolução de problemas (dicas rápidas)
- Se o AppImage gerar ENOTDIR ao spawnar: prefira empacotar o servidor como binário separado e spawnar esse binário.
- Se `require('express')` ou outro módulo não for encontrado dentro do AppImage, garanta que `node_modules` tenha sido incluído em `asarUnpack` ou como `extraResources` (ou use a estratégia de binário separado com `pkg`).
- Para debug rápido, rode os servidores separadamente localmente (node server/index.js e node server/maersk-server.cjs) para confirmar que endpoints funcionam antes de empacotar.

Contato / acompanhamento
 - Se quiser, eu posso:
   - Gerar um AppImage separado para o Maersk server e ajustar `electron/main.cjs` para spawnar o binário (recomendado); ou
   - Continuar refinando a estratégia de empacotamento único (1A) e forçar unpack de node_modules / usar extraResources de forma a tornar o runtime mais robusto.

Boa sorte — se quiser que eu gere os AppImages separados agora, responda que eu prossigo e enviarei os passos finais, artefatos e comandos de teste.
# SolidStart

Everything you need to build a Solid project, powered by [`solid-start`](https://start.solidjs.com);

## Install
pnpm exec playwright install // TODO: explain and add to install script

## Creating a project

```bash
# create a new project in the current directory
npm init solid@latest

# create a new project in my-app
npm init solid@latest my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
# aGaryImport — PoC de Normalização de Dados de Embarque

Este repositório é uma prova de conceito (PoC) que demonstra como ingerir, normalizar e exibir dados de diferentes provedores de transporte marítimo (por exemplo: MAERSK, MSC, CMA CGM, ONE) em uma interface simples. O foco é mostrar como mapear formatos brutos e heterogêneos de *payloads* de terceiros para um esquema único que a UI consome, facilitando visão operacional de embarques e containers.

## O que este projeto resolve

- Agrega amostras de diferentes transportadoras com formatos distintos e as converte para um esquema unificado (normalização).
- Fornece heurísticas de parsing (datas, campos ausentes, caminhos alternativos) para tornar a ingestão tolerante a variações reais dos provedores.
- Oferece uma interface mínima (SolidJS) que consome os dados normalizados e demonstra casos de uso (lista de embarques, status, ETA, timeline, alertas).
- Facilita a adição de novos provedores pelo mapeamento localizado em `src/lib/collections.ts`.

## Tecnologias principais

- Runtime: Node.js (requerido >= 22)
- Framework UI: SolidJS / SolidStart (via Vinxi)
- Validação: zod (schemas de domínio)
- Bundler/dev: Vinxi/Vite
- Linguagem: TypeScript

## Estrutura do repositório (resumo)

- `src/` — aplicação front-end (Solid) e código de mapeamento:
	- `src/lib/collections.ts` — carregador de amostras e lógica de mapeamento/fallbacks por provedor. É o coração da normalização.
	- `src/routes/` — rotas e páginas de exemplo (ex: `index.tsx` que consome `getPoCShipments()`)
	- `src/components/` — componentes UI reutilizáveis.

- `schemas/` — definições Zod para os dados normalizados e a forma que a UI espera:
	- `containerStatus.schema.ts` — schema completo e detalhado dos eventos/containers
	- `shipment.schema.ts` — schema enxuto para consumo pela interface
	- `containerStatus-fields.html`, `containerStatus-ui-paths.html` — documentação auxiliar dos caminhos de dados

- `collections/` — amostras brutas por provedor (ex.: `maersk/`, `cmacgm/`, `msc/`). Coloque novos arquivos JSON aqui para que o loader os descubra.

## Como executar (rápido)

Certifique-se de ter Node >= 22 instalado.

Instalar dependências:

```bash
# usando npm
npm install

# ou, se preferir pnpm
pnpm install
```

Rodar em modo desenvolvimento:

```bash
npm run dev
# (o script executa `vinxi dev` conforme configuração do projeto)
```

Build para produção:

```bash
npm run build
npm start
```

## Como os dados são carregados

- Em desenvolvimento (Vite) o projeto tenta usar `import.meta.globEager` para consumir automaticamente os JSONs sob `collections/*/*.json`.
- Para SSR / CLI a mesma rotina tem um fallback que usa `fs` para ler os arquivos no disco (veja `src/lib/collections.ts`), então os samples funcionam tanto em dev quanto em server.

## Adicionando novas amostras / providers

1. Crie uma pasta em `collections/<provider>/` (por exemplo `collections/newcarrier/`).
2. Adicione os arquivos raw JSON (ex.: `ABC123.json`).
3. Opcional: adicione um `README.md` na pasta do provedor descrevendo a origem do sample.
4. Se necessário, adicione mapeamentos/fallbacks em `src/lib/collections.ts` para extrair campos específicos do provedor.

Observação: o loader tenta primeiro validar contra o schema normalizado; caso falhe, ele usa a lógica de mapeamento para construir a versão UI-friendly.

## Arquivos-chave (onde olhar primeiro)

- `src/lib/collections.ts` — mapeamento, parseDateLike e heurísticas. Adapte aqui quando um provider tiver campos incomuns.
- `schemas/containerStatus.schema.ts` — se você precisa entender todas as propriedades esperadas (eventos, timestamps, localizações).
- `schemas/shipment.schema.ts` — a forma mínima que a UI consome (útil para construir componentes).
- `src/routes/index.tsx` — exemplo de consumo de `getPoCShipments()` e renderização de tabela/alerts/timeline.

## Exemplo visual

O PoC inclui uma UI que lista embarques e mostra resumo, timeline e alertas. A captura anexada mostra um dashboard com recursos que você esperaria em um TMS simples: contadores (Embarques Ativos, Containers em Trânsito, Atrasos), tabela resumida de embarques com status coloridos (ex.: "Em Trânsito", "Chegada Atrasada", "Despacho Aduaneiro"), e uma timeline de eventos por processo.

(Ver anexo/screenshots fornecido na issue para referência visual.)

## Boas práticas / dicas

- Preserve a tolerância a formatos: o código já contém heurísticas de parsing de datas e caminhos alternativos de campos; tente expandi-las apenas quando entender o formato do provider.
- Faça testes com amostras representativas (por exemplo, BLs com campos ausentes, datas em formatos diferentes).
- Ao estender schemas, atualize ambos `containerStatus.schema.ts` e `shipment.schema.ts` e verifique as rotas que consomem os campos.

## Contribuições

Contribuições são bem-vindas. Para mudanças maiores siga estes passos:

1. Abra uma issue descrevendo o caso de uso.
2. Crie um branch com mudanças pequenas e focadas.
3. Adicione amostras em `collections/` para qualquer novo caso de provedor.
4. Atualize os schemas quando necessário e comente porque a mudança é segura.

## Licença

Adicione aqui a licença do projeto (por exemplo, MIT) conforme desejar.

---

Se quiser, posso:
- Gerar exemplos de mapeamento para um novo provedor.
- Adicionar um script que valida automaticamente todos os samples contra o schema e gera um relatório de erros.
- Incluir um README por-provedor dentro de `collections/` com instruções de teste.

Diga qual destas opções você prefere que eu adicione em seguida.
