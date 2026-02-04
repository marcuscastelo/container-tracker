# Roadmap Macro — Container Tracker

> Objetivo: destravar **valor operacional progressivo**, começando por **features habilitantes** (sem as quais o produto não existe de verdade) e avançando para **inteligência, UX densa e exceções**, sem perder os princípios de domínio e usabilidade já definidos.

Este roadmap **não é visual** nem de layout. Ele organiza **capacidades do sistema**, dependências e perguntas abertas, para que cada feature seja refinada isoladamente depois.

---

## Princípios que guiam TODO o roadmap

* **O domínio vem antes da UI**: nenhuma feature nasce sem clareza de eventos, estados e incerteza.
* **Incerteza explícita é feature**, não bug.
* **Uma entrega = algo utilizável em produção**, mesmo que feio.
* **Exceções primeiro**, otimizações depois.
* **Nada depende de integração perfeita com carrier** (sistema deve funcionar com dados ruins).

---

## FASE 0 — Fundação Invisível (pré-UI, mas crítica)

> Sem isso, qualquer UI vira mentira bonita.

### F0.1 — Modelo Canônico Executável

**Objetivo**: sair do modelo conceitual e torná-lo executável, validável e versionado.

Capacidades:

* Schemas Zod para:

  * Shipment
  * Container
  * Event
  * Location
  * Alert
* Distinção clara:

  * ACTUAL vs EXPECTED
  * Event vs Estado derivado
* Campo obrigatório para:

  * source
  * fetch_time
  * raw_payload (imutável)

Insumos de UX futuros:

* Possibilidade de mostrar *confiança do dado*
* Possibilidade de explicar "por que esse status é esse"

Perguntas abertas:

* Eventos podem ser reprocessados retroativamente?
* Precisamos versionar regras de derivação?

---

### F0.2 — Motor de Derivação de Status

**Objetivo**: centralizar a verdade operacional.

Capacidades:

* Função pura: `deriveContainerState(events[])`
* Regras explícitas para:

  * Estado atual
  * ETA final
  * Flags (`is_delayed`, `stale_data`, `missing_eta`)
* Ordem de precedência documentada

Insumos de UX futuros:

* Tooltip “derivado de X eventos”
* Debug operacional (timeline confiável)

---

## FASE 1 — Existência do Processo (habilitantes)

> Aqui o sistema passa a *existir* para o usuário.

### F1.1 — Criação Manual de Shipment / Container

**Objetivo**: permitir registrar um processo mesmo sem integração.

Capacidades:

* Criar Shipment manualmente
* Associar 1+ Containers
* Campos mínimos:

  * Container number
  * POL / POD
  * Carrier (opcional)
  * ETA inicial (opcional)
* Estado inicial explícito: `UNKNOWN` ou `BOOKED`

Insumos de UX futuros:

* Mostrar containers "sem dados de carrier"
* Diferenciar manual vs automático

Riscos conhecidos:

* Usuário criar dados errados

Mitigação:

* Validação leve
* Fonte do dado sempre visível

---

### F1.2 — Registro Manual de Eventos

**Objetivo**: não depender de carrier para contar história.

Capacidades:

* Adicionar evento manual:

  * tipo
  * data/hora
  * localização
  * ACTUAL / EXPECTED
* Evento manual nunca sobrescreve automático

Insumos de UX futuros:

* Linha do tempo híbrida (manual + carrier)
* Auditoria clara

---

## FASE 2 — Visualização Operacional Básica

> Ver, entender, confiar.

### F2.1 — Tabela Central de Containers

**Objetivo**: visão operacional diária.

Capacidades:

* Uma linha = um container
* Colunas mínimas fixas:

  * Container
  * Status atual
  * ETA final
  * Atraso
  * Último evento
  * Carrier
* Ordenação por exceção (default)

Insumos de UX futuros:

* Dense-first
* Hover revela detalhe

---

### F2.2 — Timeline do Container

**Objetivo**: explicar o estado atual.

Capacidades:

* Lista cronológica de eventos
* Diferenciação visual ACTUAL vs EXPECTED
* Buracos explícitos ("sem eventos entre X e Y")
* Fonte + timestamp visíveis

Insumos de UX futuros:

* Confiança
* Debug operacional

---

## FASE 3 — Alertas Operacionais (valor real)

> O sistema começa a trabalhar pelo usuário.

### F3.1 — Geração Automática de Alertas

**Objetivo**: detectar exceções cedo.

Capacidades:

* Alertas por categoria:

  * eta
  * movement
  * customs
  * data
* Severidade calculada
* Alertas derivados, não manuais

Insumos de UX futuros:

* Foco do operador
* Redução de stress

---

### F3.2 — Gestão de Alertas

**Objetivo**: evitar ruído.

Capacidades:

* Ack / silenciar
* Alertas não se repetem sem novo fato
* Histórico de alertas por container

Perguntas futuras:

* Alertas por usuário?
* SLA por tipo?

---

## FASE 4 — Busca, Filtros e Ritmo Diário

> Tornar rápido o que é repetitivo.

### F4.1 — Busca Global

* Container
* BL
* Shipment

### F4.2 — Filtros Operacionais

* Status
* Carrier
* Atraso
* ETA hoje
* Dados incompletos

Insumos de UX futuros:

* Default view do operador às 9h

---

## FASE 5 — Leitura Analítica Leve

> Sem virar BI.

### F5.1 — Visões Agregadas

* Containers atrasados por carrier
* Rota com mais exceções
* Tempo médio por milestone (quando possível)

Princípio:

* Contadores > gráficos

---

## FASE 6 — Confiança, Transparência e Escala

### F6.1 — Data Quality Layer

* Indicar dados inconsistentes
* Indicar carrier silencioso

### F6.2 — Auditoria

* Quem criou
* Quem alterou
* Origem do dado

---

## O que NÃO está no roadmap (por enquanto)

* Dashboards executivos bonitos
* Previsão ML de ETA
* Integração EDI profunda
* Mobile-first

Esses só fazem sentido quando **o core é confiável**.

