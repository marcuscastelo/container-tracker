# ADR-0016 — Daily Container Auto Sync Strategy

Status: Accepted  
Date: 2026-03-10  
Authors: Container Tracker Architecture  

---

# Context

O sistema de tracking depende da ingestão de snapshots provenientes dos carriers (Maersk, CMA CGM, MSC etc.) para manter a timeline dos containers atualizada.

Hoje existem dois mecanismos principais para disparar sincronizações:

1. Sync manual via UI/API
2. Sync operacional disparado por eventos específicos

Entretanto, carriers frequentemente:

- atualizam eventos **retroativamente**
- alteram **ETA / transbordos**
- liberam eventos atrasados

Se um container **não recebe eventos por muito tempo**, o sistema pode permanecer com dados desatualizados até que um sync manual seja feito.

Isso cria riscos operacionais:

- ETA incorreta
- alertas defasados
- timeline incompleta

Precisamos de um mecanismo que garanta **refresh periódico automático** dos containers.

---

# Decision

Adotar um **auto-sync diário baseado em fila**, reutilizando a infraestrutura existente de `sync_requests`.

Arquitetura escolhida:

```
pg_cron (daily)
        ↓
enqueue sync_requests
        ↓
agent lease
        ↓
provider fetch
        ↓
snapshot ingest
        ↓
tracking pipeline
```

O cron **não executa sync diretamente**.

Ele apenas **cria pedidos de sincronização** na fila.

---

# Rationale

Essa abordagem respeita as invariantes do sistema:

### 1. Separação de responsabilidades

Cron:
- agenda trabalho

Agent:
- executa integração com carriers

Tracking:
- processa snapshots
- deriva timeline
- deriva status
- deriva alertas

Nenhuma regra de domínio é movida para cron.

---

### 2. Reuso da infraestrutura existente

A fila `sync_requests` já possui:

- leasing
- retries
- controle de status
- deduplicação operacional

Logo não é necessário criar um novo sistema.

---

### 3. Escalabilidade

Mesmo com:

```
10k containers
```

Carga estimada:

```
10k syncs / dia
≈ 7 por minuto
```

Carga extremamente baixa.

---

### 4. Idempotência

O sistema já possui garantias de idempotência:

- fila controla execução
- lease evita concorrência
- ingestão de snapshot é idempotente
- pipeline de tracking é determinístico

---

# Implementation Summary

1. Criar função SQL:

```
enqueue_daily_container_sync()
```

2. A função:

- seleciona containers elegíveis
- cria `sync_requests`
- evita duplicação nas últimas 24h

3. Registrar cron job:

```
03:00 UTC
```

---

# Consequences

## Positivas

- todos containers recebem refresh diário
- dados ficam mais confiáveis
- menor dependência de sync manual
- carriers com atualizações tardias são capturados
- alertas ficam mais consistentes

---

## Negativas

- aumento pequeno no volume de sync
- pequena carga adicional no agent

Ambos considerados aceitáveis.

---

# Architectural Boundaries

Este mecanismo **não altera o domínio**.

Cron:

- não executa derivação
- não altera status
- não interpreta eventos

A verdade continua sendo derivada por:

```
Snapshot
   ↓
Observation
   ↓
Series
   ↓
Status
   ↓
Alerts
```

Tracking continua sendo **source of truth**.

---

# Future Improvements

Esta ADR documenta possíveis evoluções futuras do mecanismo de auto-sync.

Essas melhorias **não fazem parte da implementação inicial**.

---

## 1. Sync baseado em última atualização

Hoje:

```
sync diário fixo
```

Melhoria possível:

```
sync apenas containers sem update recente
```

Exemplo:

```
last_event_at > 48h
```

Benefício:

- reduzir carga desnecessária.

---

## 2. Sync adaptativo por fase da viagem

Containers podem ter frequência diferente:

```
BOOKED → baixo
IN_TRANSIT → médio
ARRIVING → alto
```

Exemplo:

| Status     | Frequência |
| ---------- | ---------- |
| BOOKED     | 48h        |
| IN_TRANSIT | 24h        |
| ARRIVING   | 6h         |

---

## 3. Sync baseado em alertas

Containers com alertas ativos poderiam receber refresh mais frequente.

Exemplo:

```
stagnation alert → sync mais frequente
ETA risk → sync mais frequente
```

---

## 4. Prioridade dinâmica

Hoje:

```
priority = 0
```

Futuro:

```
manual sync → prioridade alta
alert-driven sync → média
daily sync → baixa
```

---

## 5. Scheduler inteligente

No futuro o sistema pode evoluir para:

```
tracking scheduler
```

que decide:

```
quando sincronizar
qual container sincronizar
qual prioridade
```

Isso permitiria:

- sync adaptativo
- balanceamento de carga
- SLA operacional

---

## 6. Multi-tenant fairness

Caso o sistema se torne multi-tenant:

- limitar bursts por tenant
- garantir fairness

---

# Alternatives Considered

## Agent executando full scan

Agent poderia escanear todos containers diretamente.

Problemas:

- mistura responsabilidades
- remove controle central da fila
- dificulta observabilidade

---

## Sync baseado em timers no agent

Agent poderia manter timers internos.

Problemas:

- estado distribuído
- reinícios quebram scheduling
- difícil de auditar

---

# Decision Outcome

Adotar **auto-sync diário via fila** é a solução mais simples, segura e consistente com a arquitetura atual.

A ADR também estabelece um roadmap claro para evoluções futuras.

---

# Related Documents

PRD — Daily Auto Sync  
Tracking Architecture  
Agent Runtime Architecture  
Alert Policy