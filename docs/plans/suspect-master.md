# Documento Vivo — Tracking Validation Issues Plugináveis
## Contexto mestre de implementação contínua

## Finalidade deste documento

Este documento existe para manter contexto estável ao longo das fases de implementação da feature de **Tracking Validation Issues plugináveis**.

Ele deve permitir que, daqui a semanas, a implementação continue sem perda de contexto, sem drift semântico e sem reinterpretação errada da feature.

Este documento não substitui:
- MASTER_v2
- DOMAIN
- TRACKING_INVARIANTS
- TRACKING_EVENT_SERIES
- ARCHITECTURE
- TYPE_ARCHITECTURE
- BOUNDARIES
- UI_PHILOSOPHY
- ALERT_POLICY

Ele é um documento de contexto operacional e de implementação da feature.

---

# 1. Definição da feature

## 1.1 Nome conceitual

A feature trata de **Tracking Validation Issues**.

É um sistema de validações derivadas que identifica casos em que o sistema **pode não estar interpretando corretamente o rastreamento com confiança suficiente**.

## 1.2 O que ela NÃO é
A feature não é:
- novo status canônico
- novo tipo de observation
- novo tipo de snapshot
- correção automática de tracking
- UI heuristic engine
- alerta operacional genérico do embarque por padrão
- bug tracker de qualquer problema visual

## 1.3 O que ela é
A feature é:
- um sinal derivado paralelo
- canônico dentro do Tracking BC
- auditável
- extensível por detectores plugináveis
- agregável por escopo
- visível ao usuário quando necessário
- potencialmente útil para observabilidade futura de desenvolvimento

---

# 2. Princípios canônicos da feature

## 2.1 Ownership
Tracking é o único dono da semântica de validation issue.

## 2.2 Determinismo
Dadas as mesmas observations, a derivação dos validation issues deve ser determinística.

## 2.3 Append-only preservado
Validation issue nunca apaga:
- snapshots
- observations
- timeline facts
- conflicts

## 2.4 Uncertainty visible
A feature existe justamente para tornar visível a baixa confiança do sistema.

## 2.5 UI presentation-only
UI:
- renderiza
- destaca
- agrega visualmente
- guia o operador

UI não:
- detecta
- interpreta
- reconcilia
- decide severity
- decide conflito

## 2.6 Pluginável, mas simples
Abertura para extensão deve acontecer via:
- novo detector
- novo registro no registry
- novos testes
- eventual projeção

Não via:
- abstração genérica exagerada
- rule engine
- shared domain framework
- config runtime complexa

---

# 3. Filosofia semântica

## 3.1 Pergunta central
A pergunta da feature não é:
> “o embarque está ruim?”

A pergunta da feature é:
> “o sistema está sem confiança suficiente na própria leitura atual desse tracking?”

## 3.2 Quando deve aparecer
A feature deve aparecer quando houver evidência objetiva de que:
- a leitura atual pode estar semanticamente insegura
- o sistema pode estar interpretando errado
- pode ser necessária validação manual
- pode ser necessária intervenção futura de código

## 3.3 Quando NÃO deve aparecer
Não deve aparecer para:
- qualquer bug visual
- qualquer anomalia operacional comum
- qualquer atraso normal
- qualquer evento desconhecido isolado sem impacto semântico claro
- qualquer diferença estética de UI

---

# 4. Naming de produto

## 4.1 Nome interno
Internamente pode usar:
- `trackingValidationIssue`

ou equivalente próximo.

## 4.2 Nome externo
O nome externo final deve ser curto e validado visualmente.

Shortlist atual:
- Validação necessária
- Atenção necessária
- Rastreamento requer validação
- Rastreamento requer atenção
- Validação pendente

## 4.3 Regra de decisão
A decisão do nome visual deve ser feita:
- na tela real
- com Playwright abrindo as telas
- com inspeção manual do LLM
- priorizando não quebrar layout, não truncar feio e não poluir

---

# 5. Semântica de severidade

## 5.1 Severidades
- `ADVISORY`
- `CRITICAL`

## 5.2 Papel de cada uma
### ADVISORY
- inconsistência relevante
- leitura principal talvez ainda utilizável
- pede atenção/validação, mas não é o caso mais agressivo

### CRITICAL
- forte chance de a leitura atual estar perigosamente errada
- afeta compreensão principal do container/processo
- pode merecer destaque similar a alerta crítico

## 5.3 UI principal
A UI principal continua essencialmente binária:
- há validation issue
- não há validation issue

A severidade modula destaque/integração.

---

# 6. Funil de agregação

## 6.1 Princípio
A issue nasce granularmente e sobe de nível.

## 6.2 Fluxo de agregação
### ponto local
- ETA
- SERIES
- TIMELINE
- TIMELINE_BLOCK
- STATUS
- PROVIDER_INTERPRETATION

### container
O container é marcado como tendo validation issue quando houver finding ativo relevante.

### processo
O processo fica agregado como:
- contém containers que requerem validação

### dashboard
O dashboard não mostra tudo.
Ele mostra o agregado mínimo operacional.

## 6.3 Regra de navegação
O usuário deve sempre conseguir seguir o funil:
- dashboard
- processo
- container
- origem da issue

---

# 7. Fronteira semântica com bugs de UI

## 7.1 Regra formal
Tracking Validation Issue só pode nascer de problema detectável no backend canônico.

## 7.2 Se entrar na UI e ficar errado só na pintura
É bug de UI.  
Não é validation issue.

## 7.3 Pergunta operacional de decisão
Se eu abrir o DTO/read model backend, sem a UI, já consigo ver o erro semântico?

- Se sim → pode ser validation issue
- Se não → é bug de UI

---

# 8. Contratos centrais do sistema pluginável

## 8.1 TrackingValidationDetector
Contrato do detector pluginável.

Responsabilidades:
- receber contexto canônico
- avaliar regra semântica
- retornar zero ou mais findings
- não depender de UI
- não depender de HTTP
- não depender de capability

## 8.2 TrackingValidationContext
Contexto entregue ao detector.

Deve conter apenas dados canônicos do tracking, como:
- timeline derivada
- series
- status derivado
- bloco operacional derivado
- metadados mínimos do processo/container
- referências temporais
- leitura necessária de sync/history quando aplicável

Não deve conter:
- DTO HTTP
- ViewModel
- componente UI
- raw payload enorme sem necessidade
- services de interface

## 8.3 TrackingValidationFinding
Saída padronizada do detector.

Campos desejáveis:
- `code`
- `severity`
- `affectedScope`
- `summaryKey`
- `evidenceSummary`
- `debugEvidence`
- `detectorId`
- `detectorVersion`
- `isActive`

## 8.4 Registry
Registry explícito e determinístico.

Funções:
- registrar detectores ativos
- definir ordem estável
- permitir rollout incremental
- manter uma única forma de executar detectores

---

# 9. Estrutura de pastas desejada

## 9.1 Slice
```text
modules/tracking/features/validation/
  domain/
    model/
    detectors/
    registry/
    services/
  application/
    projection/
    usecases/
```

## 9.2 O que NÃO move
Permanecem horizontais:
- infrastructure
- interface/http
- ui
- application ports

## 9.3 Regra de naming
Preferir nomes de domínio claros:
- validation
- detector
- finding
- registry

Evitar:
- manager
- helpers
- engine genérico
- rules misc

---

# 10. Detectores V1 fechados

## 10.1 Detector #1
### código
`CONFLICTING_CRITICAL_ACTUALS`

### motivação
Conflitos ACTUAL críticos irreconciliáveis podem comprometer severamente a leitura atual.

### exemplos
- dois `ACTUAL DISCHARGE` incompatíveis
- múltiplos ACTUALs críticos incompatíveis na mesma série

### severidade
`CRITICAL`

### escopo típico
- SERIES
- TIMELINE
- CONTAINER

---

## 10.2 Detector #2
### código
`POST_COMPLETION_TRACKING_CONTINUED`

### motivação
Container/processo já encerrado continua recebendo tracking incompatível, geralmente por reuso de container ou contaminação de ciclo.

### marcos fortes v1
- `DELIVERED`
- `EMPTY_RETURNED`

### severidade
`CRITICAL`

### escopo típico
- CONTAINER
- PROCESS
- TIMELINE

---

## 10.3 Detector #3
### código
`CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`

### motivação
A classificação canônica da timeline/read model ficou semanticamente absurda, mas a incoerência já existe antes da UI.

### exemplo
- item com forte contexto marítimo aparecendo em post-carriage no backend canônico

### severidade
`ADVISORY` por padrão

### regra de fronteira
Nunca disparar por bug meramente visual.

---

# 11. Detectores V1.1 candidatos

Detectores ainda não fechados completamente, mas previstos no plano:

## 11.1 `UNRECONCILABLE_TRACKING_STATE`
Estado do tracking atual semanticamente inseguro e irreconciliável.

## 11.2 `EXPECTED_PLAN_NOT_RECONCILABLE`
Mudança/replan expected que o sistema não consegue reconciliar com confiança.

## 11.3 `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT`
Milestone crítica ausente em contexto fortemente contraditório.

Regra: só entram quando houver critério objetivo e testes robustos.

---

# 12. Detectores V2 candidatos

Estes não são escopo de implementação da V1, mas devem permanecer documentados.

## 12.1 `IMPOSSIBLE_POST_MILESTONE_REGRESSION`
Regressão impossível após marco forte.

## 12.2 `ACTIVE_EXPECTED_INCOMPATIBLE_WITH_ACTUAL`
Expected ainda ativo apesar de ACTUAL consolidado já invalidá-lo.

## 12.3 `EXPECTED_PLAN_NOT_RECONCILABLE`
Versão mais robusta e completa do reconcile expected.

## 12.4 `FRAGMENTED_EXPECTED_SERIES`
Fragmentação indevida de séries expected.

## 12.5 `PROBABLE_MULTI_CYCLE_MIX`
Mistura provável de dois ciclos logísticos no mesmo processo/container.

## 12.6 `IMPOSSIBLE_OPERATIONAL_BLOCK`
Bloco operacional canônico estruturalmente impossível.

## 12.7 detectores agregados de provider health
- perda súbita de milestones críticos
- payload semanticamente empobrecido
- explosão de unknown/unclassified em região crítica

---

# 13. Customer-facing vs dev-facing

## 13.1 Estado atual
Na V1, o foco principal é customer-facing com semântica de produto adequada.

## 13.2 Futuro
A infraestrutura deve ficar preparada para findings:
- `USER_VISIBLE`
- `DEV_OBSERVABILITY_ONLY`
- `BOTH`

## 13.3 Regra atual
A V1 não depende de:
- Sentry
- email
- painel dev
- infraestrutura externa nova

---

# 14. Alertas e validation issues

## 14.1 Regra
Validation issue não substitui alert canônico.

## 14.2 Integração possível
Alguns casos críticos podem virar alerta backend-derived quando:
- isso trouxer clareza
- não gerar duplicidade confusa
- respeitar a política de alertas já existente

## 14.3 Cuidado
Não misturar:
- “embarque crítico”
com
- “sistema sem confiança suficiente”

Às vezes coincidem. Às vezes não.

---

# 15. Observabilidade histórica

## 15.1 Persistência desejada
Registrar transições:
- `activated`
- `changed`
- `resolved`

## 15.2 Natureza do dado
É dado operacional, não canônico.

## 15.3 Não fazer
- snapshot completo por sync
- duplicação massiva
- mistura com snapshots/observations/status

## 15.4 Objetivos futuros
- incidência por provider
- comparação antes/depois de correção
- duração média das issues
- debugging histórico

---

# 16. Time travel

## 16.1 Regra
O time travel deve mostrar a feature coerente por sync.

## 16.2 Estratégia
- preferir reconstrução derivada por sync
- usar lifecycle persistido como observabilidade, não como source of truth visual principal

## 16.3 Risco evitado
Não criar segunda fonte de verdade histórica.

---

# 17. Performance e payload

## 17.1 Dashboard
Deve receber apenas agregados mínimos:
- has issue
- highest severity
- count
- talvez top summary compacto

## 17.2 Shipment
Pode receber mais detalhe agregado.

## 17.3 Evidence
### summary
curto, seguro para UI

### debug
mais técnico, leve, sem explodir payload

## 17.4 Regra
Nada de mandar evidence pesada para dashboard.

---

# 18. Contratos de UI

## 18.1 Dashboard
- badge/indicação agregada
- sem peso semântico local
- sem rederivação

## 18.2 Shipment header
- banner agregador
- mensagem do tipo:
  - este processo contém containers que requerem validação

## 18.3 Container level
- chip/indicador claro

## 18.4 Timeline
- marcação discreta quando necessário
- sem virar árvore de natal
- sem quebrar timeline-first
- sem cards quebrando a cronologia

---

# 19. QA e testes

## 19.1 Testes automatizados disponíveis
- unitários
- `pnpmcheck`

## 19.2 Não disponível hoje
- suíte automatizada ampla de e2e instrumentado
- observabilidade madura de dev

## 19.3 QA manual obrigatório
Cada fase deve incluir QA manual real do LLM.

## 19.4 Playwright
Pode ser usado para:
- abrir telas
- navegar
- comparar visualmente
- validar naming/layout

Não como substituto de julgamento manual.

---

# 20. Regras de implementação por fase

Cada fase deve:
- ser end-to-end
- atravessar backend + DTO + VM + UI
- respeitar boundaries
- incluir i18n
- incluir prefetch/realtime/refresh quando afetados
- incluir testes unitários
- incluir QA manual
- passar no `pnpmcheck`
- gerar 1 commit

---

# 21. Anti-patterns proibidos

## 21.1 Proibidos na feature
- detector em UI
- detector em capability
- detector em route
- status canônico novo para “suspect”
- `if/else` espalhado fora do registry
- payload gigante para dashboard
- debug evidence técnica vazando sem controle
- bug visual tratado como validation issue
- shared kernel com semântica de detector
- abstração genérica exagerada
- “plugin system” mágico

## 21.2 Proibidos no naming técnico
- `helpers`
- `manager`
- `misc`
- `pipeline engine` genérico

---

# 22. Crosswalk — preservação do plano antigo

Esta seção existe para garantir que a reescrita pluginável não perca nada.

## 22.1 Plano antigo → plano novo

### Plano antigo Fase 1
Base arquitetural e contratos E2E  
→ preservado no novo:
- Fase 1

### Plano antigo Fase 2
UI mínima + naming  
→ preservado no novo:
- Fase 2

### Plano antigo Fase 3
Conflitos críticos de ACTUAL  
→ preservado no novo:
- Fase 2

### Plano antigo Fase 4
Tracking após encerramento forte  
→ preservado no novo:
- Fase 3

### Plano antigo Fase 5
Severidade dupla + alert integration  
→ preservado no novo:
- Fase 4

### Plano antigo Fase 6
Classificação canônica inconsistente  
→ preservado no novo:
- Fase 5

### Plano antigo Fase 7
Histórico por transição  
→ preservado no novo:
- Fase 6

### Plano antigo Fase 8
Time travel + payload/prefetch  
→ preservado no novo:
- Fase 7

### Plano antigo Fase 9
Dois detectores extras  
→ preservado no novo:
- Fase 9

### Plano antigo Fase 10
Polimento final  
→ preservado no novo:
- Fase 10

## 22.2 O que foi adicionado
A única nuance nova estrutural é:
- tudo nasce pluginável desde a fase 1
- e existe uma fase explícita de hardening/documentação do framework (fase 8)

Nada do plano antigo foi removido em semântica.

---

# 23. Decisões já fechadas

- V1 já nasce pluginável
- tracking é o dono
- UI não detecta
- severidade interna é `ADVISORY | CRITICAL`
- UI principal continua binária
- nome visual final será decidido por teste real de tela
- evento não mapeado genérico não entra como gatilho bruto da V1
- conflito ACTUAL crítico entra
- tracking pós-conclusão entra
- classificação canônica inconsistente entra se o erro já existir antes da UI
- histórico preferido é por transição
- dashboard segue leve
- shipment segue timeline-first
- nada de feature engine genérica exagerada

---

# 24. Perguntas em aberto que ainda podem mudar no futuro

- nome final do badge
- quais dois detectores exatos entram na fase 9
- se todos os criticals devem sempre gerar alert ou não
- quando abrir findings dev-facing explicitamente
- quando ligar observabilidade de desenvolvimento externa
- quando implementar feature de corte/truncamento manual do tracking contaminado

---

# 25. Regra suprema da feature

Se a feature precisar entender semântica de evento, série, timeline, status ou expected/actual, ela pertence ao **Tracking BC** e deve ser implementada como detector pluginável dentro do sistema canônico de validation issues.

---

# TL;DR

## O que este documento garante
- a feature foi definida semântica e arquiteturalmente
- o plano antigo foi preservado
- a nuance pluginável foi adicionada sem perder escopo
- existe uma trilha clara de V1, V1.1 e V2

## O que fazer durante as fases
- sempre consultar este documento antes de abrir uma nova fase
- usar o crosswalk para verificar se nada foi perdido
- atualizar apenas as seções mutáveis, sem apagar decisões já fechadas

## Resultado esperado
Ao final das fases, o sistema terá uma V1 de validation issues sólida, extensível e fiel à arquitetura do projeto.