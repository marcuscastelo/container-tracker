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
