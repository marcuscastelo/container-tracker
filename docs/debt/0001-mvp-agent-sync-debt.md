# MVP Agent Sync — Technical Debt Register

## Contexto
Este documento registra conscientemente os débitos técnicos introduzidos durante a implementação acelerada do MVP de Agent Sync (Supabase + SolidStart).

Objetivo:
- Tornar explícitos os atalhos feitos.
- Evitar “normalização do improviso”.
- Definir gatilhos claros para quitação.

---

# 1. Dívidas Arquiteturais

## 1.1 Lógica de domínio parcialmente em controller

**Descrição**
Parte da lógica de leasing, validação de lease ownership e marcação de FAILED/DONE está na camada HTTP.

**Impacto**
- Mistura de infraestrutura com regra de negócio.
- Dificulta reutilização futura (ex: CLI, jobs internos).

**Risco**
Médio.

**Correção futura**
- Extrair para `tracking.application`:
  - `LeaseSyncRequestsUseCase`
  - `IngestAgentSnapshotUseCase`
- Controller vira adapter fino.

**Gatilho de quitação**
Quando o fluxo Agent for considerado estável em produção.

---

## 1.2 Uso direto de Supabase Service Role na rota

**Descrição**
As routes usam `SUPABASE_SERVICE_ROLE_KEY` diretamente.

**Impacto**
- Bypass total de RLS.
- Dependência forte da infraestrutura.

**Risco**
Baixo no MVP, alto se crescer sem isolamento.

**Correção futura**
- Encapsular acesso ao Supabase em repositórios.
- Considerar ativar RLS multi-tenant com policies explícitas.

**Gatilho de quitação**
Quando houver múltiplos tenants reais rodando simultaneamente.

---

## 1.3 RPC custom para leasing

**Descrição**
Criada função SQL `lease_sync_requests` específica para esse caso.

**Impacto**
- Lógica de domínio parcialmente embutida no banco.

**Risco**
Baixo (justificável para concorrência).

**Correção futura**
- Documentar formalmente a invariância de leasing.
- Criar testes de integração que validem comportamento concorrente.

**Gatilho de quitação**
Quando surgir necessidade de múltiplos tipos de fila.

---

# 2. Dívidas de Segurança

## 2.1 AGENT_TOKEN global por ambiente

**Descrição**
Uso de token único para todos os agents.

**Impacto**
- Sem revogação individual.
- Sem isolamento por instalação.

**Risco**
Médio.

**Correção futura**
- Criar tabela `agents` com:
  - id
  - tenant_id
  - token hash
  - active flag
- Rotacionar tokens.

**Gatilho de quitação**
Quando primeiro cliente real rodar fora do ambiente controlado.

---

## 2.2 tenant_id vindo por query param

**Descrição**
tenant_id é informado pelo agent na URL.

**Impacto**
- Confiança implícita.

**Risco**
Baixo no MVP single-tenant.

**Correção futura**
- Associar tenant ao AGENT_TOKEN no backend.
- Remover tenant_id da query.

**Gatilho de quitação**
Quando houver mais de um tenant ativo.

---

# 3. Dívidas Operacionais

## 3.1 Sem idempotency key

**Descrição**
Ingest não possui proteção contra replay explícita.

**Impacto**
- Possível duplicação de snapshots em cenários extremos.

**Risco**
Baixo no MVP.

**Correção futura**
- Adicionar header `Idempotency-Key`.
- Criar tabela de dedupe por tenant.

**Gatilho de quitação**
Quando houver mais de um agent por tenant.

---

## 3.2 Sem spool offline no agent

**Descrição**
Agent descarta falhas se backend indisponível.

**Impacto**
- Perda temporária de dados.

**Risco**
Médio.

**Correção futura**
- Implementar fila local (SQLite ou arquivos JSONL).
- Retry com backoff exponencial.

**Gatilho de quitação**
Primeiro incidente de indisponibilidade real.

---

## 3.3 Sem métricas ou observabilidade

**Descrição**
Sem métricas de taxa de lease, ingest, falhas.

**Impacto**
- Diagnóstico difícil.

**Risco**
Médio.

**Correção futura**
- Log estruturado.
- Métricas simples (counter por provider).

**Gatilho de quitação**
Primeira investigação de erro não trivial.

---

# 4. Dívidas de Modelagem

## 4.1 ref_type limitado a "container"

**Descrição**
MVP assume apenas container.

**Impacto**
- Não generalizado.

**Risco**
Baixo.

**Correção futura**
- Formalizar enum no domínio.
- Adaptar resolver por tipo.

**Gatilho de quitação**
Quando surgir necessidade de process/booking.

---

## 4.2 Falha resolve container como FAILED direto

**Descrição**
Se 0 ou >1 resultados, request vira FAILED.

**Impacto**
- Não há retry automático.

**Risco**
Baixo.

**Correção futura**
- Diferenciar FAILED_PERMANENT vs FAILED_RETRYABLE.

**Gatilho de quitação**
Quando houver erro de integração recorrente.

---

# 5. Dívidas de Teste

## 5.1 Testes de concorrência apenas manuais

**Descrição**
Concorrência validada via smoke.

**Impacto**
- Sem garantia automatizada.

**Risco**
Médio.

**Correção futura**
- Teste de integração simulando múltiplos agents.

**Gatilho de quitação**
Antes de escalar para múltiplos clientes.

---

# 6. Dívidas de Boundary (Conforme Arquitetura do Projeto)

## 6.1 Tracking interface acessando diretamente infraestrutura Supabase

**Descrição**
Interface HTTP acessa Supabase sem passar por repositórios formais.

**Impacto**
- Viola parcialmente separação Domain/Application/Infrastructure.

**Risco**
Médio (arquitetural).

**Correção futura**
- Introduzir repositórios:
  - `SyncRequestRepository`
  - `SnapshotRepository`
- Application orquestra regras.

**Gatilho de quitação**
Após estabilização do MVP.

---

# 7. Dívidas Conscientes Aceitas para Amanhã

- Sem idempotência sofisticada.
- Sem RLS multi-tenant.
- Sem fila offline.
- Sem métricas.
- Sem abstração completa de repositórios.

Essas decisões são temporárias e justificadas pela necessidade de validação operacional rápida.

---

# Status

Documento criado antes da entrega do MVP para impedir que esses atalhos se tornem arquitetura permanente.

Responsável pela revisão: ____
Data da próxima revisão: ____
