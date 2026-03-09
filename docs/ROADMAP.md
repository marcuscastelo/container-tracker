# Container Tracker — Roadmap v3

## Filosofia do roadmap

Prioridade definida por:

1️⃣ Impacto operacional para o usuário  
2️⃣ Risco de inconsistência de domínio  
3️⃣ Redução de atrito de uso  
4️⃣ Dívida técnica que pode bloquear evolução

---

# P0 — BLOCKERS (corrigir primeiro)

Esses problemas **podem quebrar o produto** ou gerar inconsistência de dados.

---

## P0.1 — Bug: Soft-lock na criação de processo

Problema:

Fluxo de manipulação de containers gera estado impossível:

```
container já existente
campo removido
usuário não consegue resolver
```

Causa provável:

- validação de duplicidade global
- não contextualizada ao processo
- estado do formulário inconsistente

Objetivo:

- validação determinística
- remover soft-lock states

Critérios de aceite:

```
container pode ser removido e re-adicionado no mesmo form
duplicidade verificada apenas dentro do processo
erro de API não vira "container existente"
```

---

## P0.2 — Bug: container removido não pode ser re-adicionado

Problema:

checagem atual:

```
exists(container_number)
```

deveria ser:

```
exists(container_number, process_id)
```

Impacto:

bloqueia edição legítima.

---

## P0.3 — Bug: sync dashboard inconsistente

Problema:

```
botões de sync só atualizam após refresh
```

Possível causa:

- invalidation realtime
- cache local
- mutation reconciliation

Objetivo:

```
sync atualiza imediatamente UI
sem reload
```

---

## P0.4 — Bug: alerta de transbordo duplicado

Problema:

alerta duplicado após sync.

Esperado:

```
alert fingerprint:
container + vessel + voyage
```

Mas deve suportar:

```
A -> B -> A -> B
```

Então fingerprint precisa considerar:

```
container + series_index
```

ou

```
vessel_transition_id
```

---

## P0.5 — Severidade incorreta no dashboard

Problema:

```
alerta continua como ATENÇÃO mesmo após horas
```

Causa provável:

- aging incorreto
- derivação de severidade baseada em tempo

---

# P1 — UX OPERACIONAL (feedback do cliente)

Depois de corrigir bugs.

---

## P1.1 — Tabela operacional refinada

Itens ainda pendentes:

- linhas verticais finas
- Process Ref sempre caber
- sombras de cards
- fontes secundárias mais escuras

Objetivo:

**legibilidade operacional máxima.**

---

## P1.2 — Sort universal na tabela

Permitir:

```
sort em todas as colunas ordenáveis
```

Default:

```
severity:
critical
warning
none
```

---

## P1.3 — Colunas Importador / Exportador

Dashboard deve mostrar:

```
Process Ref
Importer
Exporter
Carrier
...
```

Importador logo após Process Ref.

---

## P1.4 — Tooltip inteligente de alertas

Tooltip do ícone warning:

exibe:

```
alerta dominante
+ até 3 adicionais
```

Exemplo:

```
⚠ ETA delay
+ 2 more alerts
```

---

## P1.5 — Reordenação de colunas

Usuário pode:

```
arrastar colunas
persistir em localStorage
```

Sem afetar:

```
Process Ref
Alert column
```

que são fixas.

---

## P1.6 — Alertas não sticky no shipment

Alertas devem:

```
rolar com página
```

Motivo:

shipment page é **contexto investigativo**, não dashboard.

---

## P1.7 — Tray icon customizado no agent (Windows)

UX pequena mas importante para cliente.

---

# P2 — PRODUCT CAPABILITY

Features que aumentam valor real.

---

## P2.1 — Colar múltiplos containers

Permitir:

```
paste:
MSCU123
MSCU124
MSCU125
```

criar containers automaticamente.

---

## P2.2 — Importação rápida (CSV / texto)

Formato:

```
container,carrier,booking
```

ou

```
MSCU123 CMA
MSCU124 MSC
```

---

## P2.3 — Dashboard column visibility

Usuário escolhe:

```
colunas visíveis
```

Persistência:

```
localStorage
```

Fallback:

```
default columns
```

---

## P2.4 — Copiar valores da tabela

Um clique:

```
copy container
copy process ref
copy vessel
```

---

## P2.5 — Paginação no dashboard

Hoje:

```
lista infinita
```

Problema:

- performance
- navegabilidade

---

## P2.6 — Busca global dentro do processo

Buscar:

```
container
vessel
event
location
```

---

## P2.7 — Sync inteligente

Botões:

```
sync container
sync process
sync all
```

Com regra:

```
sync all ignora:
- archived
- synced recently
```

---

# P3 — TRACKING ENGINE

Melhorias no domínio.

---

## P3.1 — Promoção EXPECTED → ACTUAL

Hoje:

```
EXPECTED mantido
ACTUAL criado
```

Resultado:

timeline duplicada.

Objetivo:

```
EXPECTED existente promovido a ACTUAL
```

Sem duplicação.

---

## P3.2 — Evento de transbordo

Detectar automaticamente:

```
arrival vessel A
departure vessel B
```

Gerar:

```
transshipment event
alerta
```

---

## P3.3 — Enriquecimento de alertas

Alertas devem incluir:

```
container
vessel antigo
vessel novo
```

---

## P3.4 — Progresso operacional

Exibir:

```
Loaded (5/10)
Discharged (7/10)
```

ou

```
progress bar
```

---

# P4 — PLATFORM / TECH

Coisas que ajudam evolução do sistema.

---

## P4.1 — Error codes estruturados

Trocar:

```
mensagens hardcoded
```

por:

```
error_code + params
```

para i18n.

---

## P4.2 — Refatorar clipboard utils

Duplicação em:

```
CopyButton
ShipmentView
```

---

## P4.3 — Mover parsing para data layer

Lógica pesada hoje em:

```
ShipmentView
Dashboard
refresh
```

deve ir para:

```
adapters / data layer
```

---

## P4.4 — Estrutura da pasta tools

Hoje:

```
tools/
```

mistura:

```
agent
scripts
AI prompts
```

Proposta:

```
/agent
/devtools
/ai
```

---

## P4.5 — API versioning

Hoje:

```
Processes API v1
Processes API v2
```

Avaliar:

```
deprecar v1
```

---

# INVESTIGAÇÕES

Itens que precisam pesquisa.

---

## Container identity

Pergunta:

```
container_number deve ser PK?
```

Problema atual:

mesmo container pode aparecer em carriers diferentes.

---

## Carrier auto-detection

Fluxo futuro:

```
container -> tenta carriers por probabilidade
```

---

# Roadmap simplificado

```
P0  Bugs críticos
P1  UX operacional
P2  Product capability
P3  Tracking engine
P4  Platform / tech
```

---

# Recomendação estratégica

Para **produto real com cliente**:

prioridade deve ser:

```
P0
P1
P2
```

Evitar focar agora em:

```
P4
```

até o produto estar operacionalmente estável.