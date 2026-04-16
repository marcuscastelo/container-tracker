# PRD — Adendo V2.1 — Especialização do detector de plano expected inconsistente

## Status
Proposto

## Relacionado a
- Validation Issue V2: Explainability, Evidence & Detector Calibration
- Caso de referência: **CA052-26**

## Objetivo do adendo
Evoluir o detector atualmente genérico:

- `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`

para permitir, em casos apropriados, classificações mais específicas e semanticamente mais úteis para o operador e para evolução futura do sistema.

Este adendo não substitui o detector genérico.
Ele cria uma camada mais refinada para casos onde a inconsistência atual parece nascer especificamente de **plano expected ruim, fragmentado ou semanticamente empobrecido**.

---

# Contexto

Na V1/V2 atual, certos casos estão sendo corretamente capturados pelo detector amplo de inconsistência canônica da timeline.

Isso já é útil e melhor do que não detectar nada.

Porém, alguns casos — especialmente como o **CA052-26** — parecem apontar para uma classe mais específica de problema:

- sequência expected excessivamente fragmentada
- milestones expected importantes não mapeadas ou semanticamente pobres
- múltiplas pernas expected sem reconciliação confiável
- interpretação do provider “funciona”, mas entrega um plano canônico fraco demais

Nesses casos, o detector genérico acerta a direção, mas não comunica a natureza real do problema com precisão suficiente.

---

# Problema

Hoje, diferentes falhas semânticas podem cair no mesmo bucket:

- `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`

Isso gera três limitações:

## 1. Explicação insuficiente
O usuário entende que “a timeline ficou inconsistente”, mas não entende se o problema é:
- classificação estrutural absurda
- conflito factual
- plano expected fragmentado
- interpretação empobrecida do provider

## 2. Dificuldade de evolução
Ao manter tudo no mesmo bucket, fica mais difícil:
- calibrar severity
- comparar frequência por tipo
- priorizar correções
- saber se o problema está em fingerprint, mapping, grouping ou coverage

## 3. Menor valor operacional
Casos de plano expected ruim pedem um tipo de explicação diferente de casos de conflito factual forte.

---

# Objetivo de produto

Adicionar um nível novo de especialização para casos de inconsistência ligados a **expected plan**, permitindo que o sistema diferencie, quando houver evidência suficiente, entre pelo menos estas classes:

1. **Expected plan fragmentado**
2. **Provider interpretation impoverished**
3. **Multi-leg plan not reconcilable**

O detector genérico continua existindo como fallback seguro.

---

# Não objetivos

Este adendo **não** inclui:

- reescrever o modelo canônico de event series
- alterar o safe-first rule
- criar engine genérica de detecção por configuração
- corrigir todos os mappings de provider
- substituir o detector genérico em todos os casos
- observabilidade externa dev-facing
- reclassificação semântica na UI

---

# Hipótese central

Existe uma subclasse de validation issues em que o problema não é “a timeline está inconsistente” em sentido amplo, mas sim:

> o sistema não conseguiu montar um plano expected coerente e confiável a partir dos sinais disponíveis do provider.

Quando isso acontece, a feature deve ser capaz de dizer isso de forma mais precisa.

---

# Casos de referência

## Caso principal
### CA052-26
Padrões observados:
- vários eventos expected/não mapeados em pontos centrais
- múltiplas localizações intermediárias
- transshipment intended/planned
- transições entre blocos com semântica fraca
- timeline canônica aparentemente “montada”, mas com confiança baixa sobre o plano

Esse caso parece mais próximo de:
- expected plan fragmentado
- provider interpretation impoverished
- multi-leg plan not reconcilable

do que apenas:
- canonical timeline classification inconsistent

---

# Proposta de evolução

## Situação atual
O sistema emite algo como:

- `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`

## Situação desejada
O sistema deve poder emitir um detector mais específico quando houver critério objetivo suficiente, por exemplo:

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
Quando houver sinais objetivos, o sistema promove o caso para uma categoria mais precisa.

---

# Detectores/códigos candidatos

## 1. EXPECTED_PLAN_FRAGMENTED

### Intenção
Detectar quando o plano expected parece quebrado em fragmentos semânticos demais, em vez de formar uma sequência coerente de pernas.

### Sinais candidatos
- múltiplos passos expected que deveriam compor uma mesma continuidade, mas aparecem como blocos quebrados sem reconciliação clara
- legs intermediárias fracas/incompletas demais
- muitos eventos expected sem suporte suficiente para consolidar uma perna operacional clara
- sequência expected excessivamente “picotada” para o mesmo ciclo logístico

### Exemplos
- ETA, intended transshipment, planned transshipment e chegada esperada aparecendo como peças soltas
- blocos intermediários pouco sustentados semanticamente

### Severity sugerida
- `ADVISORY` por padrão
- `CRITICAL` se isso afetar leitura principal/ETA atual

---

## 2. PROVIDER_INTERPRETATION_IMPOVERISHED

### Intenção
Detectar quando o provider continua sendo ingerido tecnicamente, mas a interpretação canônica resultante está semanticamente pobre demais.

### Sinais candidatos
- alta densidade de milestones centrais “não mapeados”
- eventos fundamentais chegam, mas sem semântica suficiente para montar plano robusto
- leitura atual depende demais de placeholders genéricos
- cobertura do parser parece insuficiente para o payload atual do provider

### Diferença para unknown isolado
Esse detector **não** deve disparar por um único evento não mapeado.
Ele só entra quando houver **empobrecimento semântico relevante do plano**.

### Exemplos
- intended transshipment, ETA, departure expected e arrival expected centrais vindo todos como “não mapeado” ou sem valor semântico suficiente

### Severity sugerida
- `ADVISORY` por padrão
- `CRITICAL` se empobrecimento comprometer o entendimento atual do fluxo

---

## 3. MULTI_LEG_PLAN_NOT_RECONCILABLE

### Intenção
Detectar quando há sinais suficientes de um plano com múltiplas pernas, mas o sistema não consegue reconciliar essas pernas numa sequência expected confiável.

### Sinais candidatos
- múltiplas localizações intermediárias expected
- transbordos intended/planned
- legs parciais que sugerem multi-leg route
- ausência de coerência suficiente entre origem, intermediários e destino esperado
- mudanças ou transições que não conseguem ser encaixadas como uma cadeia expected estável

### Exemplos
- Karachi → Colombo → Singapore → Santos, com intended/planned/arrival events insuficientemente reconciliados
- pernas intermediárias que não se encaixam claramente em blocos canônicos consistentes

### Severity sugerida
- `ADVISORY` por padrão
- `CRITICAL` se o sistema usar esse plano para orientar leitura principal atual

---

# Regras de priorização entre os detectores

## Ordem sugerida
Quando múltiplos sinais coexistirem, o sistema deve escolher o motivo mais útil e mais correto.

Prioridade sugerida:

1. `MULTI_LEG_PLAN_NOT_RECONCILABLE`
2. `EXPECTED_PLAN_FRAGMENTED`
3. `PROVIDER_INTERPRETATION_IMPOVERISHED`
4. `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`

## Justificativa
- `MULTI_LEG_PLAN_NOT_RECONCILABLE` é o mais estrutural e mais próximo da leitura operacional
- `EXPECTED_PLAN_FRAGMENTED` é forte, mas ainda mais sintoma estrutural
- `PROVIDER_INTERPRETATION_IMPOVERISHED` é mais diagnóstico de cobertura/qualidade da interpretação
- o genérico continua sendo fallback

---

# Critérios de ativação

## Regra de segurança
O sistema só deve especializar quando houver **evidência objetiva suficiente**.

Se não houver, deve permanecer no detector genérico.

## Regras mínimas
- nenhum detector novo pode depender de UI
- nenhum detector novo pode usar texto livre ou heurística frouxa
- nenhum detector novo pode ser disparado só por “evento não mapeado”
- a especialização precisa ser determinística dado o mesmo conjunto de observations/read model

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
- “O plano previsto atual ficou fragmentado demais para formar uma rota confiável.”

### PROVIDER_INTERPRETATION_IMPOVERISHED
- “Os dados previstos deste rastreamento vieram com semântica insuficiente para montar uma leitura confiável.”

### MULTI_LEG_PLAN_NOT_RECONCILABLE
- “O sistema detectou múltiplas pernas previstas, mas não conseguiu reconciliá-las numa rota consistente.”

---

# UX esperada

## Shipment page
A seção “Motivos da validação” deve conseguir mostrar o novo motivo específico.

## Área afetada
Sempre que possível:
- `Timeline`
- `Timeline > Bloco X`
- `Timeline > Plano expected`
- `Timeline > Pernas intermediárias`

## Review hint
Exemplos:
- “Revise os trechos intermediários previstos e os transbordos planejados.”
- “Revise os milestones expected não mapeados do plano.”
- “Revise a cadeia expected entre intermediários e destino final.”

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
Suportar os novos `reasonCode` sem quebrar UI atual.

## UI
Consumir os novos reasons sem rederivar semântica.

---

# Requisitos não funcionais

## Determinismo
Dado o mesmo conjunto de facts/read model, a especialização deve ser reprodutível.

## Baixo falso positivo
Não pode transformar qualquer timeline “feia” em fragmentação.

## Performance
Não aumentar payload do dashboard.
Shipment pode receber reason específico sem debug pesado.

## Boundary safety
Toda a especialização nasce no Tracking BC.

---

# Riscos

## 1. Over-specialization precoce
Criar detectores novos sem critério objetivo suficiente.

### Mitigação
Fallback sempre disponível para o detector genérico.

## 2. Nomes tecnicamente bons, mas ruins de produto
O nome interno pode não ser o melhor texto final para o usuário.

### Mitigação
Separar `reasonCode` de `userSummary`.

## 3. Confusão entre problema estrutural e problema de coverage do provider
Um mesmo caso pode parecer ambos.

### Mitigação
Definir hierarquia clara de prioridade.

---

# Métricas de sucesso

## Qualitativas
Em casos tipo CA052, a explicação deve parecer:
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
Introduzir os novos `reasonCode` com fallback intacto.

## Etapa 2
Implementar especialização mínima para o caso CA052-like.

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
- se a mensagem final ficou melhor que a genérica
- se a timeline continua íntegra
- se a UI só consome e exibe

---

# Conclusão

Este adendo V2.1 propõe refinar a feature de Validation Issue para casos em que a inconsistência canônica atual é, na verdade, mais especificamente um problema de:

- plano expected fragmentado
- interpretação empobrecida do provider
- plano multi-leg não reconciliável

O detector genérico continua existindo.
A novidade é permitir que o sistema, quando tiver confiança suficiente, diga **com mais precisão que tipo de problema expected-plan aconteceu**.

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
Porque alguns casos, como o CA052, parecem mais um problema de plano expected ruim do que apenas uma inconsistência canônica genérica.

## Como
Com especialização backend-derived no Tracking BC, usando critérios objetivos e mantendo fallback para o detector genérico.

## Benefício
Mais precisão, mais explicabilidade e melhor base para evolução futura.