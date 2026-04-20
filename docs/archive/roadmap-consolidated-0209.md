# Roadmap Técnico — v2 (Consolidado com Datas)

Este roadmap consolida **todas decisões, ideias, feedbacks de cliente e discussões técnicas** até momento. Ele é orientado **execução**, com **entregáveis claros, previsões de data e critérios de aceite**. datas são **estimativas realistas**, ajustáveis conforme feedback.

> Horizonte considerado: **curto prazo (4–6 semanas)** com validação contínua do cliente.

---

## Princípios não-negociáveis (válidos para todo o roadmap)

* APIs externas **não são confiáveis** como source of truth
* Snapshots são **imutáveis** e sempre persistidos
* Observations são fatos semânticos, idempotentes, deduplicáveis
* Status é **projeção monotônica** (não regride)
* Alertas são derivados, auditáveis e explicáveis
* UI **nunca** deriva domínio
* Tipagem forte (sem `any`, sem `as`)

---

## FASE 0 — Fundação Canônica (invisível, obrigatória)

### F0.1 — Modelo Canônico Executável (DONE)

**Objetivo**
Estabelecer vocabulário único do sistema.

---

### F0.2 — Motor Canônico de Derivação

📅 **Status:** EM AJUSTE FINAL

**Objetivo**
Converter dados inconsistentes em verdade operacional confiável **com correção de bugs críticos de carriers**.

**Entregas (implementadas)**

* Pipeline completo:

  * `normalizeSnapshot → ObservationDraft[]`
  * `diffObservations(prev, curr) → Observation[]`
  * `deriveTimeline(observations)`
  * `deriveStatus(timeline)`
  * `deriveAlerts(timeline, status)`
* Diferenciação ACTUAL vs EXPECTED persistida e exibida
* Normalização robusta de datas (UTC, date-only, carrier quirks)
* Testes de domínio cobrindo Maersk, CMA CGM e MSC

**Correções de bugs incorporadas ao F0.2**

* Maersk exibindo `OTHER` indevidamente na timeline
* CMA CGM marcando `EXPECTED` em excesso
* Inconsistências de activity mapping entre carriers

**Critério de aceite**

* Timeline e status 100% derivados do domínio (sem UI)
* Nenhum evento `OTHER` sem justificativa explícita
* ACTUAL vs EXPECTED consistente entre carriers
* Casos reais cobertos por testes automatizados

---

## FASE 1 — Existência Operacional (UX básica)

### F1.1 — Campos do Processo + Correções Rápidas

📅 **Status:** EM PROGRESSO

**Objetivo**
Padronizar e estabilizar campos operacionais do processo antes de avançar para alertas e automações.

**Entregas (parciais)**

1. BL único (Bill of Lading) — **OK**
2. Booking separado (opcional) — **PENDENTE padronização**
3. Nome do Importador — **PENDENTE padronização**
4. Nome do Exportador — **PENDENTE padronização**
5. Ref. Nossa — **PENDENTE padronização**
6. Ref. do Importador — **PENDENTE padronização**
7. Produto (descrição simples) — **PENDENTE padronização**
8. Número da Redestinação — **NÃO IMPLEMENTADO**
9. Regras de exibição (ordem, rótulos, obrigatoriedade) — **NÃO DEFINIDAS**

**Correções incluídas**

* Remoção do tipo de operação (sempre importação)
* Remoção de anotações livres

**Pendências explícitas**

* Definir nomenclatura final (PT / EN)
* Definir quais campos são obrigatórios vs opcionais
* Garantir consistência entre UI, domínio e persistência

**Critério de aceite**

* Todos campos 2–9 padronizados e documentados
* Nenhum campo ambíguo para usuário final

---

### F1.2 — Correções Residuais de Carriers

📅 **Status:** DEPOIS DO F0.2

**Objetivo**
Tratar bugs não críticos ou específicos que não impactam derivação canônica.

**Escopo**

* Casos raros ou edge cases não bloqueantes
* Ajustes finos de UI ou labels
* Correções sem impacto em status / timeline

---

## FASE 2 — Visualização Operacional (em progresso)

### F2.1 — Dashboard Operacional

📅 **Previsão:** Semana 2

**Entregas**

* Tabela de Shipments
* Containers: mostrar 1º + badge +N
* Ícone do armador
* Status atual
* Contador de alertas visível

---

### F2.2 — Timeline Canônica (pré-alertas)

📅 **Status:** EM PROGRESSO

**Entregas já realizadas**

* Timeline baseada exclusivamente em Observations
* Ordenação consistente por `event_time`
* Diferenciação ACTUAL vs EXPECTED na UI
* Exibição de navio por evento

**Pendências**

* Destaque visual explícito para mudança de navio
* UX final para buracos de timeline

---

## FASE 3 — Transbordo (foco principal do cliente)

### F3.1 — Detecção Canônica de Transbordo

📅 **Status:** PRÓXIMA
📅 **Previsão:** Semana 3

**Entregas**

* Regra formal de transbordo
* Flag `hasTransshipment`
* Contador de transbordos
* Badge no processo/container

**Critério de aceite**

* Zero falso positivo
* Detecção retroativa garantida

---

### F3.2 — Alertas Fact-based (Transbordo)

📅 **Status:** BLOQUEADA ATÉ F3.1
📅 **Previsão:** Semana 3–4

**Entregas**

* Alerta `TRANSBORDO`
* Categoria FACT
* Severidade alta
* Disparo único
* Histórico preservado
* UI com destaque forte

---

## FASE 4 — Notificações

### F4.1 — Email Automático (Entrega Final)

📅 **Previsão:** Semana 4–5

**Entregas**

* Envio de email em alertas FACT
* Assunto claro (mudança de navio)
* Conteúdo objetivo
* Link direto para processo

---

## FASE 5 — Refinos e Power-user

📅 **Previsão:** Semana 5–6

* Busca avançada
* Pequenas automações de produtividade
* Ajustes finos de UX com base no uso real

---

## Roadmap resumido (executivo)

1. Motor de derivação
2. Campos + correções + bugs
3. Timeline clara
4. Transbordo detectado
5. Alerta forte
6. Email automático

---

Este roadmap é **contrato técnico-operacional do projeto**. Novos pedidos entram como fase ou ajuste explícito, nunca de forma implícita.
