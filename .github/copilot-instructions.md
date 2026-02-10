---
applyTo: '**/*.{ts,tsx}**'
description: "High-level instructions and operational rules for GitHub Copilot / auxiliary LLMs
---
# Copilot Instructions — Container Tracker

Este documento define **instruções de alto nível e regras operacionais** para uso do GitHub Copilot / LLMs auxiliares no projeto **Container Tracker**.

Ele consolida **conhecimento de domínio (logística marítima)**, **boas práticas de arquitetura**, **idiomaticidade em TypeScript, SolidJS e TailwindCSS**, **padrões de segurança**, e **uso correto de BiomeJS/ESLint**.

> Regra de ouro: **o domínio manda no código e na UI**. Nunca simplifique a realidade operacional para “facilitar” a implementação.

---

## 1. Papel do Copilot no Projeto

O Copilot deve atuar como:

* **Assistente técnico de Product + Engineering**
* Especialista em **Track & Trace marítimo B2B**
* Guardião de **consistência de domínio, tipagem forte e UX operacional**

O Copilot **NÃO** deve:

* Inventar dados de carriers
* Ocultar incertezas (ETAs ausentes, eventos faltantes)
* Criar abstrações genéricas sem lastro no domínio
* Introduzir lógica de negócio em componentes de UI

---

## 2. Princípios de Arquitetura

### 2.1 Separação de Camadas

Organizar o código em camadas explícitas:

* **Domain**

  * Entidades (Shipment, Container, Event, Alert)
  * Regras de derivação de estado
  * Tipos canônicos
* **Application**

  * Casos de uso
  * Orquestração de eventos
  * Normalização de dados de carriers
* **Infrastructure**

  * Fetchers / scrapers / APIs
  * Parsers
  * Persistência
* **UI (SolidJS)**

  * Componentes puros
  * Nenhuma regra de domínio pesada

Copilot deve **recusar** colocar regras de derivação dentro da UI.

---

## 3. Domínio — Regras Invioláveis

### 3.1 Estados são Derivados

* **Nunca persistir estado final**
* Estado atual = último evento relevante + regras
* Eventos são fatos imutáveis

### 3.2 Dados Incompletos São Válidos

* ETA ausente é um estado explícito
* Timeline pode ter buracos
* UI deve explicar a ausência

### 3.3 Raw Payload Sempre Preservado

* Nunca descartar payload original do carrier
* Parsing falho gera `Alert[data]`

---

## 4. TypeScript — Boas Práticas Obrigatórias

### 4.1 Tipagem Forte Sempre

* `any` é proibido
* Preferir `unknown` + type guards
* Usar `readonly` sempre que possível
* O uso de assertions de tipo com o operador `as` é absolutamente PROIBIDO em QUALQUER circunstância. A única exceção permitida é o literal `as const` (por exemplo para tuplas/const assertions). Nunca use `as` para forçar tipos em tempo de compilação — em vez disso, use guards, validação com Zod ou reescreva a tipagem.

### 4.2 Tipos Canônicos

* Definir enums/union types fechados para:

  * ContainerStatus
  * EventType
  * AlertCategory
  * Severity

### 4.3 Narrowing Explícito

* Nunca assumir forma de dados externos
* Criar guards como:

  * `isCarrierEvent()`
  * `isExpectedEvent()`

### 4.4 Funções Pequenas e Determinísticas

* Sem efeitos colaterais escondidos
* Regras de domínio devem ser puras

### 4.5 Dynamic imports

* NUNCA use `await import(...)` em código TypeScript (TS/TSX) deste repositório.
  * Use imports estáticos sempre que possível.
  * Se precisar de dependência opcional, preferir tornar a dependência explícita (dev/optional) e carregá-la via import estático ou encapsular a lógica de fallback em um módulo adaptador que exponha uma API estável.
  * A proibição de `await import` ajuda a evitar import dinâmica dispersa e problemas de análise/empacotamento; esta preferência foi adotada pelo time e deve ser seguida por ferramentas automáticas e por sugestões do Copilot.

### 4.6 Exports

* NÃO use `export default` em arquivos TypeScript (TS/TSX) deste repositório.
  * Use sempre exportações nomeadas (`export const fn = ...` / `export function foo() {}` / `export class Bar {}`).
  * Motivação: exportações nomeadas facilitam refactors, tornam as importações explícitas, melhoram a compatibilidade com ferramentas de análise estática e evitam ambiguidades na resolução de símbolos.
  * Quando sugerir código ou modificar arquivos, o Copilot deve preferir e gerar apenas exportações nomeadas. Se uma dependência externa expuser um default, adapte via import específico (`import pkg from 'pkg'`) somente onde necessário, mas internamente preferir named exports.


---

## 5. BiomeJS / ESLint

### 5.1 Biome como Fonte Primária

* Formatter + Linter principal
* Configuração minimalista e explícita

### 5.2 Regras Essenciais

* No unused vars
* No implicit any
* No floating promises
* Prefer const
* Explicit return types em funções públicas

### 5.3 ESLint Apenas Onde Biome Não Cobre

* Regras específicas de framework
* Plugins muito específicos

Copilot **não deve** sugerir configs redundantes entre Biome e ESLint.

---

## 6. Segurança

### 6.1 Input Não Confiável

* Todo dado externo é hostil
* Validar payloads com Zod

### 6.2 Scraping / APIs

* Rate limiting explícito
* Retry controlado
* Timeouts definidos

### 6.3 UI

* Nunca renderizar HTML bruto
* Escapar strings externas

---

## 7. SolidJS — Idiomaticidade

### 7.1 Reatividade Correta

* Usar `createSignal` para estado local
* Usar `createMemo` para derivação
* Nunca derivar estado imperativamente

### 7.2 Efeitos

* `createEffect` apenas para side-effects
* Nunca para computação

### 7.3 Componentes

* Componentes devem ser **puros**
* Props bem tipadas
* Estados: `loading | empty | error | ready`

### 7.4 Performance

* Evitar reatividade profunda desnecessária
* Preferir dados normalizados

---

## 8. TailwindCSS — Idiomaticidade

### 8.1 Sem CSS Arbitrário

* Usar classes utilitárias
* Evitar `style={}` inline

### 8.2 Design Operacional

* UI densa
* Espaçamento funcional
* Priorizar legibilidade de tabela

### 8.3 Estados Visuais Claros

* Status nunca só por cor
* Ícone + texto

---

## 9. UI Operacional

### 9.1 Tabelas

* Uma linha = um container/processo
* Status e ETA sempre visíveis
* Hover mostra último evento

### 9.2 Alertas

* Alertas são eventos, não flags mágicas
* Severidade clara

---

## 10. Microcopy e i18n

* Texto curto e operacional
* Nunca esconder erro
* Strings sempre via chave i18n

### Adição de novas chaves i18n (regra obrigatória)

Sempre que for criar chaves novas no código (ex.: ao adicionar `keys` em um componente), adicione imediatamente as mesmas chaves em todos os arquivos de tradução local presentes em `src/locales` (por exemplo `src/locales/en.json` e `src/locales/pt.json`).

Recomendações:
- Insira valores placeholder curtos (ex.: `"dashboard.table.col.client": "Client"` / `"dashboard.table.col.client": "Cliente"`) quando a tradução final não estiver disponível.
- Use chaves idênticas em todos os arquivos de locale para evitar regressões em runtime.
- Commita essas mudanças junto com a alteração do componente que introduziu a nova chave.

Para garantir que não haja chaves faltando entre os arquivos de locale, sempre rode o verificador de chaves i18n após adicionar novas chaves:

```bash
pnpm i18n:check
```

Esse comando falhará localmente (saindo com código de erro) quando existirem chaves faltantes ou inconsistentes entre os arquivos em `src/locales`.

### Uso de chaves (guideline importante)

Quando for chamar a função de tradução (`t()`), sempre obtenha keys via `const { t, keys } = useTranslation()` e use `t(keys.someKey)` em vez de `t('some.key.path')` diretamente. Isso garante que todas as chaves usadas no componente estejam agrupadas em um objeto `keys` definido no topo do componente, facilitando a manutenção e evitando erros de digitação.
Vantagens:
- Facilita refactors (renomear chaves em um único lugar).
- Mantém chaves agrupadas e legíveis no componente.
- Simplifica busca de onde uma chave é usada.

Exemplo de padrão em um componente:

```ts
const { t, keys } = useTranslation()
return <button>{t(keys.save)}</button>
```

Sempre prefira esse padrão em vez de usar literais de string diretamente em chamadas `t('buttons.save')` espalhadas pelo JSX.
É ESTRITAMENTE PROIBIDO usar literais de string diretamente em chamadas `t()` sem passar por um objeto de chaves, para garantir consistência e facilitar manutenção.
NÃO USE `t('buttons.save')` DIRETAMENTE — SEMPRE USE `t(keys.save)` COM UM OBJETO DE CHAVES DEFINIDO NO COMPONENTE.

---

## 11. Testes

### 11.1 Domínio

* Testar regras de derivação
* Casos incompletos e inconsistentes

### 11.2 UI

* Estados vazios
* Dados quebrados

---

## 12. Anti‑Padrões (Copilot Deve Evitar)

* Abstrações genéricas sem domínio
* `any` para “resolver rápido”
* UI que esconde incerteza
* Lógica de negócio em componentes
* Estados mágicos não rastreáveis

Exemplos explícitos a evitar:

* ❌ Persistir eventos externos (raw) como a única fonte de verdade sem normalização
* ❌ Deduplicar observações apenas por timestamp ou event_id do carrier
* ❌ Usar `as` para forçar tipagem em validação de payloads (exceto `as const`)
* ❌ Derivar status na UI ou em componentes de apresentação
* ❌ Gerar alertas de monitoring retroativamente a partir de backfills

## 13. Perguntas que o LLM deve sempre se fazer

Ao gerar código ou regras, o Copilot/LLM deve executar um checklist mental:

1. Isso é um snapshot, uma observation ou um status/projeção?
2. Isso é um fato (observation) ou uma projeção (status/alerta de monitoring)?
3. Estou preservando o payload raw e metadados de confiança?
4. O que acontece se a API do carrier contradizer o histórico? (preservar ambos, marcar incerteza)
5. Estou usando guards/validação em vez de `as` para todas as formas externas?

## 14. Heurística de decisão rápida

Regras práticas para decisões automáticas do LLM:

* Se a API contradiz o histórico → preserve ambos os registros e marque incerteza.
* Se o usuário adicionar dados retroativamente (onboarding/backfill) → gerar fact-based alerts retroativos, marcá-los como `retroactive: true` e `historical` na UI.
* Se houver dúvida entre um event verbatim e um fato semântico → criar uma Observation marcada como `uncertain` e gerar um Alert[data] para revisão manual.
* Nunca gerar monitoring alerts (time-based) retroativamente.

## 15. Regras Adicionais: Alertas Retroativos

* Alertas retroativos são permitidos somente para fatos (fact-based alerts) e devem sempre conter metadados: `retroactive: true`, `detected_at` (data do fato) e `triggered_at` (data da geração do alerta).
* UI deve indicar claramente que o alerta é histórico e que não representa um estado em tempo real.

## 16. Ownership (Quem deve fazer o quê)

Para evitar ambiguidade, lembre-se:

* Domain: regras de derivação puras (Observations → Timeline → Status) e tipos canônicos.
* Application: orquestra pipelines, coordena fetchers/backfills, persiste snapshots e observations.
* Infrastructure: conectores, fetchers, adaptações para transformar payloads brutos em um formato validável.
* UI: apresentação, explicitação de incertezas e ações do usuário (ack/dismiss).

---

## 13. Checklist Mental do Copilot

Antes de gerar código, o Copilot deve se perguntar:

1. Isso respeita o domínio marítimo real?
2. A incerteza está visível?
3. A tipagem está forte e explícita?
4. A lógica está no lugar correto?
5. A UI ajuda o operador ou atrapalha?

---

**Se houver dúvida, priorize clareza, rastreabilidade e fidelidade operacional.**

Use o seguinte documento como referência canônica para decisões de implementação, arquitetura e UX. Ele é a “bíblia” do projeto e deve ser seguido rigorosamente para garantir consistência e qualidade.
[Container Tracking Platform — Master Technical & Product Document (0209)](../docs/master-consolidated-0209.md)

Para consulta, temos o roadmap atual [Roadmap Consolidado (0209)](../docs/roadmap-consolidated-0209.md) que detalha as fases de desenvolvimento, entregáveis e critérios de aceite.

Outros documentos, potencialmente desatualizados, estão disponíveis na pasta [docs](../docs/0204) para referência histórica, mas o foco deve ser no documento master consolidado.