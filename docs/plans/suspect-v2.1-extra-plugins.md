# PRD — Adendo V2.1 — Especialização do detector de plano expected inconsistente

## Status
Proposto

## Relacionado a
- Validation Issue V2: Explainability, Evidence & Detector Calibration
- Caso de referência: **CA052-26**

## Objetivo do adendo
Evoluir detector atualmente genérico:

- `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`

para permitir, em casos apropriados, classificações mais específicas e semanticamente mais úteis para operador e para evolução futura do sistema.

Este adendo não substitui detector genérico.
Ele cria camada mais refinada para casos onde inconsistência atual parece nascer especificamente de **plano expected ruim, fragmentado ou semanticamente empobrecido**.

---

# Contexto

Na V1/V2 atual, certos casos estão sendo corretamente capturados pelo detector amplo de inconsistência canônica da timeline.

Isso já é útil e melhor do que não detectar nada.

Porém, alguns casos — especialmente como **CA052-26** — parecem apontar para classe mais específica de problema:

- sequência expected excessivamente fragmentada
- milestones expected importantes não mapeadas ou semanticamente pobres
- múltiplas pernas expected sem reconciliação confiável
- interpretação do provider “funciona”, mas entrega plano canônico fraco demais

Nesses casos, detector genérico acerta direção, mas não comunica natureza real do problema com precisão suficiente.

---

# Problema

Hoje, diferentes falhas semânticas podem cair no mesmo bucket:

- `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`

Isso gera três limitações:

## 1. Explicação insuficiente
usuário entende que “ timeline ficou inconsistente”, mas não entende se problema é:
- classificação estrutural absurda
- conflito factual
- plano expected fragmentado
- interpretação empobrecida do provider

## 2. Dificuldade de evolução
Ao manter tudo no mesmo bucket, fica mais difícil:
- calibrar severity
- comparar frequência por tipo
- priorizar correções
- saber se problema está em fingerprint, mapping, grouping ou coverage

## 3. Menor valor operacional
Casos de plano expected ruim pedem tipo de explicação diferente de casos de conflito factual forte.

---

# Objetivo de produto

Adicionar nível novo de especialização para casos de inconsistência ligados **expected plan**, permitindo que sistema diferencie, quando houver evidência suficiente, entre pelo menos estas classes:

1. **Expected plan fragmentado**
2. **Provider interpretation impoverished**
3. **Multi-leg plan not reconcilable**

detector genérico continua existindo como fallback seguro.

---

# Não objetivos

Este adendo **não** inclui:

- reescrever modelo canônico de event series
- alterar safe-first rule
- criar engine genérica de detecção por configuração
- corrigir todos mappings de provider
- substituir detector genérico em todos casos
- observabilidade externa dev-facing
- reclassificação semântica na UI

---

# Hipótese central

Existe subclasse de validation issues em que problema não é “ timeline está inconsistente” em sentido amplo, mas sim:

> sistema não conseguiu montar plano expected coerente e confiável partir dos sinais disponíveis do provider.

Quando isso acontece, feature deve ser capaz de dizer isso de forma mais precisa.

---

# Casos de referência

## Caso principal
### CA052-26
Padrões observados:
- vários eventos expected/não mapeados em pontos centrais
- múltiplas localizações intermediárias
- transshipment intended/planned
- transições entre blocos com semântica fraca
- timeline canônica aparentemente “montada”, mas com confiança baixa sobre plano

Esse caso parece mais próximo de:
- expected plan fragmentado
- provider interpretation impoverished
- multi-leg plan not reconcilable

do que:
- canonical timeline classification inconsistent

---

# Proposta de evolução

## Situação atual
sistema emite algo como:

- `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`

## Situação desejada
sistema deve poder emitir detector mais específico quando houver critério objetivo suficiente, por exemplo:

- `EXPECTED_PLAN_FRAGMENTED`
- `PROVIDER_INTERPRETATION_IMPOVERISHED`
- `MULTI_LEG_PLAN_NOT_RECONCILABLE`

Com fallback para:
- `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`

---

# Novo modelo conceitual

## Camada 1 — Detector genérico
Continua existindo como fallback universal:
- pega inconsistência canônica ampla
- usado quando não há evidência suficiente para especializar

## Camada 2 — Especialização de expected-plan issues
Quando houver sinais objetivos, sistema promove caso para categoria mais precisa.

---

# Detectores/códigos candidatos

## 1. EXPECTED_PLAN_FRAGMENTED

### Intenção
Detectar quando plano expected parece quebrado em fragmentos semânticos demais, em vez de formar sequência coerente de pernas.

### Sinais candidatos
- múltiplos passos expected que deveriam compor mesma continuidade, mas aparecem como blocos quebrados sem reconciliação clara
- legs intermediárias fracas/incompletas demais
- muitos eventos expected sem suporte suficiente para consolidar perna operacional clara
- sequência expected excessivamente “picotada” para mesmo ciclo logístico

### Exemplos
- ETA, intended transshipment, planned transshipment e chegada esperada aparecendo como peças soltas
- blocos intermediários pouco sustentados semanticamente

### Severity sugerida
- `ADVISORY` por padrão
- `CRITICAL` se isso afetar leitura principal/ETA atual

---

## 2. PROVIDER_INTERPRETATION_IMPOVERISHED

### Intenção
Detectar quando provider continua sendo ingerido tecnicamente, mas interpretação canônica resultante está semanticamente pobre demais.

### Sinais candidatos
- alta densidade de milestones centrais “não mapeados”
- eventos fundamentais chegam, mas sem semântica suficiente para montar plano robusto
- leitura atual depende demais de placeholders genéricos
- cobertura do parser parece insuficiente para payload atual do provider

### Diferença para unknown isolado
Esse detector **não** deve disparar por único evento não mapeado.
Ele só entra quando houver **empobrecimento semântico relevante do plano**.

### Exemplos
- intended transshipment, ETA, departure expected e arrival expected centrais vindo todos como “não mapeado” ou sem valor semântico suficiente

### Severity sugerida
- `ADVISORY` por padrão
- `CRITICAL` se empobrecimento comprometer entendimento atual do fluxo

---

## 3. MULTI_LEG_PLAN_NOT_RECONCILABLE

### Intenção
Detectar quando há sinais suficientes de plano com múltiplas pernas, mas sistema não consegue reconciliar essas pernas numa sequência expected confiável.

### Sinais candidatos
- múltiplas localizações intermediárias expected
- transbordos intended/planned
- legs parciais que sugerem multi-leg route
- ausência de coerência suficiente entre origem, intermediários e destino esperado
- mudanças ou transições que não conseguem ser encaixadas como cadeia expected estável

### Exemplos
- Karachi → Colombo → Singapore → Santos, com intended/planned/arrival events insuficientemente reconciliados
- pernas intermediárias que não se encaixam claramente em blocos canônicos consistentes

### Severity sugerida
- `ADVISORY` por padrão
- `CRITICAL` se sistema usar esse plano para orientar leitura principal atual

---

# Regras de priorização entre os detectores

## Ordem sugerida
Quando múltiplos sinais coexistirem, sistema deve escolher motivo mais útil e mais correto.

Prioridade sugerida:

1. `MULTI_LEG_PLAN_NOT_RECONCILABLE`
2. `EXPECTED_PLAN_FRAGMENTED`
3. `PROVIDER_INTERPRETATION_IMPOVERISHED`
4. `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`

## Justificativa
- `MULTI_LEG_PLAN_NOT_RECONCILABLE` é mais estrutural e mais próximo da leitura operacional
- `EXPECTED_PLAN_FRAGMENTED` é forte, mas ainda mais sintoma estrutural
- `PROVIDER_INTERPRETATION_IMPOVERISHED` é mais diagnóstico de cobertura/qualidade da interpretação
- genérico continua sendo fallback

---

# Critérios de ativação

## Regra de segurança
sistema só deve especializar quando houver **evidência objetiva suficiente**.

Se não houver, deve permanecer no detector genérico.

## Regras mínimas
- nenhum detector novo pode depender de UI
- nenhum detector novo pode usar texto livre ou heurística frouxa
- nenhum detector novo pode ser disparado só por “evento não mapeado”
- especialização precisa ser determinística dado mesmo conjunto de observations/read model

---

# Contrato de saída

Cada issue especializada deve continuar suportando:

- `reasonCode`
- `severity`
- `scope`
- `userSummary`
- `reviewHint`
- `evidenceRefs[]`

## Exemplos de summaries

### EXPECTED_PLAN_FRAGMENTED
- “ plano previsto atual ficou fragmentado demais para formar rota confiável.”

### PROVIDER_INTERPRETATION_IMPOVERISHED
- “ dados previstos deste rastreamento vieram com semântica insuficiente para montar leitura confiável.”

### MULTI_LEG_PLAN_NOT_RECONCILABLE
- “ sistema detectou múltiplas pernas previstas, mas não conseguiu reconciliá-las numa rota consistente.”

---

# UX esperada

## Shipment page
seção “Motivos da validação” deve conseguir mostrar novo motivo específico.

## Área afetada
Sempre que possível:
- `Timeline`
- `Timeline > Bloco X`
- `Timeline > Plano expected`
- `Timeline > Pernas intermediárias`

## Review hint
Exemplos:
- “Revise trechos intermediários previstos e transbordos planejados.”
- “Revise milestones expected não mapeados do plano.”
- “Revise cadeia expected entre intermediários e destino final.”

---

# Escopo técnico

## Tracking BC
Adicionar lógica especializada no pipeline de validation issues para expected-plan cases.

## Projeções / read models
Garantir que existam sinais suficientes para:
- legs intermediárias
- density de milestones expected
- intended/planned transshipment
- sequência de localizações expected relevantes
- sinais de empobrecimento semântico

## DTO / VM
Suportar novos `reasonCode` sem quebrar UI atual.

## UI
Consumir novos reasons sem rederivar semântica.

---

# Requisitos não funcionais

## Determinismo
Dado mesmo conjunto de facts/read model, especialização deve ser reprodutível.

## Baixo falso positivo
Não pode transformar qualquer timeline “feia” em fragmentação.

## Performance
Não aumentar payload do dashboard.
Shipment pode receber reason específico sem debug pesado.

## Boundary safety
Toda especialização nasce no Tracking BC.

---

# Riscos

## 1. Over-specialization precoce
Criar detectores novos sem critério objetivo suficiente.

### Mitigação
Fallback sempre disponível para detector genérico.

## 2. Nomes tecnicamente bons, mas ruins de produto
nome interno pode não ser melhor texto final para usuário.

### Mitigação
Separar `reasonCode` de `userSummary`.

## 3. Confusão entre problema estrutural e problema de coverage do provider
mesmo caso pode parecer ambos.

### Mitigação
Definir hierarquia clara de prioridade.

---

# Métricas de sucesso

## Qualitativas
Em casos tipo CA052, explicação deve parecer:
- mais precisa
- mais útil
- mais próxima do problema real

## Técnicas
- redução de casos expected-plan jogados no bucket genérico
- baixo ruído
- reason mais estável e justificável

---

# Rollout sugerido

## Etapa 1
Introduzir novos `reasonCode` com fallback intacto.

## Etapa 2
Implementar especialização mínima para caso CA052-like.

## Etapa 3
Calibrar thresholds com casos reais e revisar wording.

---

# QA recomendado

## Casos alvo
- CA052-26
- outros casos expected-heavy com transbordos intermediários
- casos que devem continuar no bucket genérico

## Validar
- se especializou quando devia
- se não especializou sem evidência suficiente
- se mensagem final ficou melhor que genérica
- se timeline continua íntegra
- se UI só consome e exibe

---

# Conclusão

Este adendo V2.1 propõe refinar feature de Validation Issue para casos em que inconsistência canônica atual é,, mais especificamente problema de:

- plano expected fragmentado
- interpretação empobrecida do provider
- plano multi-leg não reconciliável

detector genérico continua existindo.
novidade é permitir que sistema, quando tiver confiança suficiente, diga **com mais precisão que tipo de problema expected-plan aconteceu**.

---

# TL;DR

## O que muda
Casos hoje cobertos por:
- `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`

poderão ser refinados para:
- `EXPECTED_PLAN_FRAGMENTED`
- `PROVIDER_INTERPRETATION_IMPOVERISHED`
- `MULTI_LEG_PLAN_NOT_RECONCILABLE`

## Por quê
Porque alguns casos, como CA052, parecem mais problema de plano expected ruim do que inconsistência canônica genérica.

## Como
Com especialização backend-derived no Tracking BC, usando critérios objetivos e mantendo fallback para detector genérico.

## Benefício
Mais precisão, mais explicabilidade e melhor base para evolução futura.