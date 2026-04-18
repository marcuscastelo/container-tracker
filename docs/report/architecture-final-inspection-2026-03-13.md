# Arquitetura — Bloco Final de Inspeção e Balanceamento (2026-03-13)

## Escopo e Base

Referências usadas nesta rodada:

- `docs/adr/0021-validation-layering-and-parsing-modes.md`
- `docs/ui-taxonomy-rollout-guideline.md`
- `docs/reports/dashboard-navbar-alerts-cluster-inspection-2026-03-13.md`
- `docs/plans/architecture-enforcement-next-steps.md`
- `docs/reports/code-report/code_report_20260313_033710.txt`

Observação: arquivo `docs/reports/code-report/code_report_20260313_042259.txt` não foi encontrado no workspace; esta inspeção foi consolidada com report `033710`.

---

## 1) Análise Arquivo por Arquivo

### 1.1 `src/shared/api/sync.bootstrap/sync.bootstrap.ports.ts`

**Classificação:** `REFACTOR LOCAL`

**Motivo técnico:**

- Boundary está correta (sem domínio), mas arquivo agrega múltiplas responsabilidades:
  - factories de ports
  - acesso Supabase
  - decode Zod
  - mapeamento de dados
- Não atua como composition root puro; concentra adapter logic em excesso.

**Refactor sugerido (cirúrgico):**

1. Separar por adapter (`sync-target-read`, `sync-queue`, `sync-status-read`) e deixar este arquivo como agregador.
2. Extrair schemas/row mappers para arquivo dedicado.
3. Isolar normalizações (`toPriority` e normalização de container) como helpers locais.

### 1.2 `src/modules/process/ui/api/process.api.ts`

**Classificação:** `REFACTOR LOCAL`

**Motivo técnico:**

- Boundary de transporte está boa (`typedFetch` + schemas), porém há acúmulo de:
  - fetch API
  - cache/prefetch/dedup de dashboard
  - mapeamento de resposta para VM
  - mutações de process/alert
- Resultado: concentração e menor clareza de ownership.

**Refactor sugerido (cirúrgico):**

1. Extrair leitura de dashboard + cache para módulo dedicado (`dashboard.api` + `dashboard.prefetch-cache`).
2. Extrair mutações de processo para módulo próprio.
3. Extrair ações de alerta para módulo próprio.

### 1.3 `src/modules/process/ui/screens/DashboardScreen.tsx`

**Classificação:** `HOTSPOT ESTRUTURAL`

**Motivo técnico:**

- screen concentra:
  - resources/fetch
  - hidratação query/storage
  - reconciliação realtime
  - timers de sync feedback
  - handlers de workflow
  - composição visual
- Mantém boundary de domínio, mas virou hub de orquestração complexo com queda de testabilidade.

**Refactor sugerido (cirúrgico):**

1. Extrair hook de query/filter/sort sync (URL + localStorage).
2. Extrair hook de realtime + local sync feedback.
3. Extrair controller hook e manter screen mais próxima de composição de View.

### 1.4 `src/capabilities/search/ui/SearchOverlay.panel.tsx`

**Classificação:** `HOTSPOT ESTRUTURAL`

**Motivo técnico:**

- lógica de busca/debounce está fora (ponto positivo), mas panel concentra:
  - trigger
  - modal
  - row rendering
  - ícones
  - formatação
  - labels/translation wiring
- É hub de apresentação com excesso de responsabilidades em único arquivo.

**Refactor sugerido (cirúrgico):**

1. Extrair `SearchTriggerButton`, `SearchResultRow` e `SearchFooter`.
2. Extrair presenter puro para labels/format/match-source.
3. Manter `SearchOverlayPanel` como composição dos blocos.

### 1.5 `src/modules/process/ui/components/DashboardProcessTable.tsx`

**Classificação:** `REFACTOR LOCAL`

**Motivo técnico:**

- Concentra múltiplas responsabilidades:
  - render de células
  - navegação de row
  - drag/drop de colunas
  - ordenação prioritária
  - estados de empty/loading/error
- Sem violação de domínio, mas com alto custo de manutenção e revisão.

**Refactor sugerido (cirúrgico):**

1. Separar header, row e cell-renderers em arquivos irmãos.
2. Extrair presenter de severidade/idade de alert.
3. Extrair hook de persistência/reordenação de colunas.

### 1.6 `tools/agent/agent.ts`

**Classificação:** `OBSERVE`

**Motivo técnico:**

- Hotspot operacional em grande parte legítimo (runtime principal), mas concentra:
  - bootstrap/config
  - heartbeat/control-plane
  - loop de processamento
  - realtime
  - update lifecycle
- Coesão funcional existe, porém tamanho e mistura dificultam evolução.

**Refactor sugerido (cirúrgico):**

1. Extrair `runtime-config/enrollment`.
2. Extrair `control-plane` (heartbeat/health).
3. Extrair `processing-loop` (lease/scrape/ingest).

### 1.7 `tools/agent/build-release.ts`

**Classificação:** `OBSERVE`

**Motivo técnico:**

- Crescimento majoritariamente legítimo de pipeline operacional (deploy/checksum/prune/preflight).
- Concentração alta, mas responsabilidade principal ainda é coerente.

**Refactor sugerido (cirúrgico):**

1. Extrair preflight checks para módulo dedicado.
2. Extrair runtime dependency pruning para módulo dedicado.
3. Deixar `build-release.ts` mais orquestrador.

### 1.8 `tools/agent/supervisor.ts`

**Classificação:** `OK (crescimento legítimo)`

**Motivo técnico:**

- Arquivo funciona como state machine de supervisão/rollback/health gate.
- Complexo por natureza operacional, porém com responsabilidade clara e boundaries estáveis.

**Refactor sugerido (opcional):**

1. Extrair decisões de rollback/crash-loop para helpers puros.
2. Reforçar testes de tabela para regras de decisão.

### 1.9 `tools/agent/cli/ct-agent.ts`

**Classificação:** `REFACTOR LOCAL`

**Motivo técnico:**

- Mistura roteamento de comandos CLI com parsing/enrollment/config.
- Duplica parte relevante da lógica já presente em `tools/agent/agent.ts`.

**Refactor sugerido (cirúrgico):**

1. Extrair utilitário compartilhado de runtime/bootstrap config para `tools/agent`.
2. Separar handlers por comando (`status`, `logs`, `restart`, `enroll`).
3. Manter `ct-agent.ts` como command router fino.

---

## 2) Padrões Recorrentes Observados

1. UI screens/panels/tables virando hubs de orquestração/apresentação complexos.
2. Boundaries de API UI com tendência de acumular transporte + cache + orchestration.
3. Cluster de tooling com duplicação de lógica de config/enrollment entre runtime e CLI.

Impacto:

- Menor legibilidade e velocidade de revisão.
- Maior custo para testes direcionados por responsabilidade.
- Risco de drift gradual de ownership, mesmo sem quebra arquitetural imediata.

---

## 3) ADR — Decisão

**Nenhum ADR novo necessário neste estágio.**

Justificativa:

- Problemas identificados são localizados e resolvíveis com decomposição/refactor local.
- Regras e ownership já cobertos por ADR-0021 + guideline/checklists vigentes.
- Não foi identificada ambiguidade transversal nova que exija formalização adicional.

---

## 4) Avaliação Final de Saúde Arquitetural

**Classificação:** `Saudável com hotspots controlados`

Justificativa:

1. Boundaries principais permanecem íntegros (sem vazamento relevante de verdade de domínio para UI).
2. Hotspots ativos estão mapeados com ações pequenas e objetivas.
3. risco atual é principalmente de manutenção/complexidade local, não de ruptura estrutural sistêmica.

---

## 5) Síntese de Prioridade de Execução (Refactor Local)

1. `DashboardScreen.tsx` (HOTSPOT ESTRUTURAL)
2. `SearchOverlay.panel.tsx` (HOTSPOT ESTRUTURAL)
3. `sync.bootstrap.ports.ts` e `process.api.ts` (REFACTOR LOCAL de boundary/orquestração)
4. `DashboardProcessTable.tsx` (REFACTOR LOCAL de decomposição)
5. `ct-agent.ts` (redução de duplicação)

