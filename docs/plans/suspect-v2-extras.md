# PRD — Validation Issue V2: Explainability, Evidence & Detector Calibration

## Status
Proposto

## Owner
Tracking / Process UI

## Contexto

V1 da feature de **Validation Issue / Validação necessária** já demonstrou valor real em casos concretos de produção.

Casos já validados manualmente:
- **CA083-25**: tracking continuando após marco forte de conclusão
- **CA064-25**: conflito real na mesma série + inconsistência canônica de timeline
- **CA052-26**: classificação canônica inconsistente com plano expected semanticamente pobre / não mapeado

V1 provou três coisas importantes:

1. sistema consegue detectar casos em que leitura atual do tracking não é confiável suficiente.
2. UI consegue expor isso sem esconder timeline.
3. operador consegue navegar no funil:
   - processo
   - container
   - motivo
   - evidência na timeline

V2 desta evolução não é sobre criar detectores inteiramente novos primeiro.
Ela é sobre **melhorar qualidade do produto em torno da feature já existente**, tornando-:

- mais explicável
- mais calibrada
- mais auditável
- mais operacional
- mais preparada para crescimento futuro

---

# Problema

V1 já marca corretamente casos relevantes, mas ainda existe espaço para evolução em cinco frentes:

1. **Explicabilidade**
   - usuário vê motivo, mas nem sempre enxerga com máxima clareza qual evidência concreta sustentou detecção.
   - Alguns casos já têm modal/evidência suficiente; outros ainda dependem demais da leitura manual da timeline.

2. **Calibração dos motivos**
   - Em alguns casos, detector pode acertar problema geral, mas ainda usar motivo muito específico ou pouco preciso.
   - Precisamos reduzir risco de “motivo tecnicamente impreciso, ainda que direção geral correta”.

3. **Agrupamento e herança**
   - Hoje processo pode herdar validação por container.
   - Precisamos deixar mais explícita diferença entre:
     - problema local do container
     - problema estrutural compartilhado por múltiplos containers do processo

4. **Qualidade de UX operacional**
   - feature já funciona, mas ainda pode melhorar em microcopy, densidade, ordem visual e capacidade de apontar “onde revisar”.

5. **Preparação para V2 pluginável maior**
   - Precisamos consolidar contratos de reason/evidence/severity/aggregation para suportar detectores futuros sem retrabalho.

---

# Objetivo

Evoluir feature de Validation Issue para V2 mais robusta em **explicação, evidência, calibração e agregação**, preservando:

- tracking como dono da verdade derivada
- timeline-first
- visibilidade de conflito/incerteza
- UI sem rederivação semântica
- payload controlado
- determinismo

---

# Não objetivos

Esta V2 **não** inclui:

- Sentry / email / observabilidade externa para dev
- sistema novo de notificações técnicas
- plugin remoto/dinâmico por config em runtime
- refatoração completa de todos detectores futuros avançados
- corte manual de timeline por data/sync
- reatribuição automática de tracking entre processos
- mudança do modelo canônico de snapshots/observations
- engine genérica de regras fora do Tracking BC

---

# Hipóteses

1. Usuários confiam mais na feature quando sistema mostra não rótulo de validação, mas também evidência navegável.
2. redução de motivos excessivamente genéricos ou excessivamente específicos melhora credibilidade da feature.
3. Separar melhor **issue local** de **issue estrutural compartilhada** reduz ruído e melhora triagem.
4. V2 de explicabilidade bem feita reduz custo futuro de debugging e expansão da feature.

---

# Princípios de produto e arquitetura

1. **Tracking continua dono da interpretação canônica**
2. **UI não rederiva semântica**
3. **Conflitos continuam visíveis**
4. **Fatos não são apagados**
5. ** timeline continua sendo artefato principal**
6. ** feature deve aumentar confiança operacional, não esconder incerteza**
7. **Cada fronteira muda tipo**
8. ** explicação deve apontar para evidência concreta sempre que possível**

---

# Escopo funcional

## 1. Melhorar a explicabilidade dos motivos

### Objetivo
Todo motivo exibido ao usuário deve ficar mais próximo de responder:

- que está inconsistente
- por que isso importa
- onde revisar

### Requisitos
Cada validation issue deve poder fornecer:

- `reasonCode`
- `severity`
- `scope`
- `userSummary`
- `reviewHint`
- `evidenceRefs[]`

### Exemplo esperado
Em vez de:

- “ classificação canônica da timeline ficou inconsistente com eventos atuais.”

V2 deve permitir algo como:

- “ timeline atual entrou em bloco operacional incompatível com eventos detectados.”
- “Revise bloco Pós-transporte / Entrega em Colombo.”

### Resultado esperado
usuário entende não só que existe problema, mas ** recorte operacional concreto do problema**.

---

## 2. Introduzir evidência navegável por motivo

### Objetivo
Cada motivo precisa poder apontar para evidência concreta no shipment view.

### Requisitos
Cada reason pode referenciar ou mais evidências, como:

- série
- bloco de timeline
- item específico
- milestone crítica ausente
- conjunto de eventos conflitantes

### Formato conceitual
`evidenceRefs[]` pode apontar para IDs canônicos de read model, nunca para interpretação UI-side.

Exemplos:
- `timelineBlockId`
- `timelineItemId`
- `seriesId`
- `statusContextId`

### UX esperada
UI pode usar isso para:
- destacar bloco relevante
- rolar até ponto relevante
- abrir modal de histórico da série
- mostrar “área afetada”

### Exemplo já validado
No CA064, modal de histórico da série mostrou claramente múltiplos eventos ACTUAL conflitantes. Esse tipo de capacidade deve virar padrão da feature quando aplicável.

---

## 3. Calibrar melhor os reasons

### Objetivo
Evitar que detector use reasons fortes demais ou imprecisos demais.

### Requisitos
Criar camada explícita de calibração de reasons, com distinção entre:

#### Reason primário
motivo mais confiável e semanticamente central.

#### Reason secundário
Razões complementares, úteis para contexto, mas não necessariamente primeira explicação do caso.

### Exemplos
#### Bom
- primário: conflito factual na mesma série
- secundário: timeline ficou inconsistente

#### Evitar
- motivo técnico hiper-específico quando evidência não sustenta com segurança
- motivo genérico demais quando evidência concreta está disponível

### Regra
sistema deve preferir **motivo mais explicável e tecnicamente correto**.

---

## 4. Separar issue estrutural compartilhada de issue local do container

### Objetivo
Melhorar leitura de processos com múltiplos containers.

### Problema atual
processo pode aparecer com 4 containers validados, mas nem sempre fica claro se:
- 4 têm problemas independentes
- ou 4 herdaram mesma inconsistência estrutural

### Requisitos
Introduzir, internamente, dois níveis de origem:

- `LOCAL_CONTAINER_ISSUE`
- `SHARED_PROCESS_STRUCTURE_ISSUE`

### UX esperada
Na shipment page, banner de processo pode dizer algo como:

- “Este processo contém containers que requerem validação.”
- “Motivo estrutural compartilhado entre 4 containers.”

Ou, se não compartilhado:
- “4 containers possuem validações independentes.”

### Benefício
Reduz ruído e melhora capacidade de triagem.

---

## 5. Melhorar a seção “Motivos da validação”

### Objetivo
Transformar essa seção em componente mais operacional e mais autoexplicativo.

### Requisitos
Cada motivo deve exibir:

- severidade
- resumo curto
- área afetada
- localização, quando aplicável
- affordance clara de navegação para evidência

### Exemplo de estrutura visual
- badge de severidade
- resumo
- linha secundária: “Área: Timeline > Bloco Pós-transporte / Entrega”
- ação:
  - “Ir para evidência”
  - “Ver histórico da série”
  - “Ir para bloco afetado”

### Regra
Sem cards gigantes e sem poluição visual.
seção continua densa e operacional.

---

## 6. Melhorar a microcopy da feature

### Objetivo
Reduzir atrito de entendimento.

### Escopo
Revisar:
- banner do processo
- chip do container
- subtítulo da seção de motivos
- textos explicativos
- CTAs de navegação
- mensagens de empty state

### Exemplos de melhoria
Trocar textos estranhos ou pouco naturais por variantes mais claras, por exemplo:
- “Veja abaixo por que este container requer validação.”
- “Revise pontos destacados na timeline.”
- “ série abaixo contém eventos reais conflitantes.”

### Regra
Linguagem operacional, curta, clara e auditável.

---

## 7. Tornar a feature mais compatível com time travel

### Objetivo
Quando usuário navega por syncs/histórico, explicação deve continuar coerente com aquele ponto do tempo.

### Requisitos
- estado de validation issue mostrado no time travel deve ser consistente com snapshot derivado daquele sync
- `evidenceRefs[]` precisam continuar válidos no contexto histórico
- UI não pode usar reason/evidence do estado atual quando usuário estiver vendo sync passado

### Benefício
Evita confusão entre:
- problema atual
- problema histórico
- problema já resolvido

---

## 8. Melhorar contrato backend → DTO → VM para evidence e reason grouping

### Objetivo
Formalizar melhor travessia da feature entre camadas.

### Requisitos
Criar ou consolidar tipos explícitos para:

- `TrackingValidationIssueProjection`
- `TrackingValidationReasonResponse`
- `TrackingValidationReasonVM`
- `TrackingValidationEvidenceRefResponse`
- `TrackingValidationEvidenceRefVM`

### Regras
- Entity/Aggregate continuam backend-only
- Response DTO é fronteira HTTP
- UI usa VM
- nada de DTO vazando como contrato interno de aplicação
- nada de UI lendo objetos de domínio diretamente

---

## 9. Preparar compatibilidade com detectores V2 mais avançados

### Objetivo
Sem implementar todos agora, deixar V2 pronta para suportar evolução.

### Requisitos
contratos novos devem suportar:
- múltiplos reasons por issue
- reason ranking
- evidência múltipla
- escopo múltiplo
- issues customer-facing
- possível uso dev-facing futuro

---

# Escopo técnico detalhado

## Backend / Tracking
- refinar modelo de validation issue
- adicionar support para `evidenceRefs`
- adicionar agrupamento de reasons
- definir reason primário/secundário
- definir origem `LOCAL_CONTAINER_ISSUE` vs `SHARED_PROCESS_STRUCTURE_ISSUE`
- adaptar projeções do shipment/process detail

## Interface HTTP
- atualizar response DTOs
- manter dashboard leve
- shipment pode receber detalhe mais rico

## UI
- atualizar mappers DTO → VM
- ajustar shipment screen
- melhorar seção de motivos
- adicionar affordances de navegação para evidência
- ajustar microcopy
- suportar time travel de forma coerente

## Dashboard
- manter agregados mínimos
- melhorar suficiente para refletir melhor origem compartilhada/local, se couber sem poluir

---

# Requisitos não funcionais

## 1. Determinismo
Dado mesmo conjunto de observations, mesmos reasons/evidence devem ser produzidos.

## 2. Auditabilidade
Nenhuma evidência pode depender de lógica semântica inventada na UI.

## 3. Performance
- dashboard continua leve
- shipment detail recebe só necessário
- sem payload técnico pesado
- `debugEvidence` não deve vazar para superfícies compactas

## 4. Boundary safety
- sem mover lógica para capability/UI
- sem shared kernel implícito
- sem misturar DTO com contratos internos

## 5. UX operacional
timeline continua sendo artefato principal.
feature deve apoiar leitura, não competir com ela.

---

# Regras de produto

## Rule 1
Validation issue nunca substitui status canônico.

## Rule 2
Validation issue nunca apaga ou reescreve fatos.

## Rule 3
Validation issue pode agregar múltiplos reasons, mas deve ter reason primário.

## Rule 4
Todo reason user-facing deve, quando possível, apontar para evidência navegável.

## Rule 5
processo pode herdar issue estrutural compartilhada; container pode ter issue local independente.

## Rule 6
UI nunca decide se algo é validation issue; só renderiza que veio do backend.

---

# Casos de referência desta V2

## CA083-25
### O que a V2 deve melhorar
- explicar ainda melhor vínculo entre marco forte de conclusão e tracking posterior
- apontar visualmente região do corte quebrado

## CA064-25
### O que a V2 deve melhorar
- reason ranking entre conflito de série e inconsistência estrutural
- navegação direta para série conflitante
- ligação mais forte entre modal de histórico e motivo principal

## CA052-26
### O que a V2 deve melhorar
- evidenciar melhor que problema é de classificação/plano expected ruim
- apontar bloco/trecho inconsistente com precisão
- separar problema estrutural compartilhado dos 4 containers

---

# Métricas de sucesso

## Produto
- aumento da confiança manual do operador/dev na feature
- menos casos em que badge parece “mágico”
- menor necessidade de inspeção cega da timeline inteira

## Técnica
- reasons mais precisos
- menos falsos positivos de explicação
- evidenceRefs válidos e navegáveis
- nenhum aumento relevante de payload no dashboard

## Qualitativa
Em review manual, usuário deve conseguir responder:
1. por que container foi validado?
2. onde está evidência?
3. isso é problema só deste container ou do processo inteiro?
4. explicação bate com timeline?

---

# Rollout sugerido

## Fase 1
- reason primário/secundário
- evidenceRefs backend
- DTO/VM novos
- microcopy revisada

## Fase 2
- UX de navegação para evidência
- diferenciação shared vs local
- refinamento shipment UI

## Fase 3
- compatibilidade completa com time travel
- polimento de payload/performance
- QA amplo com casos reais

---

# QA e validação

## Unit
- ranking de reasons
- agrupamento shared vs local
- mapping DTO → VM
- evidenceRefs serialization
- compatibilidade com time travel projection

## Manual
Usar, no mínimo:
- CA083-25
- CA064-25
- CA052-26

### Validar
- banner de processo
- chip de container
- seção motivos
- navegação para evidência
- timeline preservada
- time travel
- responsividade básica
- ausência de regressão visual forte

---

# Riscos

## 1. Over-modeling
Criar contrato complexo demais cedo demais.

### Mitigação
Manter evidence/ref e ranking simples na V2.

## 2. Payload inflation
Mandar detalhe demais.

### Mitigação
Dashboard mínimo, shipment detalhado, debugEvidence fora da UI compacta.

## 3. UI becoming semantic
Pressão para UI “inferir” evidência.

### Mitigação
Tudo vem do Tracking BC.

## 4. Reason wording drift
Motivos tecnicamente corretos, mas pouco claros.

### Mitigação
Iterar microcopy com casos reais.

---

# Dependências

- pipeline atual de validation issue já funcionando
- shipment read model existente
- modal/histórico de série já existente onde aplicável
- time travel atual

---

# Conclusão

V2 desta evolução deve transformar feature de Validation Issue de:
- **detecção correta, porém ainda parcialmente opaca**

para:
- **detecção correta, explicável, navegável e calibrada**

foco não é só detectar.
É fazer sistema explicar **com confiança e com evidência** por que leitura atual do tracking requer validação.

---

# TL;DR

## O que é
V2 da feature de Validation Issue focada em:
- explicabilidade
- evidência navegável
- calibração dos motivos
- separação entre issue local e issue estrutural compartilhada

## O que entra
- reason primário/secundário
- evidence refs
- melhor UX de motivos
- melhor microcopy
- compatibilidade melhor com time travel
- contratos DTO/VM mais ricos

## O que não entra
- Sentry/email/painel dev
- plugin remoto
- corte manual de tracking
- engine genérica fora do Tracking BC

## Casos de referência
- CA083-25
- CA064-25
- CA052-26

## Resultado esperado
feature que não só detecta bem, mas também **explica bem**.