# V2 — Fase 1 — Framework canônico de plugins de validação

## Objetivo
Criar infraestrutura canônica para que Tracking BC suporte **plugins de validação** de forma aberta extensão e fechada para modificação ad hoc.

meta desta fase não é adicionar novos detectores complexos, mas estabelecer contrato estável no qual todos detectores futuros da V2 serão plugados.

## Motivação
Hoje feature de validation issue já tem regras pontuais.
V2 precisa evoluir para modelo em que novas detecções possam ser adicionadas sem:
- espalhar `if/else` por timeline/status/alerts/readmodels
- mover semântica para UI/capability
- criar shared kernel indevido
- violar ownership do Tracking BC

## Princípios arquiteturais obrigatórios
- Todo detector novo deve viver dentro do **Tracking BC**.
- semântica do detector nasce no domínio do tracking, não na UI, não em capability.
- UI consome `Response DTO -> ViewModel`.
- sistema deve continuar determinístico.
- sistema não pode apagar fatos, reescrever observations, nem “limpar” conflitos.
- framework de plugins não deve virar shared/domain nem utilitário global reutilizável fora do tracking sem ADR formal.

## Decisão estrutural
Criar nova feature slice no tracking:

`modules/tracking/features/validation/`

Estrutura sugerida:

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

## Conceitos centrais
### 1. TrackingValidationDetector
Contrato de detector pluginável.

Responsabilidades:
- receber contexto canônico suficiente
- avaliar condição semântica
- retornar zero ou mais validation findings
- não persistir nem emitir UI labels finais
- não depender de UI, HTTP ou capability

### 2. TrackingValidationContext
Contexto estável entregue ao detector.

Deve conter contratos canônicos internos do tracking, por exemplo:
- timeline derivada
- series derivadas
- status atual derivado
- metadados mínimos do processo/container
- leitura temporal necessária
- sinais auxiliares canônicos

Não deve conter:
- DTO HTTP
- ViewModel
- componente UI
- objeto de infra cru
- snapshots enormes se não forem necessários

### 3. TrackingValidationFinding
Saída padronizada de detector.

Campos sugeridos:
- code
- severity
- affectedScope
- evidenceSummary
- debugEvidence
- detectorId
- detectorVersion
- isActive

### 4. Validation Detector Registry
Registro canônico que decide quais detectores rodam e em que ordem.

Responsabilidades:
- compor detectores ativos
- preservar ordem determinística
- evitar acoplamento acidental
- permitir rollout incremental

## Regras de desenho
- Cada detector deve ser classe/função pura e isolada por arquivo.
- Cada detector deve ter nome de domínio, não nome técnico genérico.
- registry não pode conter regra semântica além de composição/ordenação.
- Detectores não podem depender uns dos outros de forma circular.
- Detectores podem compartilhar contratos estáveis internos, mas não devem compartilhar semântica escondida via `shared/`.

## Extensibilidade
abertura para extensão deve acontecer por:
- novo arquivo detector
- registro explícito no registry
- testes unitários próprios
- eventual projeção/application wiring

Não por:
- edição de vários pontos sem contrato
- `switch` gigante em arquivos centrais
- helpers genéricos que carregam semântica implícita

## E2E incluído na fase
- Novo slice `validation`
- Contratos de detector/context/finding
- Registry determinístico
- Wiring do pipeline atual para chamar registry
- Propagação dos findings até DTO/VM existentes, mesmo que sem novos detectores da V2 ainda
- Garantir que nada quebre em dashboard, shipment, realtime, prefetch e time travel atual

## Testes
### Unit
- registry executa detectores em ordem estável
- detectores não registrados não rodam
- contexto é imutável/readonly quando aplicável
- findings agregam corretamente

### Manual
- validar que sistema continua funcionando sem detectores V2 ativos
- validar que contratos chegaram ao front sem regressão visual
- validar que pnpmcheck permanece verde

## Critério de pronto
- framework pluginável criado
- semântica continua no Tracking BC
- zero regra de validação migrada para UI/capability
- todos próximos detectores podem nascer sobre esse framework
- 1 commit atômico

---

# Prompt de implementação — Fase 1

Implemente framework canônico de plugins de validação no Tracking BC.

Objetivo:
- criar feature slice `modules/tracking/features/validation`
- definir contratos estáveis para detectores plugináveis
- criar registry determinístico
- integrar esse framework ao pipeline atual de validation issue sem quebrar comportamento existente

Requisitos:
1. framework deve viver exclusivamente dentro do Tracking BC.
2. Não criar shared kernel sem ADR.
3. Não mover lógica semântica para UI, capability, routes ou infra genérica.
4. Criar contratos equivalentes:
   - `TrackingValidationDetector`
   - `TrackingValidationContext`
   - `TrackingValidationFinding`
   - `TrackingValidationRegistry`
5. registry deve ser explícito e determinístico.
6. feature deve continuar atravessando application -> HTTP DTO -> UI mapper -> ViewModel.
7. Não adicionar ainda novos detectores complexos da V2.
8. Garantir compatibilidade com realtime, prefetch, refresh e time travel atual.
9. Criar testes unitários do framework.
10. Fazer QA manual completo e rodar `pnpmcheck` até verde.
11. Produzir exatamente 1 commit dessa fase.

===

# V2 — Fase 2 — Contrato avançado de findings, severidade, escopo e evidência

## Objetivo
Refinar modelo do framework para suportar detectores mais ricos, sem explodir payload e sem tornar UI dependente de detalhes técnicos.

## Motivação
detectores da V2 não são todos iguais:
- alguns são do container inteiro
- alguns são do ETA
- alguns são da timeline/bloco
- alguns são mais voltados cliente
- alguns são mais úteis para dev observability futura

Precisamos modelar isso agora para evitar retrabalho.

## Escopo
Expandir `TrackingValidationFinding` e seus agregados para suportar:

### Escopo afetado
- PROCESS
- CONTAINER
- TIMELINE
- TIMELINE_BLOCK
- SERIES
- ETA
- STATUS
- PROVIDER_INTERPRETATION

### Severidade
- ADVISORY
- CRITICAL

### Ação sugerida
Campo opcional interno, por exemplo:
- REVIEW_TRACKING
- REVIEW_TIMELINE
- REVIEW_EXPECTED_PLAN
- REVIEW_PROCESS_BOUNDARY

Não para texto final da UI, mas para orientar agregação e futuro uso operacional.

### Tipo de consumidor
Campo opcional interno:
- USER_VISIBLE
- DEV_OBSERVABILITY_ONLY
- BOTH

Na V2 inicial, alguns detectores podem ser preparados mas não necessariamente expostos da mesma forma ao usuário.

## Agregação
Definir contrato estável de agregação:
- processo agrega containers
- container agrega findings locais
- shipment page expõe funil até fonte
- dashboard recebe agregados mínimos

## Evidence
Separar:
- `evidenceSummary`: curto, seguro para produto/UI
- `debugEvidence`: técnico, leve, útil para logs/observabilidade futura

Nunca mandar evidence técnica pesada para dashboard por padrão.

## Performance
### Dashboard
Recebe só:
- hasValidationIssue
- highestSeverity
- issueCount
- maybe topCodes/topSummary compactos

### Shipment
Pode receber mais detalhe agregado

### Time travel/detail
Pode carregar nível mais detalhado quando necessário

## UI contract
UI deve conseguir:
- mostrar banner agregador no processo
- mostrar chip no container
- eventualmente marcar parte da timeline
- sem interpretar semântica

## Testes
### Unit
- agregação por escopo
- redução de findings em container/process
- serialização DTO -> VM

### Manual
- shipment e dashboard continuam leves
- nenhum payload técnico indevido indo para superfícies compactas

## Critério de pronto
- modelo pronto para plugins complexos
- payload ainda controlado
- semântica ainda 100% backend-derived
- 1 commit atômico

---

# Prompt de implementação — Fase 2

Refine framework de plugins de validação para suportar detectores mais ricos.

Objetivo:
- expandir modelo de findings para escopo, severidade, action hint e evidência controlada
- manter dashboard leve
- preparar shipment/timeline para detectores da V2

Requisitos:
1. Expandir contratos internos de finding/agregação.
2. Introduzir escopos afetados e severidade estável.
3. Separar `evidenceSummary` de `debugEvidence`.
4. Garantir que dashboard continue recebendo payload mínimo.
5. Shipment/detail pode receber mais detalhe agregado, sem exagero.
6. Não permitir que UI derive semântica partir do escopo; renderizar.
7. Atualizar DTOs, VMs e mappers explicitamente.
8. Criar testes unitários.
9. QA manual em dashboard e shipment.
10. Rodar `pnpmcheck` até verde.
11. Exatamente 1 commit.

===

# V2 — Fase 3 — Plugin 1: regressão impossível após marco forte

## Objetivo
Criar plugin que detecta regressões semanticamente impossíveis após marcos fortes do lifecycle.

## Casos-alvo
Exemplos:
- após `DISCHARGED`, aparece `LOAD` incompatível sem contexto reconciliado
- após `DELIVERED`, volta para fluxo de trânsito sem cair no detector genérico de pós-conclusão
- após `EMPTY_RETURNED`, reaparecem estados anteriores incompatíveis como se fosse mesma jornada

## Motivação
Esse detector é mais geral e mais completo do que caso já existente de tracking continuando após conclusão.
Ele captura regressões semânticas fortes na leitura atual.

## Critério semântico
plugin deve marcar issue quando:
- existe marco forte consolidado na timeline derivada
- leitura atual contém passo(s) posteriores incompatíveis com monotonicidade esperada
- e sistema não consegue explicar isso por reconciliação legítima do fluxo

## Dependências semânticas
- timeline derivada canônica
- status derivado
- knowledge mínima de marcos fortes
- sem depender da UI

## Escopo afetado
- STATUS
- TIMELINE
- CONTAINER

## Severidade padrão
- CRITICAL

## Código sugerido
- `IMPOSSIBLE_POST_MILESTONE_REGRESSION`

## Fora de escopo
- truncar tracking
- corrigir automaticamente
- feature manual de corte

## Testes
### Unit
- fluxo monotônico normal não gera finding
- regressão impossível gera finding
- sinais ambíguos porém reconciliáveis não devem disparar se não houver critério objetivo suficiente

### Manual
- casos reais/fixtures com delivered/discharged/empty returned seguidos de regressão

## Critério de pronto
- plugin isolado funcionando
- registry integrado
- dashboard/shipment refletem corretamente
- 1 commit

---

# Prompt de implementação — Fase 3

Implemente plugin de validação `IMPOSSIBLE_POST_MILESTONE_REGRESSION`.

Objetivo:
- detectar regressões semanticamente impossíveis após marcos fortes do lifecycle
- integrar isso ao framework pluginável da V2

Requisitos:
1. detector deve viver como plugin isolado no slice `validation`.
2. Deve usar contratos canônicos internos do tracking.
3. Não pode depender de UI nem capability.
4. Deve marcar severidade `CRITICAL`.
5. Deve cobrir casos como delivered/discharged/empty_returned seguidos de regressão incompatível.
6. Não deve gerar falso positivo em fluxos incompletos ou out-of-order mas ainda reconciliáveis.
7. Criar testes unitários robustos.
8. QA manual com casos reais/fixtures.
9. Rodar `pnpmcheck` até verde.
10. Exatamente 1 commit.

===

# V2 — Fase 4 — Plugin 2: expected ativo incompatível com ACTUAL consolidado

## Objetivo
Criar plugin que detecta quando sistema mantém ou promove expected que já deveria estar semanticamente morto diante de ACTUAL consolidado.

## Casos-alvo
Exemplos:
- ACTUAL de chegada/descarga existe, mas expected de etapa anterior ainda governa ETA
- ACTUAL consolidado já encerrou etapa, mas expected antigo permanece como referência ativa
- expected e actual coexistem de forma semânticamente incompatível para mesma leitura atual

## Motivação
Esse plugin ajuda pegar:
- superseed incompleto
- reconcile ruim de expected plan
- ETA incorreto mesmo quando há fato consolidado suficiente

## Critério semântico
Disparar finding quando:
- há ACTUAL consolidado para etapa que deveria invalidar previsão anterior
- ainda assim existe expected ativo que continua participando da leitura atual de forma incompatível
- conflito não é histórico visível, mas afeta interpretação corrente

## Escopo afetado
- ETA
- SERIES
- TIMELINE

## Severidade sugerida
- ADVISORY quando localizado
- CRITICAL quando estiver afetando leitura principal/ETA ativo do container

## Código sugerido
- `ACTIVE_EXPECTED_INCOMPATIBLE_WITH_ACTUAL`

## Relação com o modelo formal
detector deve respeitar:
- ACTUAL vs EXPECTED
- expected after actual pode ser redundante
- conflitos devem ser expostos e não escondidos
- safe-first rule continua válida

## Testes
### Unit
- expected histórico redundante e inofensivo não gera finding forte
- expected ainda ativo afetando leitura corrente gera finding
- casos com actual supersedendo expected corretamente não devem disparar

### Manual
- casos reais de ETA errado por expected antigo

## Critério de pronto
- plugin funcionando
- sem hack de UI
- sem violar series model
- 1 commit

---

# Prompt de implementação — Fase 4

Implemente plugin `ACTIVE_EXPECTED_INCOMPATIBLE_WITH_ACTUAL`.

Objetivo:
- detectar quando expecteds antigos continuam semanticamente ativos mesmo diante de ACTUAL consolidado
- capturar casos de superseed/reconcile incompleto que afetam leitura atual

Requisitos:
1. Implementar como plugin isolado.
2. Respeitar integralmente event series model.
3. Não reescrever facts, não esconder histórico.
4. Distinguir redundancy histórica inofensiva de incompatibilidade que afeta leitura atual.
5. Usar severidade `ADVISORY` ou `CRITICAL` conforme impacto real.
6. Atualizar agregação DTO/VM/UI se necessário.
7. Criar testes unitários robustos.
8. QA manual com casos reais/fixtures.
9. Rodar `pnpmcheck` até verde.
10. Exatamente 1 commit.

===

# V2 — Fase 5 — Plugin 3: expected plan não reconciliável / fragmentação de séries expected

## Objetivo
Criar plugin que detecta quando sistema não consegue reconciliar de forma segura plano expected atual, seja por mudança brusca não explicável, seja por fragmentação indevida de séries.

## Casos-alvo
Exemplos:
- vessel/voyage/location mudam abruptamente e sistema não consegue produzir transição expected coerente
- séries expected concorrentes para mesmo passo sem explicação segura
- grouping/fingerprint ruim gerando fragmentação de previsões que deveriam ser única série

## Motivação
Esse plugin é central para pegar:
- replan mal reconciliado
- fingerprint ruim
- split indevido de series
- múltiplos expecteds ativos concorrendo pela mesma semântica

## Estratégia
Esta fase pode implementar dois detectores irmãos ou detector composto com subcódigos, desde que continue pluginável e testável.

### Opção A
- `EXPECTED_PLAN_NOT_RECONCILABLE`
- `FRAGMENTED_EXPECTED_SERIES`

### Opção B
- plugin principal com sub-findings distintos

## Escopo afetado
- SERIES
- ETA
- TIMELINE
- PROVIDER_INTERPRETATION

## Severidade
- ADVISORY por padrão
- CRITICAL quando afetar ETA ativo ou leitura principal

## Regras
- não usar heurística vaga
- precisar de critérios objetivos
- não confundir update legítimo de expected com fragmentação problemática

## Testes
### Unit
- atualização expected normal não dispara
- fragmentação indevida dispara
- replan irreconciliável dispara
- múltiplas previsões históricas bem comportadas não disparam por si só

### Manual
- casos reais de changed plan / multiple expected weirdness

## Critério de pronto
- plugin(s) funcionando
- baixo falso positivo
- 1 commit

---

# Prompt de implementação — Fase 5

Implemente detector pluginável para expected plan irreconciliável e/ou fragmentação indevida de séries expected.

Objetivo:
- capturar casos em que leitura expected atual ficou semanticamente insegura por replan mal reconciliado ou por split indevido de séries

Requisitos:
1. Implementar como plugin(s) isolado(s) no framework da V2.
2. Usar critérios objetivos.
3. Distinguir update expected legítimo de estado realmente irreconciliável.
4. Cobrir concorrência indevida entre expecteds ativos.
5. Usar severidade proporcional ao impacto.
6. Não empurrar lógica para UI.
7. Criar testes unitários sólidos.
8. QA manual com fixtures/casos reais.
9. Rodar `pnpmcheck` até verde.
10. Exatamente 1 commit.

===


# V2 — Fase 6 — Plugin 4: mistura provável de dois ciclos logísticos no mesmo container/processo

## Objetivo
Criar detector mais geral e precoce para mistura provável de dois ciclos distintos no mesmo processo/container, sem depender do caso extremo já coberto de pós-conclusão.

## Casos-alvo
Exemplos:
- sinais fortes de duas jornadas coexistindo
- mudança estrutural incompatível de cluster de voyage/vessel/location
- novos marcos pertencentes ciclo distinto surgindo enquanto sistema ainda tenta tratá-los como continuação do ciclo anterior

## Motivação
Esse plugin é versão mais robusta do problema de:
- container reutilizado
- BL implícito divergente
- processo aberto demais e contaminado por novo ciclo

## Critério semântico
Disparar quando:
- leitura atual revela dois clusters operacionais incompatíveis
- não há reconciliação segura como continuação do mesmo ciclo
- sistema passa ter ambiguidade estrutural de boundary do processo/container

## Escopo afetado
- PROCESS
- CONTAINER
- TIMELINE
- PROVIDER_INTERPRETATION

## Severidade
- CRITICAL por padrão

## Código sugerido
- `PROBABLE_MULTI_CYCLE_MIX`

## Fora de escopo
- cortar automaticamente
- reatribuir ciclo
- criar UX de truncamento manual

## Testes
### Unit
- fluxo único consistente não dispara
- mistura provável dispara
- mudança legítima de expected dentro do mesmo ciclo não deve disparar sozinha

### Manual
- casos reais de container reutilizado e tracking contaminado

## Critério de pronto
- detector novo convivendo bem com detector antigo de post-completion
- sem duplicidade semântica excessiva
- 1 commit

---

# Prompt de implementação — Fase 6

Implemente plugin `PROBABLE_MULTI_CYCLE_MIX`.

Objetivo:
- detectar mistura provável de dois ciclos logísticos no mesmo processo/container
- capturar contaminação semântica de tracking antes mesmo do caso mais gritante de pós-conclusão

Requisitos:
1. Implementar como plugin isolado.
2. Usar critérios estruturais objetivos.
3. Não confundir replan legítimo com novo ciclo.
4. Conviver bem com `POST_COMPLETION_TRACKING_CONTINUED` sem duplicidade confusa.
5. Severidade `CRITICAL`.
6. Criar testes unitários robustos.
7. QA manual com casos reais/fixtures.
8. Rodar `pnpmcheck` até verde.
9. Exatamente 1 commit.


===


# V2 — Fase 7 — Plugin 5: bloco operacional impossível / classificação canônica estruturalmente absurda

## Objetivo
Evoluir detector advisory de classificação inconsistente para plugin mais robusto de **bloco operacional impossível**, focado em incoerência estrutural da timeline canônica.

## Casos-alvo
Exemplos:
- post-carriage com evidência canônica clara de perna marítima ativa
- transshipment block sem perna anterior/posterior coerente
- voyage block sem suporte mínimo semântico
- item estrutural “teleportado” para bloco incompatível no read model canônico

## Motivação
advisory anterior capturava incoerência localizada.
Agora ideia é endurecer isso como plugin estrutural, mais próximo da semântica de bloco operacional.

## Regras
- só entra se problema existir no backend/read model canônico
- nunca usar bug visual puro como trigger
- não usar NLP frouxo
- usar sinais canônicos de bloco, milestone, phase e contexto

## Escopo afetado
- TIMELINE_BLOCK
- TIMELINE
- CONTAINER

## Severidade
- ADVISORY por padrão
- CRITICAL se comprometer leitura principal

## Código sugerido
- `IMPOSSIBLE_OPERATIONAL_BLOCK`

## Testes
### Unit
- blocos coerentes não disparam
- bloco estruturalmente impossível dispara
- bug meramente visual não entra

### Manual
- reproduzir casos parecidos com já vistos nos chats
- confirmar que erro já existe antes da UI

## Critério de pronto
- plugin estrutural funcional
- fronteira UI-vs-canônico preservada
- 1 commit

---

# Prompt de implementação — Fase 7

Implemente plugin `IMPOSSIBLE_OPERATIONAL_BLOCK`.

Objetivo:
- detectar incoerências estruturais na timeline canônica em nível de bloco operacional
- endurecer detecção de classificação inconsistente além do advisory inicial

Requisitos:
1. erro deve existir no backend/read model canônico, nunca só na UI.
2. Implementar como plugin isolado.
3. Basear-se em sinais semânticos objetivos do tracking.
4. Distinguir advisory de critical conforme impacto.
5. Não usar heurística textual frouxa.
6. Criar testes unitários.
7. QA manual confirmando que problema já existe antes da UI.
8. Rodar `pnpmcheck` até verde.
9. Exatamente 1 commit.

===


# V2 — Fase 8 — Plugins agregados de observabilidade do parser/provider + polimento final da V2

## Objetivo
Fechar V2 com detectores mais orientados cobertura/provider e com infraestrutura final para ligar findings customer-facing e dev-facing de forma controlada.

## Subobjetivos
### A. Plugin agregado: perda súbita de milestones críticos por provider
Detectar padrões como:
- provider que antes entregava marcos críticos e agora deixa de entregá-los em massa
- forte indício de mudança de payload/parser coverage

### B. Plugin agregado: payload semanticamente empobrecido
Detectar quando:
- parser continua “funcionando”
- mas semântica derivada fica vazia/genérica demais de forma anormal

### C. Plugin agregado: explosão de unknown/unclassified em região crítica
Não como evento isolado, mas como padrão anormal bastante para levantar issue

## Natureza desses plugins
Esses detectores são mais próximos de:
- provider interpretation health
- coverage degradation
- necessidade provável de intervenção de código

Eles podem gerar findings com consumidor:
- DEV_OBSERVABILITY_ONLY
- BOTH

## Escopo
- framework passa suportar findings não necessariamente exibidos com mesmo peso ao usuário
- shipment/dashboard continuam consumindo só que faz sentido
- infraestrutura fica pronta para observabilidade futura, sem implementar Sentry/email/painel agora

## Performance / storage
- não criar logs gigantes
- não persistir raw payload duplicado
- usar summaries leves
- aproveitar lifecycle de findings já existente

## Polimento final da V2
- revisar registry e convenções de plugins
- revisar i18n e mensagens
- revisar payloads
- revisar time travel/realtime/prefetch
- revisar ViewModels e DTOs
- revisar naming dos códigos
- revisar risco de falso positivo
- documentar como adicionar novo plugin no futuro

## Documentação obrigatória
Criar documentação interna do framework:
- como criar novo detector
- onde registrar
- quais contratos usar
- que é proibido
- como decidir entre customer-facing e dev-facing

## Testes
### Unit
- plugins agregados
- classificação de consumidor
- integração com lifecycle atual

### Manual
- validar que dashboard/shipment não ficam poluídos
- validar que payload continua enxuto
- validar que findings dev-facing não vazam indevidamente para UI compacta

## Critério de pronto
- V2 pluginável fechada
- detectores customer-facing e dev-facing coexistindo
- documentação interna pronta
- sem dependência de infraestrutura futura não existente
- 1 commit final

---

# Prompt de implementação — Fase 8

Feche V2 do sistema de plugins de validação.

Objetivo:
- adicionar detectores agregados voltados health de provider/parser
- suportar findings customer-facing e dev-facing
- polir toda arquitetura pluginável
- documentar como futuros plugins devem ser adicionados

Requisitos:
1. Implementar detectores agregados orientados provider coverage degradation, com critérios objetivos e leves.
2. Não depender de Sentry/email/painel que ainda não existem.
3. Diferenciar findings que são:
   - visíveis ao cliente
   - visíveis só para dev/observabilidade futura
   - ambos
4. Garantir que dashboard e shipment continuem leves e não poluídos.
5. Revisar DTOs, VMs, payloads, realtime, prefetch e time travel.
6. Criar documentação interna de extensão do framework pluginável.
7. Criar testes unitários.
8. Fazer QA manual amplo.
9. Rodar `pnpmcheck` até verde.
10. Exatamente 1 commit final desta V2.
