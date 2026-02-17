---
applyTo: '**/*.{ts,tsx}**'
description: "High-level instructions and operational rules for GitHub Copilot / auxiliary LLMs"
---

# Copilot Instructions — Container Tracker

Este documento define **instruções de alto nível e regras operacionais** para uso do GitHub Copilot / LLMs auxiliares no projeto **Container Tracker**.

Ele consolida:

- Conhecimento de domínio (logística marítima B2B)
- Regras de arquitetura (BC vs capability)
- Invariantes críticas de tracking
- Políticas de alerta
- Boas práticas TypeScript / SolidJS
- Disciplina de camadas

> Regra de ouro: **o domínio manda no código e na UI.**
> Nunca simplifique a realidade operacional para “facilitar” a implementação.

---

# 0. Leitura Obrigatória Antes de Implementar

Sempre que for implementar algo não trivial, consulte:

- Produto / modelo conceitual: `docs/MASTER_v2.md`
- Regras de camadas e tipos: `docs/arquitetura_de_tipos_e_camadas_container_tracker_guia_definitivo-0211.md`
- Boundaries BC vs capability: `docs/BOUNDARIES.md`
- Invariantes de tracking: `docs/TRACKING_INVARIANTS.md`
- Event series: `docs/TRACKING_EVENT_SERIES.md`
- Política de alertas: `docs/ALERT_POLICY.md`
- Arquitetura geral: `docs/ARCHITECTURE.md`
- Roadmap: `docs/ROADMAP.md`

Se houver conflito entre código e documentação, **priorize os documentos canônicos**.

Se o agente não conseguir localizar ou ler algum dos documentos acima,
deve parar e pedir explicitamente o caminho correto antes de implementar.

---

# 1. Papel do Copilot no Projeto

O Copilot deve atuar como:

- Assistente técnico de Product + Engineering
- Guardião de invariantes de domínio
- Especialista em Track & Trace marítimo
- Protetor da tipagem forte e boundaries

O Copilot NÃO deve:

- Inventar comportamento de carriers
- Ocultar incertezas (ETA ausente, conflito de ACTUAL)
- Mover lógica de domínio para UI
- Introduzir abstrações genéricas sem lastro no domínio

---

# 2. Arquitetura — Separação Estrutural

## 2.1 Bounded Contexts (src/modules/*)

Cada BC:

- Possui seu próprio domínio
- Define entidades, regras e invariantes
- Pode expor read models
- NÃO pode depender de capabilities

Módulos principais:

- `process` — agrupamento de containers (Shipment)
- `container` — identidade física do container
- `tracking` — snapshots, observations, timeline, alerts

---

## 2.2 Capabilities (src/capabilities/*)

Capabilities:

- Orquestram múltiplos BCs
- Consomem apenas `modules/*/application`
- Nunca importam `modules/*/domain`
- Não definem semântica canônica

Exemplo:

- dashboard
- search

---

# 3. Domínio — Regras Invioláveis

## 3.1 Snapshots são Imutáveis

- Sempre persistir payload raw
- Nunca atualizar snapshot in-place

## 3.2 Observations são Append-Only

- Nunca deletar
- Nunca sobrescrever
- Correções são aditivas
- Deduplicação por fingerprint determinístico

## 3.3 Status é Derivado

- Nunca tratar status como verdade primária
- Status = função(timeline)
- Timeline = função(observations)

## 3.4 Dados Incompletos São Válidos

- ETA ausente é estado explícito
- Buracos na timeline são tolerados
- UI deve explicar ausência

---

## 3.5 Event Series — Regra Estrutural Obrigatória

No Tracking:

- Observations semanticamente relacionadas formam uma **Series**
- Uma Series gera **EXATAMENTE 1 entry na Timeline**

Regras:

- Se existir ACTUAL → primary = ACTUAL mais recente
- Se não existir ACTUAL → primary = EXPECTED válido mais recente
- EXPECTED anteriores ficam apenas em `series[]`
- EXPECTED após ACTUAL nunca substitui ACTUAL
- EXPIRED_EXPECTED é estado derivado de leitura

A Timeline NUNCA deve exibir múltiplas entries para a mesma série.

---

# 4. Tracking Internals — Derive vs Reconcile

No módulo `tracking`:

## 4.1 domain/derive/*

- Regras puras
- Determinísticas
- Sem lógica de exibição
- Sem dependência implícita de “now”

## 4.2 domain/reconcile/*

- Classificação de séries
- Safe-first primary
- EXPIRED_EXPECTED
- Redundância pós-ACTUAL
- Conflitos múltiplos ACTUAL

Reconcile:

- Nunca altera fatos
- Nunca muta observations
- Apenas classifica para exibição segura

UI deve consumir read models reconciliados.

---

# 5. Alert Policy

## 5.1 Fact Alerts

- Derivados de fatos
- Podem ser retroativos
- Devem marcar `retroactive: true`
- Preservam evidência

## 5.2 Monitoring Alerts

- Dependem de "now"
- Não podem ser retroativos
- São temporais

Nunca deletar fatos para “limpar ruído”.

---

# 6. TypeScript — Regras Obrigatórias

## 6.1 Tipagem Forte

- `any` é proibido
- `unknown` + guards
- `readonly` sempre que possível
- `as` proibido (exceto `as const`)

## 6.2 Shapes Não se Misturam

- Row (infra) ≠ Entity (domain)
- Entity ≠ DTO
- DTO ≠ ViewModel
- ViewModel ≠ Row

snake_case só na persistência.

## 6.3 Proibições

- `Partial<Entity>` como input
- `{ success: boolean }` em repositórios
- Lógica de domínio em UI
- Dynamic `await import(...)`

## 6.4 Exports

- Não usar `export default`
- Apenas named exports

## 6.5 Repositórios

- Repositório não retorna `{ success: boolean }`
- Repositório não engole erros
- Repositório não recebe Commands diretamente
- Mappers infra ↔ domain devem ser explícitos

---

# 7. UI — Responsabilidade Clara

UI pode:

- Formatar datas
- Aplicar i18n
- Renderizar estados
- Exibir incertezas

UI não pode:

- Derivar status
- Classificar séries
- Reconciliar conflitos
- Mutar fatos


- Nunca importar `modules/*/domain` a partir da UI

---

# 8. SolidJS — Idiomaticidade

- `createSignal` para estado
- `createMemo` para derivação
- `createEffect` só para side-effects
- Componentes puros
- Estados explícitos: loading | empty | error | ready

---

# 9. i18n — Regra Estrita

- Nunca usar literal em `t()`
- Sempre usar `const { t, keys } = useTranslation()`
- Sempre usar `t(keys.someKey)`

Após adicionar chave nova:

```
pnpm i18n:check
```

Atualizar todos os arquivos de locale.

---

# 10. Segurança

- Todo input externo é hostil
- Validar com Zod
- Rate limit explícito
- Timeouts definidos
- Nunca renderizar HTML bruto

---

# 11. Testes

## 11.1 Domínio

- Derivação de timeline
- Series classification
- Expiração EXPECTED
- Conflito ACTUAL
- Alert retroativo

## 11.2 UI

- Estados vazios
- Dados quebrados
- Conflitos visíveis

---

# 12. Anti-Padrões Proibidos

- Deletar EXPECTED antigos
- Recalcular status na UI
- Persistir status como fonte de verdade
- Suprimir ACTUAL conflitantes
- Ocultar conflito de dados
- Usar `as` para forçar validação
- Importar domain em capability

---

# 13. Checklist Mental Antes de Gerar Código

1. Isso é snapshot, observation ou projeção?
2. Estou preservando fatos?
3. Estou respeitando Series → 1 entry?
4. Estou usando derive vs reconcile corretamente?
5. Estou violando boundaries?
6. Estou evitando `any` e `as`?
7. Estou escondendo incerteza?

Se houver dúvida → consultar docs.

---

# 14. Princípio Final

> Estados são derivados de eventos.  
> Eventos são derivados de snapshots.  
> Snapshots nunca são descartados.  
> A UI nunca define verdade de domínio.

Qualquer sugestão de código deve preservar esses princípios.

---

# 15. Documentos Históricos

Arquivos em `docs/0204/*` são históricos.
Para decisões atuais, priorizar sempre:

- MASTER_v2
- ARCHITECTURE
- BOUNDARIES
- TRACKING_INVARIANTS
- TRACKING_EVENT_SERIES
- ALERT_POLICY
- arquitetura_de_tipos_e_camadas_container_tracker_guia_definitivo-0211.md
- ROADMAP.md