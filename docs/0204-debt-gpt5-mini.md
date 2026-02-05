# Dívida Técnica — análise rápida (2026-02-04)

Autor: GitHub Copilot (GPT-5 mini)
Contexto: análise dos últimos 10 commits na branch `main` e impacto no produto "Container Tracker".

Sumário executivo
-----------------
- Avanço rápido nos últimos commits trouxe funcionalidades úteis (CopyButton, melhorias no `ShipmentView`, reorganização de schemas e imports), mas também introduziu débito técnico relevante:
  1. lógica duplicada de clipboard;
  2. parsing/enriquecimento de dados realizado na camada de UI (`ShipmentView`);
  3. utilitários específicos implementados inline (ex.: `carrierTrackUrl`);
  4. gaps de i18n (chaves declaradas no componente vs. locales);
  5. impacto de refactors massivos de import paths/arquivos (possíveis artefatos .bak e scripts duplicados);
  6. dispersão de parsing entre adapters e UI.

Este documento descreve o racional, evidências, impacto e recomendações práticas ordenadas por prioridade.

1) Últimos 10 commits (resumo relevante)
--------------------------------------
- 2e632d6 feat(copy-button): implement reusable CopyButton component — adicionou `src/shared/ui/CopyButton.tsx`, atualizou `ShipmentView.tsx`, `src/app.css`, `docs/idea-dump.md`.
- 9988fe6 feat(shipment-view): add clipboard copy functionality for container numbers with animation — `src/modules/process/ui/ShipmentView.tsx`.
- 3791736 style(process-ref): update process reference id format — `src/modules/dashboard/ui/Dashboard.tsx`, `src/modules/process/ui/ShipmentView.tsx`.
- e355839 feat(shipment-view): implement clipboard copy functionality for container numbers — `src/modules/process/ui/ShipmentView.tsx`.
- d00c089 feat(shipment-view): add carrier tracking URL functionality in ShipmentView — `src/modules/process/ui/ShipmentView.tsx`.
- b1c54fe feat(idea-dump): add carrier metadata storage suggestion — `docs/idea-dump.md`.
- cb3ee6a feat(container): provide detailed status and event timeline — atualizou adapters (`src/adapters/*`), `ShipmentView.tsx`, dashboard, e rotas API.
- 3fbe874 refactor(schemas): move schema files to src directory — `src/schemas/*` reorganizados.
- f6adb52 refactor(imports): update import paths to use proper `~` — muitos arquivos atualizados.
- 60a6bcf refactor(imports): enforce absolute imports using '~' alias — mudanças de configuração e scripts.

2) Evidências e locais afetados
--------------------------------
- Código duplicado de clipboard
  - `src/modules/process/ui/ShipmentView.tsx` contém uma função `copyToClipboard` (fallback + execCommand) e o projeto agora tem `src/shared/ui/CopyButton.tsx` com implementação similar.

- Parsing/enriquecimento no UI
  - `ShipmentView.tsx` implementa `fetchProcess()` que consome `/api/processes/:id` e mapeia `ProcessApiResponse` para `ShipmentDetail` (cria evento de sistema, mapeia events -> timeline, formata datas, monta `AlertDisplay` etc.).
  - Adapters em `src/adapters/*` também foram modificados recentemente (commit `cb3ee6a`) — duplicação de responsabilidades.

- Utilitários inline
  - `carrierTrackUrl()` está em `ShipmentView.tsx`.

- i18n
  - `ShipmentView.tsx` declara uma tabela `keys = { ... }` (boa prática), mas algumas chaves referenciadas não encontram correspondentes em todos os `src/locales/*.json` (ex.: `shipmentView.loading`, `shipmentView.noEvents`, `shipmentView.processCreated`, etc.).

- Refactors de imports e schemas
  - Mudanças de import-path para `~` e movimentação de schemas aumentaram a superfície de alteração; há arquivos com nomes que sugerem artefatos (`*.bak`) e scripts antigos que podem conflitar.

3) Impacto no projeto (por prioridade)
-------------------------------------
- Alta — separação de camadas violada: parsing/enriquecimento no UI
  - Torna difícil testar regras de derivação, reproduzir comportamento em outras telas e manter contract com adapters.

- Alta — dispersão / duplicação de lógica (clipboard, parsing)
  - Aumenta custo de manutenção; bugs e divergências são prováveis.

- Média — i18n incompleta
  - Risco de strings faltantes em runtime e experiência inconsistente entre idiomas.

- Média — utilitários inline e falta de testes
  - Dificulta reuso e cobertura de testes.

- Baixa → Média — refactors de import-paths e arquivos .bak
  - Risco de build/lint quebrado se `tsconfig`/bundler não estiverem alinhados; limpeza necessária.

4) Recomendações práticas (ordem sugerida)
-----------------------------------------
Curto prazo (quick wins — 0.5h a 1 dia)
- Extrair função de clipboard compartilhada
  - Criar `src/shared/utils/clipboard.ts` com `copyToClipboard(text: string): Promise<void>` que implemente fallback e exporte.
  - Atualizar `src/shared/ui/CopyButton.tsx` para importar e usar a util.
  - Remover implementação duplicada de `copyToClipboard` de `ShipmentView.tsx` e usar `CopyButton` quando for interação com feedback; quando for ação programática (ex.: abrir link e copiar), importar a util.

- Extrair `carrierTrackUrl` para util
  - Criar `src/shared/utils/carrier.ts` com `carrierTrackUrl(carrier: string | null, containerNumber: string): string | null` e testes unitários simples.

- Corrigir i18n imediatamente
  - Auditar chaves declaradas em `ShipmentView.tsx`; garantir presença em `src/locales/en-US.json`, `pt-BR.json`, `pt-PT.json` com placeholders curtos.
  - Rodar o verificador de chaves i18n local: `pnpm i18n:check` (projeto inclui script `scripts/check-i18n-keys.mjs`).

Médio prazo (refactor seguro — 1 a 5 dias)
- Mover parsing/enriquecimento para presenter/adapter
  - Criar `src/modules/process/application/processPresenter.ts` (ou `src/adapters/process.presenter.ts`) que recebe o `ProcessApiResponse` e retorna o `ShipmentDetail` que a UI espera.
  - A presenter deve reutilizar `src/adapters/*` e `src/schemas/*` (usar tipos canônicos) e conter a transformação (criação de evento system-created, mapeamento de eventos, formatação de datas no formato desejado pela UI, não no formato de exibição — preferir ISO ou data bruta e deixar formatação na UI quando for about locale).
  - Adaptar `ShipmentView.fetchProcess()` para delegar ao presenter.
  - Cobrir presenter com testes unitários (sat de inputs dos adapters/carriers).

- Consolidar parsing entre adapters e presenter
  - Garantir que `src/adapters/*` retornem payload canônico (usar `canonical.schema.ts`) e que o presenter seja a única peça que gere o shape final do UI.

Longo prazo (robustez, 3–10 dias)
- Cobertura de testes
  - Escrever testes unitários pour: adapters, presenter, util clipboard, carrier utils.
  - Considerar testes de integração simples para o fluxo `/api/processes/:id` → presenter → UI resource.

- Limpeza de repositório
  - Remover arquivos `.bak` e scripts obsoletos ou movê-los para `scripts/archive/` com nota explicativa no README.
  - Garantir `tsconfig.paths` e `biome`/linter alinhados com o uso de `~`.

5) PRs sugeridos (incrementais, cada PR pequeno)
-----------------------------------------------
- PR 1 — utilidades e i18n (quick wins)
  - Add `src/shared/utils/clipboard.ts`
  - Add `src/shared/utils/carrier.ts`
  - Update `CopyButton` to use clipboard util
  - Remove duplicate `copyToClipboard` from `ShipmentView` (import util when needed)
  - Add missing i18n keys to all locales and run `pnpm i18n:check`

- PR 2 — presenter scaffold
  - Add `src/modules/process/application/processPresenter.ts`
  - Migrate `fetchProcess()` mapping into presenter, keep `ShipmentView` using presenter result with same shape (backwards compatible)
  - Add unit tests for presenter using sample `ProcessApiResponse` payloads (use examples in `examples/`)

- PR 3 — adapters consolidation + tests
  - Reconcile `src/adapters/*` outputs with canonical schema
  - Add tests for edge cases (missing dates, expected vs actual events, unknown carriers)

- PR 4 — cleanup
  - Remove `.bak`, fix scripts, run `pnpm build` and `biome`.

6) Comandos de verificação e utilitários úteis
--------------------------------------------
Recomendo rodar localmente após cada PR:
```bash
# instalar dependências (se ainda não instaladas)
pnpm install

# rodar verificação de i18n (projeto tem script)
pnpm i18n:check

# rodar linter/formatter (biome)
pnpm run biome:check || pnpm run biome:fix

# rodar build / vite / testes (depende do setup)
pnpm build
pnpm test
```

7) Estimativas de esforço (ordem de prioridade)
- Quick fixes (PR 1): 0.5 — 1 dia
- Presenter (PR 2): 1 — 3 dias
- Adapters + testes (PR 3): 2 — 5 dias
- Cleanup e alinhamento build/paths: 0.5 — 1 dia

8) Checklist imediato (para abrir PRs hoje)
- [ ] Extrair `copyToClipboard` para `src/shared/utils/clipboard.ts` e atualizar usos
- [ ] Extrair `carrierTrackUrl` para `src/shared/utils/carrier.ts`
- [ ] Adicionar chaves i18n faltantes nas 3 locales
- [ ] Rodar `pnpm i18n:check` e corrigir problemas
- [ ] Criar PR pequeno com esses quick-fixes e referência a este documento

9) Notas finais e referências
--------------------------------
- Este documento foi produzido com base nos últimos 10 commits observados e nos arquivos de domínio/produto (`docs/master-0204.md`, `docs/idea-dump.md`, `docs/chat-gpt-brainstorm-1.md`). As recomendações seguem as regras de arquitetura do projeto: separar domínio/adapters/presenter/UI, tipagem forte e i18n consistente.
- Posso aplicar automaticamente os quick-fixes (extrair utils + i18n) e abrir patches locais. Diga se quer que eu comece pelo PR 1 agora.

---
Arquivo gerado automaticamente: `docs/0204-debt-gpt5-mini.md`
