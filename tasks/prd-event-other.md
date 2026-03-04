# PRD — Unknown Carrier Event Handling & Enterprise Passthrough

## 1. Contexto

Carrier (Maersk) retornou evento não mapeado explicitamente no normalizador.

Atualmente:

* Evento é classificado como tipo genérico.
* UI exibe "Outro".
* Percepção gerada: perda de semântica e baixa confiabilidade.

Problema é estritamente visual e de confiança.

Não é objetivo:

* Alterar enums canônicos
* Alterar pipeline Snapshot → Observation → Derivação
* Alterar algoritmo de status
* Alterar série

---

# 2. Objetivos

1. Permitir passthrough seguro do label original do carrier.
2. Eliminar exibição da palavra "Outro".
3. Opcionalmente mapear o evento para EMPTY_RETURN se semanticamente inequívoco.
4. Manter invariantes de Tracking intactos.
5. Melhorar percepção enterprise da UI.

---

# 3. Análise de Domínio

Evento observado:
"Devolução de contêiner vazio"

No domínio canônico já existe:

* EMPTY_RETURN (evento)
* EMPTY_RETURNED (status derivado)

Portanto:

Se o evento for semanticamente inequívoco → pode ser mapeado para EMPTY_RETURN.

Se houver qualquer ambiguidade → permanece como evento desconhecido.

Tracking NÃO gera labels.
UI é responsável pela apresentação.

---

# 4. Escopo

## Parte A — Mapping Semântico (Opcional e Seguro)

### Condição

Se payload do carrier indicar claramente:

* empty return
* container returned empty
* devolução de contêiner vazio

Então:

Mapear para:

* type = EMPTY_RETURN
* event_time_type conforme carrier

Sem alterar:

* série
* safe-first rule
* derivação de status
* derivação de alertas

### Regra de Segurança

Mapping só ocorre se:

* Texto for inequívoco
* Não houver colisão com outro tipo canônico

Caso contrário → fallback para evento desconhecido (conceito), persistido como `OTHER` no enum canônico atual.

---

## Parte B — Unknown Event Passthrough (Obrigatória)

### Problema Atual

Quando tipo não mapeado:

* conceptualmente = unknown event
* tipo canônico atual persistido = `OTHER`
* UI exibe "Outro"

Isso reduz confiança e obscurece informação original.

---

# 5. Nova Regra de Apresentação

Quando type não possuir label canônico:

UI deve:

1. Exibir o label original do carrier (carrierLabel)
2. Indicar explicitamente que o evento não é canônico

### Opções Visuais (Configuração UX)

#### Opção 1 — Sufixo textual

Exemplo:

Devolução de Contêiner Vazio (Evento não mapeado)

#### Opção 2 — Badge Enterprise (Recomendado)

Exemplo:

Devolução de Contêiner Vazio   [Não mapeado]

Badge:

* Variante: neutra / data
* Cor: cinza ou âmbar leve
* Tamanho: pequeno (compacto)
* Sem ícone agressivo
* Não gerar alerta automático

Objetivo do badge:

* Transparência
* Estética enterprise
* Comunicação clara sem poluição visual

A decisão final pode ser controlada por flag de UI.

---

# 6. Mudanças Técnicas

## 6.1 Tracking BC

Nenhuma mudança estrutural.

Tracking continua responsável por:

* Snapshot ingestion
* Observation normalization
* Series grouping
* Safe-first selection
* Status derivation
* Alert derivation

Nenhuma lógica nova é adicionada ao domínio.

---

## 6.2 Observation

Observation deve conter:

* raw carrier label (carrierLabel)

Se ainda não existir, adicionar campo:

carrierLabel: string

Esse campo:

* Não altera semântica
* Não interfere em derivação
* Não altera fingerprint
* Serve apenas como metadado auditável

---

## 6.3 Timeline Read Model

TrackingTimelineItem deve expor:

* type
* derived_state
* event_time
* carrierLabel? (opcional)

Tracking continua sem gerar labels.

---

## 6.4 UI Layer (process/ui)

Alterar regra atual:

ANTES:

switch(type)
default → "Outro"

DEPOIS:

if type possui label canônico:
usar label canônico
else if carrierLabel existe:
usar carrierLabel
+ indicar "Não mapeado" via:
- sufixo textual
OU
- badge
else:
"Evento desconhecido"

Proibido:

* Reclassificar evento na UI
* Alterar derived_state
* Inferir status

UI apenas apresenta.

---

# 7. UX Esperado

ANTES:

Outro
Santos, BR

DEPOIS (Badge):

Devolução de Contêiner Vazio   [Não mapeado]
Santos, BR

Impacto:

* Transparência
* Confiança
* Clareza operacional
* Aparência enterprise
* Sem alterar verdade do domínio

---

# 8. Alertas

Nenhuma alteração.

Unknown event NÃO gera alerta automático.
Badge NÃO é alerta de sistema.

---

# 9. Critérios de Aceite

1. Nenhum evento aparece como "Outro".
2. Eventos não mapeados exibem label original.
3. UI indica explicitamente que é não mapeado.
4. Nenhum status é alterado.
5. Nenhuma série é alterada.
6. Safe-first permanece intacto.
7. Nenhuma violação de boundary.
8. Lint de boundaries continua verde.

---

# 10. Não Objetivos

* Não criar novo enum canônico.
* Não alterar EMPTY_RETURN se já estiver correto.
* Não criar shared kernel.
* Não alterar derivação de status.
* Não alterar tracking pipeline.
* Não suprimir eventos desconhecidos.

---

# 11. Riscos e Mitigações

| Risco                             | Mitigação                      |
| --------------------------------- | ------------------------------ |
| Carrier envia label inconsistente | Exibir literal (auditável)     |
| UI ficar verbosa                  | Preferir badge compacto        |
| Tentação de inferir tipo na UI    | Documentar proibição explícita |

---

# 12. Decisão Arquitetural

✔ Sem violar BC boundaries
✔ Sem violar safe-first
✔ Sem violar append-only
✔ Sem alterar monotonicidade de status
✔ Sem introduzir acoplamento cross-BC
✔ Apenas melhoria de transparência visual

Arquiteturalmente seguro e alinhado ao modelo canônico.
