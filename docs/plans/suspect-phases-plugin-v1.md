# V1 — Tracking Validation Issues Plugináveis desde a Fase 1
## Plano de implementação em 10 fases E2E

## Objetivo geral

Implementar feature de **Tracking Validation Issues** como sistema **pluginável desde início**, dentro do Tracking BC, para detectar casos em que sistema **pode não estar interpretando corretamente tracking com confiança suficiente**.

feature deve:

- preservar determinismo
- preservar auditabilidade
- manter tracking como único dono da semântica
- expor incerteza sem esconder conflitos
- permitir crescimento incremental por detectores
- suportar agregação processo → container → campo/bloco afetado
- manter UI como consumidora de truth, nunca como derivadora de truth

## Princípios obrigatórios

### 1. Não é status canônico novo
Validation issue não substitui:
- status
- timeline
- alerts canônicos
- observations
- snapshots

É **sinal derivado paralelo**.

### 2. Tracking é o dono
Toda regra semântica de validation issue nasce no Tracking BC.

### 3. UI não detecta
UI:
- renderiza
- agrega visualmente funil
- formata textos/i18n
- destaca visualmente

UI **não decide** quem requer validação.

### 4. Pluginável por código, não plataforma genérica exagerada
V1 deve nascer pluginável, mas sem overengineering:
- sem discovery mágico
- sem config dinâmica por banco
- sem engine genérica de rules
- sem plugin remoto

### 5. Dashboard leve, shipment mais detalhado
Dashboard recebe agregados mínimos.
Shipment/detail recebe detalhe suficiente para guiar operador até fonte do problema.

### 6. Tudo E2E por fase
Cada fase deve atravessar:
- tracking derivation
- application/projection
- response DTO
- UI mapper
- ViewModel
- UI real
- i18n
- prefetch/realtime/reconciliation
- testes unitários
- QA manual
- `pnpmcheck` verde
- 1 commit por fase

---

# Fase 1 — Fundação pluginável mínima E2E

## Objetivo
Criar fundação do sistema pluginável de validation issues dentro do Tracking BC, sem ainda depender de múltiplas regras complexas.

## Escopo
- Criar feature slice:
  - `modules/tracking/features/validation/`
- Definir contratos canônicos:
  - `TrackingValidationDetector`
  - `TrackingValidationContext`
  - `TrackingValidationFinding`
  - `TrackingValidationRegistry`
- Integrar registry ao pipeline de derivação do tracking
- Criar agregação canônica:
  - por container
  - por processo
- Propagar contratos até:
  - application/result/projection
  - response DTO
  - UI mapper
  - ViewModel
  - UI mínima
- Criar placeholders/slots visuais em:
  - dashboard
  - shipment header
  - container-level display
- Criar i18n base
- Garantir compatibilidade com:
  - realtime
  - refresh
  - prefetch
  - dashboard server-first reconciliation
  - time travel atual sem comportamento semântico novo

## Detectores reais nesta fase
Nenhum detector real ainda.
Pode existir detector nulo/mock controlado para wiring técnico.

## Regras arquiteturais
- tracking owns validation semantics
- capability não define detector
- UI não interpreta issue
- shared kernel não deve ser criado
- feature slice permanece dentro do tracking BC
- infraestrutura e HTTP continuam horizontais fora do feature slice

## Contratos mínimos
### `TrackingValidationFinding`
- `code`
- `severity`
- `affectedScope`
- `summaryKey`
- `evidenceSummary`
- `isActive`
- `detectorId`
- `detectorVersion`

### agregado por container
- `hasTrackingValidationIssue`
- `highestTrackingValidationSeverity`
- `trackingValidationIssueCount`
- `trackingValidationIssueCodes[]`

### agregado por processo
- `hasContainersRequiringValidation`
- `containersRequiringValidationCount`
- `highestTrackingValidationSeverity`

## UI mínima
### Dashboard
Suporte para indicar que processo contém containers com validation issue.

### Shipment
Suporte para:
- banner agregador no topo
- chip/indicador por container

Sem ainda detalhar marcação profunda da timeline.

## Testes
### Unit
- registry determinístico
- wiring de detector
- agregação vazia
- DTO -> VM mapping
- renderização condicional vazia

### Manual
- dashboard sem issue continua íntegro
- shipment sem issue continua íntegro
- realtime/refresh não quebram
- layout não quebra
- shipment segue timeline-first

## Critério de pronto
- base pluginável criada
- contratos estáveis
- sem regressão
- `pnpmcheck` verde
- 1 commit

---

## Prompt de implementação — Fase 1

Implemente fundação pluginável da feature de Tracking Validation Issues no Tracking BC.

Objetivo:
- criar feature slice `modules/tracking/features/validation`
- definir contratos estáveis de detector/context/finding/registry
- integrar essa derivação ao pipeline atual do tracking
- propagar resultados até DTO/VM/UI
- sem ainda ativar detectores reais complexos

Requisitos obrigatórios:
1. feature deve nascer **pluginável por código**, mas simples e explícita.
2. Nada de config dinâmica, rule engine genérica, DI abstrata demais ou plugin remoto.
3. registry deve ser explícito e determinístico.
4. Toda semântica deve permanecer no Tracking BC.
5. UI/capabilities/routes não podem derivar validation issue.
6. Criar agregação por container e processo.
7. Atualizar response DTOs, UI mappers e ViewModels.
8. Preparar dashboard e shipment para renderização futura da feature.
9. Adicionar i18n mínimo.
10. Garantir que realtime, prefetch, refresh e dashboard reconciliation continuem corretos.
11. Criar testes unitários mínimos do framework.
12. Fazer QA manual no app real.
13. Rodar `pnpmcheck` até verde.
14. Produzir exatamente 1 commit.

---

# Fase 2 — UI mínima funcional + naming validado + Plugin real #1

## Objetivo
Ativar UI mínima real da feature e implementar primeiro detector pluginável real:
**conflitos críticos de ACTUALs**.

## Escopo
- Escolher naming visual real
- Ativar renderização real em dashboard/shipment/container
- Implementar plugin:
  - `CONFLICTING_CRITICAL_ACTUALS`
- Integrar severidade `CRITICAL`
- Garantir que conflitos continuem visíveis sem apagar fatos
- Permitir que funil processo → container → origem do problema já exista visualmente

## Naming candidates para teste visual
- Validação necessária
- Atenção necessária
- Rastreamento requer validação
- Rastreamento requer atenção
- Validação pendente

## Detector #1
### código
`CONFLICTING_CRITICAL_ACTUALS`

### casos-alvo
- dois `ACTUAL DISCHARGE` irreconciliáveis
- múltiplos ACTUALs críticos incompatíveis na mesma série
- conflito ACTUAL crítico que compromete leitura atual

### severidade
`CRITICAL`

### escopo
- SERIES
- TIMELINE
- CONTAINER

## UI
### Dashboard
- exibir badge/indicação agregada
- ainda sem reordenar por regra nova própria

### Shipment
- exibir banner agregador
- exibir indicador no container afetado
- sem poluir timeline

## Testes
### Unit
- series com ACTUAL único não disparam
- séries com ACTUALs conflitantes disparam
- agregação container/processo funciona

### Manual
- caso real/fixture com múltiplos discharge ACTUAL
- testar label escolhido visualmente
- validar dashboard + shipment

## Critério de pronto
- naming final escolhido por teste real de tela
- detector pluginável #1 funcionando
- sem regressão da timeline
- `pnpmcheck` verde
- 1 commit

---

## Prompt de implementação — Fase 2

Implemente UI mínima funcional da feature e primeiro detector pluginável real `CONFLICTING_CRITICAL_ACTUALS`.

Objetivo:
- testar naming visual real
- ativar exibição real da feature
- detectar conflitos críticos de ACTUALs via plugin

Requisitos:
1. Testar visualmente no app labels candidatos.
2. Usar Playwright para abrir e navegar telas reais, mas decidir por inspeção manual do LLM, não por script automatizado de assert visual.
3. Escolher melhor label curto sem truncamento/quebra problemática.
4. Implementar plugin `CONFLICTING_CRITICAL_ACTUALS`.
5. Não apagar nem esconder fatos conflitantes.
6. Atualizar agregação, DTO, VM e UI.
7. Fazer testes unitários robustos.
8. Fazer QA manual real.
9. Rodar `pnpmcheck` até verde.
10. Exatamente 1 commit.

---

# Fase 3 — Plugin real #2: tracking continuando após encerramento forte

## Objetivo
Implementar segundo detector pluginável real:
**tracking continuando após encerramento forte do processo/container**.

## Escopo
- Implementar plugin:
  - `POST_COMPLETION_TRACKING_CONTINUED`
- Considerar encerramento forte v1 como:
  - `DELIVERED` ou `EMPTY_RETURNED`
- Detectar continuação incompatível de ciclo:
  - novo load
  - nova departure
  - novos expecteds de nova jornada
  - novos sinais de ciclo incompatível com processo encerrado

## Motivação
Evitar que entregues/empty returned passem parecer ativos com ETA por reuso de container ou tracking contaminado.

## Severidade
`CRITICAL`

## Escopo afetado
- CONTAINER
- PROCESS
- TIMELINE

## Fora de escopo
- truncamento automático
- corte manual
- reatribuição automática novo processo/BL

## Testes
### Unit
- delivered sem tracking posterior não dispara
- empty returned sem tracking posterior não dispara
- delivered/empty returned com novo tracking incompatível dispara

### Manual
- casos reais/fixtures de container reutilizado
- validar dashboard/shipment

## Critério de pronto
- detector #2 funcionando via plugin
- sem apagar fatos
- sem workaround de UI
- `pnpmcheck` verde
- 1 commit

---

## Prompt de implementação — Fase 3

Implemente plugin `POST_COMPLETION_TRACKING_CONTINUED`.

Objetivo:
- detectar tracking continuando após encerramento forte (`DELIVERED` ou `EMPTY_RETURNED`)
- marcar esse caso como validation issue `CRITICAL`

Requisitos:
1. Plugin isolado dentro do framework.
2. Usar somente contratos canônicos do Tracking BC.
3. Não apagar fatos nem truncar histórico.
4. Propagar até processo/container/dashboard/shipment.
5. Criar testes unitários cobrindo cenários com e sem reuso/continuação.
6. Fazer QA manual com fixture/caso real.
7. Rodar `pnpmcheck` até verde.
8. Exatamente 1 commit.

---

# Fase 4 — Severidade dupla real + agregação forte + integração com alertas onde fizer sentido

## Objetivo
Consolidar comportamento E2E de `ADVISORY|CRITICAL` no sistema pluginável.

## Escopo
- Tornar severidade parte real da cadeia:
  - detector
  - agregador
  - DTO
  - VM
  - UI
- Definir comportamento visual diferente para advisory vs critical
- Integrar critical ao sistema de alertas backend-derived quando encaixe for limpo
- Garantir que dashboard continue coerente com semântica de alertas existente

## Decisões
- UI principal continua binária do ponto de vista do usuário
- internamente severidade já existe
- dashboard não cria semântica paralela
- quando houver critical compatível, destaque pode seguir lógica de alerta crítico existente
- advisory pode existir sem destaque agressivo

## Testes
### Unit
- preservação de severidade no pipeline
- agregação correta
- mapping correto
- integração com alert, se implementada

### Manual
- cenário advisory mockado/controlado
- cenário critical real
- dashboard e shipment coerentes

## Critério de pronto
- `ADVISORY | CRITICAL` real em toda cadeia
- semântica visual consistente
- `pnpmcheck` verde
- 1 commit

---

## Prompt de implementação — Fase 4

Consolide severidade `ADVISORY|CRITICAL` no sistema pluginável de validation issues.

Objetivo:
- tornar severidade parte real do fluxo E2E
- alinhar visualmente com semântica de alertas já existente
- preparar sistema para detectores advisory reais

Requisitos:
1. Atualizar contratos internos, agregação, DTO, VM e UI.
2. Não criar semântica duplicada na UI.
3. Integrar com alertas backend-derived onde houver encaixe limpo e sem confusão.
4. Manter dashboard leve.
5. Criar testes unitários.
6. Fazer QA manual comparando advisory e critical.
7. Rodar `pnpmcheck` até verde.
8. Exatamente 1 commit.

---

# Fase 5 — Plugin real #3 (ADVISORY): classificação canônica inconsistente

## Objetivo
Implementar primeiro detector pluginável advisory real:
**classificação canônica inconsistente da timeline**.

## Escopo
- Implementar plugin:
  - `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
- Capturar casos em que inconsistência já existe no backend/read model canônico
- Exemplo:
  - contexto fortemente marítimo/vessel aparecendo como post-carriage no read model

## Regra de fronteira
Só entra se erro já existir:
- no backend canônico
- no read model
- no DTO derivado

Não entra:
- bug puramente visual
- label errada
- layout errado
- mapper UI mal posicionando dado correto

## Severidade
`ADVISORY` por padrão
Pode escalar em fases futuras se impacto for estrutural.

## Testes
### Unit
- casos consistentes não disparam
- caso backend/canônico absurdo dispara

### Manual
- reproduzir pelo menos caso real semelhante aos já vistos
- confirmar que erro existe antes da UI

## Critério de pronto
- detector advisory #3 funcionando
- fronteira UI-vs-canônico preservada
- `pnpmcheck` verde
- 1 commit

---

## Prompt de implementação — Fase 5

Implemente plugin `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`.

Objetivo:
- detectar inconsistências semânticas na classificação canônica da timeline
- garantir que regra só dispare quando erro existir antes da UI

Requisitos:
1. Plugin isolado.
2. Lógica no Tracking BC.
3. Nunca usar bug visual puro como gatilho.
4. Basear-se em sinais objetivos do pipeline canônico.
5. Severidade inicial `ADVISORY`.
6. Criar testes unitários.
7. Fazer QA manual confirmando que problema já existe no read model/DTO backend.
8. Rodar `pnpmcheck` até verde.
9. Exatamente 1 commit.

---

# Fase 6 — Histórico operacional por transição + plugin lifecycle

## Objetivo
Persistir lifecycle operacional das validation issues em modelo compatível com framework pluginável.

## Escopo
- Persistir transições:
  - `activated`
  - `changed`
  - `resolved`
- Guardar contexto mínimo:
  - process
  - container
  - issue code
  - detector id/version
  - severity
  - reason set hash / finding set hash
  - sync/snapshot de referência quando útil
- Não persistir snapshot completo por sync
- Não misturar com source of truth canônica

## Motivação
Permitir:
- auditoria de surgimento/desaparecimento
- análise futura por provider
- análise futura de regressão
- base de observabilidade sem explodir storage

## Regras
- dado operacional, não canônico
- não aplicar pruning dados canônicos
- não duplicar registros inúteis

## Testes
### Unit / integration local
- activated quando surge
- changed quando muda conjunto/severidade relevante
- resolved quando some
- dedupe de transições redundantes

### Manual
- validar transições nos detectores já implementados

## Critério de pronto
- lifecycle por transição funcionando
- sem snapshot bloat
- `pnpmcheck` verde
- 1 commit

---

## Prompt de implementação — Fase 6

Implemente persistência operacional do lifecycle de validation issues do sistema pluginável.

Objetivo:
- registrar transições relevantes dos findings ativos
- manter isso fora da source of truth canônica
- preparar observabilidade futura com baixo custo

Requisitos:
1. Persistir somente `activated`, `changed`, `resolved`.
2. Não gravar snapshot completo por sync.
3. Guardar contexto mínimo útil.
4. Evitar duplicação de eventos idênticos.
5. Não misturar com snapshots/observations/status truth.
6. Criar testes unitários/integration locais.
7. Fazer QA manual com detectores já implementados.
8. Rodar `pnpmcheck` até verde.
9. Exatamente 1 commit.

---

# Fase 7 — Integração completa com time travel, prefetch, realtime e payload optimization

## Objetivo
Garantir que feature pluginável se comporte corretamente em:
- time travel por sync
- refresh
- realtime
- prefetch
- dashboard reconciliation server-first

Sem inflar payload desnecessariamente.

## Escopo
- reconstrução correta por sync na UI histórica
- nenhum second source of truth local
- dashboard continua leve com agregados mínimos
- shipment/detail carrega mais detalhe só quando necessário
- ajustar VMs, prefetch e mappers para reduzir custo

## Estratégia
- preferir reconstrução derivada por sync
- lifecycle persistido serve como observabilidade, não como fonte principal de render
- manter dashboard enxuto
- manter shipment detalhado quando realmente preciso

## Testes
### Unit
- mapping por sync
- reconstrução por sync
- preservação de agregados leves no dashboard

### Manual
- navegar por syncs
- validar dashboard vs shipment
- validar realtime/refresh
- validar que badge acompanha corretamente estado histórico

## Critério de pronto
- feature correta no time travel
- payloads refinados
- server-first reconciliation preservada
- `pnpmcheck` verde
- 1 commit

---

## Prompt de implementação — Fase 7

Integre completamente feature pluginável ao fluxo de time travel, refresh, realtime, prefetch e otimização de payload.

Objetivo:
- garantir comportamento correto por sync
- manter dashboard leve
- evitar second source of truth
- revisar ViewModels e mappers para reduzir custo

Requisitos:
1. Reconstituir corretamente estado por sync.
2. Não usar lifecycle persistido como source of truth principal da UI histórica.
3. Manter dashboard leve.
4. Shipment/detail pode carregar mais detalhe quando necessário.
5. Respeitar dashboard reconciliation server-first.
6. Criar testes unitários relevantes.
7. Fazer QA manual navegando por syncs reais/fixtures.
8. Rodar `pnpmcheck` até verde.
9. Exatamente 1 commit.

---

# Fase 8 — Hardening do framework pluginável + evidence/debug contracts + documentação de extensão

## Objetivo
Consolidar framework pluginável para crescimento seguro.

## Escopo
- Refinar `TrackingValidationContext`
- Refinar `TrackingValidationFinding`
- Separar melhor:
  - `evidenceSummary`
  - `debugEvidence`
- Definir convenções claras de:
  - naming de detector
  - severity
  - affectedScope
  - user-visible vs dev-oriented fields
- Criar documentação interna:
  - como adicionar novo detector
  - onde registrar
  - que é proibido
  - como testar
  - como decidir entre advisory e critical

## Regras
- não mandar evidence técnica pesada para dashboard
- não expor detalhe técnico sem necessidade
- continuar sem infra futura inexistente (Sentry/email/etc.)

## Testes
### Unit
- serialização/mapping dos contracts refinados
- comportamento de aggregation com evidence controlada

### Manual
- validar que UI não ficou poluída
- validar que payload não inchou

## Critério de pronto
- framework endurecido e documentado
- base estável para V1.1 e V2
- `pnpmcheck` verde
- 1 commit

---

## Prompt de implementação — Fase 8

Faça hardening do framework pluginável de validation issues.

Objetivo:
- refinar contracts de finding/context
- separar evidenceSummary de debugEvidence
- documentar como novos plugins devem ser adicionados
- garantir payload/control adequado

Requisitos:
1. Refinar contracts sem quebrar boundaries.
2. Não mandar dados pesados ao dashboard.
3. Separar melhor dados de produto e dados técnicos.
4. Documentar framework de extensão dentro do repositório.
5. Criar testes unitários.
6. Fazer QA manual.
7. Rodar `pnpmcheck` até verde.
8. Exatamente 1 commit.

---

# Fase 9 — Detectores V1.1 plugináveis #4 e #5

## Objetivo
Adicionar dois detectores plugináveis adicionais já discutidos como candidatos fortes e ainda compatíveis com base existente.

## Detectores candidatos preferenciais
Escolher até dois entre:
- `UNRECONCILABLE_TRACKING_STATE`
- `EXPECTED_PLAN_NOT_RECONCILABLE`
- `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT`

## Critérios de escolha
- objetividade
- baixo falso positivo
- aderência aos casos reais já vistos
- bom encaixe no framework V1 pluginável
- impacto prático na leitura do cliente

## Escopo
- implementar 2 detectores
- integrar com agregação/UI
- revisar severidade caso caso
- testar fortemente

## Regras
- nada de heurística vaga
- nada de “parece estranho”
- cada detector precisa de critério formal e teste unitário robusto

## Testes
### Unit
- fixtures específicas por detector
### Manual
- casos reais ou equivalentes

## Critério de pronto
- dois detectores adicionais sólidos
- baixo ruído
- `pnpmcheck` verde
- 1 commit

---

## Prompt de implementação — Fase 9

Implemente dois detectores plugináveis adicionais da V1.1, escolhendo dois mais objetivos e úteis entre:

- `UNRECONCILABLE_TRACKING_STATE`
- `EXPECTED_PLAN_NOT_RECONCILABLE`
- `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT`

Objetivo:
- ampliar cobertura da feature sem cair em heurística vaga
- usar critérios objetivos sustentados por casos reais já analisados

Requisitos:
1. Escolher dois nesta fase.
2. Justificar tecnicamente escolha no resumo final.
3. Cada detector precisa de critério formal.
4. Cada detector precisa de testes unitários robustos.
5. Propagar até UI sem inflar payload desnecessariamente.
6. Fazer QA manual.
7. Rodar `pnpmcheck` até verde.
8. Exatamente 1 commit.

---

# Fase 10 — Polimento final, regressão ampla e fechamento da V1 pluginável

## Objetivo
Fechar V1 pluginável com:
- polimento
- revisão de UX
- revisão de textos/i18n
- revisão de payloads
- revisão de contratos
- QA manual amplo
- fechamento da V1 + V1.1 acordadas

## Escopo
- revisar todos detectores
- revisar todos payloads afetados
- revisar dashboard/shipment/container/timeline
- revisar realtime/prefetch/time travel/refresh
- eliminar resíduos técnicos
- revisar convenções de detector/registry
- revisar documentação
- verificar que nada da versão não-pluginável ficou sobrando

## QA manual obrigatório
Cobrir:
- sem issue
- advisory
- critical por conflito de ACTUAL
- critical por tracking pós-conclusão
- advisory de classificação canônica inconsistente
- detectores extras da fase 9
- dashboard
- shipment
- navegação por container
- time travel
- refresh/realtime
- larguras menores/responsividade básica

## Critério de pronto
- V1 pluginável completa no escopo acordado
- sem regressões graves
- `pnpmcheck` verde
- pronta para merge
- 1 commit final

---

## Prompt de implementação — Fase 10

Faça fechamento final da V1 pluginável de Tracking Validation Issues.

Objetivo:
- polir toda feature
- revisar UX, i18n, payloads, contratos, detectores, QA manual e regressões
- deixar V1/V1.1 pronta para merge

Requisitos:
1. Revisar cadeia inteira tracking -> application/projection -> DTO -> UI mapper -> VM -> UI.
2. Garantir que nada da feature ficou fora do framework pluginável.
3. Revisar textos e i18n.
4. Revisar densidade visual e consistência.
5. Revisar payloads e ViewModels.
6. Garantir que UI não rederiva semântica.
7. Fazer QA manual amplo.
8. Rodar `pnpmcheck` até verde.
9. Criar exatamente 1 commit final desta fase.

No resumo final, incluir:
- que foi ajustado
- que foi validado manualmente
- risco residual pequeno, se houver

---

## TL;DR

### O que muda em relação ao plano antigo
- V1 inteira já nasce pluginável
- framework vem antes dos detectores
- todas rules entram como detectores registrados
- nada da semântica sai do Tracking BC

### Ordem prática
1. framework pluginável
2. naming + UI mínima + primeiro detector
3. segundo detector
4. severidade/agregação/alerta
5. advisory canônico
6. histórico por transição
7. time travel/prefetch/realtime/payload
8. hardening e docs
9. dois detectores extras
10. polimento final

### Resultado esperado
Quando fase 10 terminar, V1 já estará pronta para crescer por novos detectores sem reabrir toda arquitetura.