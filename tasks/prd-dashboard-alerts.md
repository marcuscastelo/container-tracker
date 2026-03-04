# PRD — Alertas no Dashboard

---

## 1. Contexto Atual

Hoje:

* Alertas são derivados exclusivamente no Tracking BC.
* São exibidos apenas na tela de Processo.
* Não existe visão consolidada de exceções operacionais.
* O operador precisa entrar processo a processo para descobrir risco.

Isso conflita com o princípio operacional do produto:

> Exceções devem ser visíveis antes de detalhes.

---

# 2. Problema

O operador B2B precisa:

* Saber rapidamente o que exige ação
* Priorizar containers/processos com risco real
* Detectar atrasos e conflitos sem abrir cada processo

Hoje:

* O Dashboard é neutro
* Não há visão transversal de alertas ativos
* Alertas factuais e de monitoramento estão escondidos

Resultado: perda de eficiência operacional.

---

# 3. Objetivo da Feature

Introduzir no Dashboard:

* Visibilidade consolidada de alertas ativos
* Priorização por severidade
* Agregação por processo/container
* Clareza entre alertas factuais e monitoramento

Sem:

* Reimplementar domínio
* Quebrar boundaries
* Derivar status na UI
* Introduzir regra canônica fora do Tracking

---

# 4. Arquitetura e Boundaries

## 4.1 Origem da Verdade

Alertas continuam sendo:

* Derivados exclusivamente no Tracking BC
* Regidos pela Alert Policy formal

O Dashboard:

* NÃO cria alertas
* NÃO recalcula ETA delay
* NÃO aplica safe-first logic
* NÃO classifica eventos

Ele apenas consome read models.

---

## 4.2 Boundary Correto

A feature será implementada como Capability.

Estrutura:

* modules/tracking → deriva alertas
* modules/process → dados do processo
* capabilities/dashboard → compõe read model operacional
* UI → renderiza

Regras:

* Capability não define regras canônicas
* Capability não importa modules/*/domain diretamente
* UI não importa domain

---

# 5. Escopo Funcional

## 5.1 Indicadores Globais (Resumo Superior)

O Dashboard deve exibir:

* Total de alertas ativos
* Alertas por severidade:

  * danger
  * warning
  * info
  * success
* Alertas por categoria:

  * eta
  * movement
  * customs
  * status
  * data

Objetivo: visão macro imediata.

---

## 5.2 Lista de Processos com Exceção

Cada linha representa um processo.

Campos mínimos:

* Reference
* Origin → Destination
* Status derivado
* ETA atual
* Badge de severidade dominante
* Contador de alertas ativos

Ordenação:

1. Processos com danger primeiro
2. Depois warning
3. Depois info
4. Depois sem alerta

Nunca ocultar processos sem alerta (apenas ordenar).

---

## 5.3 Painel "Alertas Ativos"

Lista consolidada com:

* Processo
* Container (quando aplicável)
* Categoria
* Severidade
* Tipo (fact | monitoring)
* Descrição
* Timestamp de geração

Regras:

* UI formata datas
* UI aplica labels
* Backend não formata strings

---

# 6. Modelo de Dados

## 6.1 Tracking (BC)

Tracking deve expor read model de alertas com:

* alert_id
* process_id
* container_id
* category
* severity
* type (fact | monitoring)
* generated_at
* fingerprint
* is_active
* retroactive (quando fact retroativo)

Alertas seguem:

* Idempotência por fingerprint
* Distinção entre fact e monitoring
* Nenhum fato suprimido

---

## 6.2 Capability Dashboard

Criar read model composto:

DashboardOperationalSummaryReadModel

Composição:

* Dados do processo
* Status derivado
* ETA atual
* Alertas ativos
* Severidade dominante

Sem regra nova.

---

# 7. Regras Operacionais

## 7.1 Fact vs Monitoring

Fact Alert:

* Derivado de evento histórico
* Pode ser retroativo
* Não expira automaticamente

Monitoring Alert:

* Depende de "now"
* Expira quando condição deixa de existir
* Não pode ser retroativamente recriado

Dashboard deve diferenciar visualmente.

---

## 7.2 Conflitos de ACTUAL

Se houver múltiplos ACTUAL na mesma série:

* Emitir alerta categoria data
* Mostrar como conflito
* Nunca ocultar

---

## 7.3 ETA Delay

É alerta de monitoramento.

Baseado em:

* EXPECTED ativo
* Agora > event_time
* Sem ACTUAL correspondente

Dashboard não recalcula.

---

# 8. UX Operacional

Diretrizes:

* UI densa
* Orientada à exceção
* Severidade evidente
* ETA e Status nunca ocultos

Cores:

* danger → vermelho
* warning → amarelo
* info → azul
* success → verde

Badge pequeno porém chamativo.

---

# 9. Performance

Problema potencial:

* Muitos containers por processo
* Muitos alertas por container

Diretrizes:

* Capability deve consultar apenas alertas ativos
* Evitar carregar histórico completo
* Futuro: materialized operational summary

---

# 10. Não-Escopo

* Não permitir dismiss manual de fact alerts
* Não permitir override de severidade na UI
* Não mover derivação para capability
* Não criar shared kernel prematuro

---

# 11. Critérios de Aceite

Funcionais:

* Total de alertas ativos visível
* Processos ordenados por severidade dominante
* Fact vs Monitoring distinguíveis
* Conflitos de dados visíveis
* ETA delay visível sem abrir processo

Arquiteturais:

* Nenhum cross-BC domain import
* Dashboard implementado como capability
* UI não importa domain
* Tracking permanece único responsável por derivação
* Lint boundaries verdes

---

# 12. Evolução Futura

Possíveis extensões:

* Filtros por categoria
* Filtros por severidade
* SLA por cliente
* Alert aging (tempo desde geração)
* Agrupamento por cliente/importador

Sem alterar domínio.

---

# 13. Resumo Executivo

A feature transforma o produto de:

"Visualizador de processo individual"

Para:

"Painel operacional orientado à exceção"

Sem violar:

* Derivação canônica
* Invariantes de tracking
* Política formal de alertas
* Boundaries arquiteturais

Domínio continua governando a verdade.
Dashboard apenas expõe risco operacional de forma clara e priorizada.
