# ADR-0016 — Provider-Paced Container Auto-Sync Scheduler

Status: Accepted  
Date: 2026-03-10  
Owner: Tracking / Agent Runtime  

---

# Context

O Container Tracker depende de ingestão periódica de dados de carriers (Maersk, CMA CGM, MSC etc.) para manter timelines atualizadas.

Atualmente os syncs podem ser disparados por:

- ações manuais
- eventos operacionais

Entretanto, carriers frequentemente:

- atualizam eventos retroativamente
- corrigem ETA
- liberam eventos atrasados
- corrigem transbordos

Sem sincronização periódica automática, containers podem permanecer desatualizados por longos períodos.

---

# Constraint Operacional

A integração com carriers é feita via:

- scraping
- requests de browser simulado

Para evitar bloqueios ou throttling pelos carriers, devemos respeitar limites operacionais.

Limite definido:

```
máximo de 10 containers a cada 5 minutos por carrier
```

Isso impõe um **throughput máximo de sync**.

---

# Problem

Um auto-sync simples (cron diário que enfileira todos containers) causaria:

- burst de requests
- risco de bloqueio
- saturação de agentes
- comportamento pouco previsível

Precisamos de um mecanismo que:

- respeite limites por carrier
- distribua carga ao longo do tempo
- ainda garanta refresh periódico

---

# Decision

Implementar um **Provider-Paced Auto-Sync Scheduler**.

Esse scheduler:

- roda continuamente
- enfileira sync_requests gradualmente
- respeita limites por carrier
- garante refresh periódico dos containers

---

# Architecture

Fluxo:

```
scheduler (5 min)
       ↓
seleciona containers "due for sync"
       ↓
enqueue sync_requests
       ↓
agent lease
       ↓
carrier fetch
       ↓
snapshot ingest
       ↓
tracking pipeline
```

Importante:

O scheduler **não executa sync diretamente**.

Ele apenas **agenda trabalho na fila**.

---

# Boundaries

O scheduler é infraestrutura operacional.

Ele **não altera o domínio**.

Responsabilidades permanecem separadas:

Scheduler
- agenda trabalho

Agent
- executa integração com carriers

Tracking BC
- processa snapshots
- gera observations
- deriva timeline
- deriva status
- deriva alertas

---

# Sync SLA

Objetivo operacional:

```
todos containers devem ser sincronizados
ao menos uma vez a cada 24 horas
```

O scheduler garante isso distribuindo trabalho ao longo do dia.

---

# Throughput

Limite definido:

```
10 containers / 5 min / carrier
```

Capacidade diária por carrier:

```
12 execuções/hora
288 execuções/dia
2880 containers/dia/carrier
```

Se o número de containers exceder esse limite, o scheduler deve:

- priorizar containers mais antigos
- permitir refresh >24h para os restantes

---

# Container Selection

Containers elegíveis são selecionados com base em:

```
último sync DONE mais antigo
```

Prioridade de seleção:

1. containers nunca sincronizados
2. containers com sync mais antigo
3. containers com falha recente (respeitando backoff)

---

# Queue

O scheduler insere registros em:

```
sync_requests
```

Campos principais:

```
tenant_id
provider
ref_type
ref_value
status
priority
attempts
```

O agent continua consumindo normalmente.

---

# Idempotência

Garantias:

- scheduler evita duplicação recente
- fila controla estado
- lease evita concorrência
- ingestão de snapshot é idempotente
- pipeline tracking é determinístico

---

# Consequences

## Positivas

- refresh automático contínuo
- respeito a limites de scraping
- distribuição suave de carga
- sistema mais resiliente
- menor risco de bloqueio pelos carriers

## Negativas

- maior complexidade de scheduler
- refresh deixa de ser instantâneo

Ambos aceitáveis.

---

# Alternatives Considered

## Cron diário que enfileira todos containers

Problema:

- gera burst
- viola limites operacionais

Rejeitado.

---

## Agent fazendo scan completo de containers

Problema:

- mistura responsabilidades
- scheduling distribuído
- difícil observabilidade

Rejeitado.

---

# Future Improvements

Esta ADR registra possíveis evoluções.

---

## Adaptive Sync Frequency

Frequência baseada no estado do container.

Exemplo:

BOOKED → 48h  
IN_TRANSIT → 24h  
ARRIVING → 6h  

---

## Alert-Driven Sync

Containers com alertas ativos podem receber refresh mais frequente.

---

## Dynamic Priority

Tipos de sync:

```
manual sync
alert sync
scheduled sync
```

---

## Intelligent Scheduler

No futuro pode existir um:

```
tracking scheduler
```

que decide:

- quando sincronizar
- qual container sincronizar
- qual prioridade usar

---

## Multi-Tenant Fairness

Caso o sistema se torne multi-tenant:

- limitar bursts por tenant
- evitar starvation

---

# Decision Outcome

Adotar **Provider-Paced Auto-Sync Scheduler** garante:

- refresh periódico
- respeito a limites operacionais
- preservação da arquitetura atual
- escalabilidade futura.