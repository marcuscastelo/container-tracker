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

Quando for chamar a função de tradução (`t()`), sempre declare um objeto `const keys = { ... }` no topo do componente e use essas chaves (ex.: `t(keys.save)`).
Vantagens:
- Facilita refactors (renomear chaves em um único lugar).
- Mantém chaves agrupadas e legíveis no componente.
- Simplifica busca de onde uma chave é usada.

Exemplo de padrão em um componente:

```ts
const keys = { save: 'buttons.save', cancel: 'buttons.cancel' }
const { t } = useTranslation()
return <button>{t(keys.save)}</button>
```

Sempre prefira esse padrão em vez de usar literais de string diretamente em chamadas `t('buttons.save')` espalhadas pelo JSX.

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
