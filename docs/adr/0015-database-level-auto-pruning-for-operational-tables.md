# ADR — Database-Level Auto-Pruning for Operational Tables

Status: Accepted  
Date: 2026-03-10  
Deciders: Platform Architecture

---

# Context

Algumas tabelas do sistema possuem natureza **operacional e efêmera**.

Exemplos:

- `tracking_agent_activity_events`
- `sync_requests`

Essas tabelas são utilizadas para:

- telemetria de agentes
- observabilidade operacional
- histórico de execução de jobs
- controle de leases
- fila de sincronização

Características:

- alto volume
- crescimento contínuo
- utilidade limitada ao curto prazo
- não representam verdade canônica do domínio

Sem retenção automática, essas tabelas crescem indefinidamente, causando:

- aumento de storage
- degradação de índices
- maior custo de VACUUM
- queries mais lentas

O sistema utiliza **Postgres via Supabase**, que oferece suporte a:

```
pg_cron
```

permitindo execução de jobs diretamente no banco.

---

# Decision

Adotar **database-level auto-pruning** utilizando:

```
SQL functions + pg_cron
```

Fluxo:

```
cron job
   ↓
executa função SQL
   ↓
remove registros antigos
```

Esse mecanismo será aplicado apenas a **tabelas operacionais efêmeras**.

Escopo desta entrega:

- **Fase 1** para `sync_requests`, sem mudança de enum/status.
- Base temporal de retenção usando `created_at`.
- Agendamento diário em UTC via `pg_cron`.

---

# Retention Policy

### tracking_agent_activity_events

Retenção:

```
30 dias
```

Base temporal:

```
created_at
```

Motivação:

- debugging recente de agentes
- investigação de falhas operacionais
- observabilidade runtime

---

### sync_requests (Fase 1)

Prune apenas estados terminais atualmente existentes:

```
DONE
FAILED
```

Retenção:

```
14 dias
```

Base temporal:

```
created_at
```

Motivação:

- histórico recente suficiente para auditoria operacional
- evita remoção de jobs ativos

Evolução futura (fora da Fase 1):

- avaliar inclusão de `LEASE_EXPIRED`
- avaliar inclusão de `CANCELLED`

---

# Non-Goals

O mecanismo **não deve ser aplicado** a dados canônicos do domínio.

Exemplos de tabelas que **não devem sofrer pruning**:

- snapshots
- observations
- timeline de tracking
- containers
- processos

Essas tabelas seguem o princípio:

```
história preservada
append-only
auditabilidade total
```

---

# Alternatives Considered

## 1 — Job de limpeza na aplicação

Exemplo:

- worker
- cron externo
- scheduled function

Problemas:

- depende da aplicação estar rodando
- mais moving parts
- maior complexidade operacional
- risco de drift entre ambientes

---

## 2 — Edge function agendada

Possível no Supabase, porém:

- adiciona dependência externa
- aumenta latência operacional
- não traz benefícios frente ao cron interno

---

## 3 — Database Cron (Escolhida)

Vantagens:

- executa dentro do Postgres
- simples
- determinístico
- independente da aplicação
- sem infraestrutura adicional

---

# Consequences

## Positivas

- crescimento controlado do banco
- manutenção automática
- menor custo de storage
- queries mais rápidas em tabelas operacionais
- simplicidade arquitetural

---

## Negativas

- necessidade de cuidado com políticas de retenção
- risco de apagar dados úteis se retenção for muito curta

Mitigação:

- retenções conservadoras (14–30 dias)

---

# Implementation Strategy

A implementação consiste em:

1. SQL functions de prune
2. jobs pg_cron diários
3. índices para range scans eficientes
4. falha explícita da migration quando `pg_cron` não estiver disponível

Exemplo conceitual:

```
cron.schedule(...)
  → prune_function()
  → delete registros antigos
```

Esses exemplos são **ilustrativos** e não representam o código final.

Janela diária definida:

```
03:15 UTC  -> prune_tracking_agent_activity_events
03:30 UTC  -> prune_sync_requests
```

---

# Future Evolution

Caso o volume das tabelas aumente significativamente, podemos evoluir para:

- batch pruning
- particionamento por data
- retenção configurável por ambiente

No estágio atual, o modelo simples baseado em `pg_cron` é suficiente.

---

# Summary

O sistema adotará **pruning automático no nível do banco** para tabelas operacionais efêmeras.

Na **Fase 1**, `sync_requests` pruneia apenas `DONE` e `FAILED`, mantendo
`PENDING` e `LEASED` fora da política de remoção.

Implementação baseada em:

```
Postgres functions + pg_cron
```

Isso mantém o banco saudável sem comprometer a auditabilidade do domínio.
