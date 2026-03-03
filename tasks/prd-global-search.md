# PRD — Evolução da Busca Global (Ctrl + K)

## 1. Contexto Atual

Hoje a busca global (Ctrl + K):

* Busca apenas por **Container Number**
* Opera como lookup simples
* Não orquestra múltiplos Bounded Contexts

Limitação:

Não é possível buscar por:

* Importador
* Processo (reference)
* ETA
* Status
* Nome do navio
* BL

---

## 2. Objetivo

Expandir a busca global para suportar múltiplos campos operacionais mantendo:

* UX densa e rápida
* Zero violação de boundaries arquiteturais
* Mínimo impacto estrutural
* Sem introduzir regra de domínio na capability
* Sem recalcular status ou ETA fora do BC correto

---

## 3. Princípios Arquiteturais

### 3.1 Localização correta

A busca global pertence a:

```
src/capabilities/search
```

Motivo:

* Orquestra múltiplos BCs
* Não define semântica canônica
* Apenas compõe read models

---

### 3.2 Proibições

A capability:

* NÃO pode importar `modules/*/domain`
* Só pode consumir `modules/*/application`
* NÃO pode recalcular status
* NÃO pode derivar ETA
* NÃO pode acessar Row diretamente

---

### 3.3 Status e ETA

Status:

* Deve vir de read model derivado no Tracking BC
* Nunca recalculado na capability

ETA:

* Deve vir da projeção tracking
* Nunca calculado na UI

---

## 4. Escopo da Nova Busca

### 4.1 Fase 1 (Baixa Complexidade)

Adicionar busca por:

* Container number
* Process reference
* Importador (nome)
* BL
* Nome do navio
* Status (texto exato)
* Carrier

---

### 4.2 Fase 2 (Adiar)

* Busca por datas (ETA > X, atraso > Y dias)
* Intervalos temporais
* Query DSL
* Ranking avançado

Motivo:

Busca temporal envolve lógica dinâmica dependente de "now" e regras de monitoring. Complexidade elevada → adiar.

---

## 5. UX Proposta

### 5.1 Modelo Mental

Busca única, textual, como:

```
MRKU2733926
MSC
DELAYED
REF123
MAERSK
Ever Given
BL123456
```

Sem filtros avançados na Fase 1.

---

### 5.2 Comportamento

* Busca textual simples
* Match parcial case-insensitive
* Resultado agrupado por Process
* Uma linha = um processo
* Limite fixo de resultados (ex: 30)

---

### 5.3 Heurística de Prioridade

Ordem simples de score:

1. Match exato container
2. Match exato process reference
3. Match parcial container
4. Match importador / BL
5. Match navio
6. Match status textual

Sem algoritmo complexo nesta fase.

---

## 6. Design Técnico

### 6.1 Estrutura da Capability

```
capabilities/search/
  application/
    search.facade.ts
    search.usecase.ts
  interface/http/
    search.controller.ts
  ui/
    search.vm.ts
```

---

### 6.2 Contratos

#### Command

```
SearchCommand {
  query: string
}
```

#### Result

```
SearchResultItem {
  processId
  processReference
  importerName
  containers[]
  carrier
  vesselName
  bl
  derivedStatus
  eta
  matchSource   // "container" | "importer" | "process" | "vessel" | "status"
}
```

Resultado NÃO é DTO HTTP.

---

### 6.3 Orquestração

Use case:

1. Normaliza query
2. Chama:

   * process.application.searchByText()
   * container.application.searchByNumber()
   * tracking.application.searchByVessel()
3. Consolida resultados por process
4. Remove duplicados
5. Ordena por heurística simples

A capability não:

* Deriva status
* Deriva ETA
* Faz join manual em Row
* Recalcula timeline

Apenas consome read models já derivados.

---

## 7. Mudanças Necessárias por BC

### 7.1 Process BC

Adicionar:

```
searchByText(query: string)
```

Campos buscáveis:

* reference
* importerName
* BL

Retorna:

```
ProcessSearchProjection
```

Sem carregar aggregate completo.

---

### 7.2 Container BC

Manter busca por número.

Opcional:

```
findByNumberLike(query)
```

---

### 7.3 Tracking BC

Adicionar projeção leve:

```
searchByVesselName(query)
```

Retorno:

```
{
  processId,
  vesselName,
  latestDerivedStatus,
  latestEta
}
```

Tracking continua responsável por:

* Status derivado
* Classificação de série
* Safe-first rule

---

## 8. Performance

### Fase 1

* LIKE / ILIKE simples
* Limite fixo (ex: 30 resultados)
* Sem full-text index

---

### Fase 2

* Materialized search projection
* Ranking real
* Indexação dedicada

---

## 9. Edge Cases

### 9.1 Ambiguidade

Se query bater em múltiplos campos:

* Retornar todos
* Não forçar filtro implícito

---

### 9.2 Query vazia

Não executar busca.

---

### 9.3 Query muito curta (1–2 chars)

Bloquear para evitar scan pesado.

---

## 10. Critérios de Aceite

### Funcionais

* Buscar container exato funciona
* Buscar process reference funciona
* Buscar importador funciona
* Buscar BL funciona
* Buscar nome do navio funciona
* Buscar status textual funciona
* Não há duplicação de processo
* Resultado respeita limite

---

### Arquiteturais

* Capability não importa domain
* Capability só importa application layer
* Status não recalculado fora do tracking
* Nenhum Row exposto para UI
* Nenhuma lógica de série duplicada

---

### UX

* Busca responde < 300ms
* Resultados consistentes com dashboard
* Não há regressão na busca atual

---

## 11. Impacto no Código Atual

Baixo a moderado.

Mudanças necessárias:

* Adicionar métodos search nos BCs
* Criar capability/search formal
* Ajustar endpoint Ctrl+K para usar capability

Não requer:

* Refatoração de aggregates
* Alteração no modelo de eventos
* Mudança na Alert Policy
* Alteração no Event Series Model

---

## 12. Roadmap

### Sprint 1

* Implementar search capability mínima
* Suporte: container + process + importador + BL

### Sprint 2

* Adicionar vessel + status
* Ajustar heurística simples

### Futuro

* Indexação dedicada
* Query estruturada
* Busca temporal
* Ranking avançado

---

# Conclusão

A busca evolui de:

> Lookup de container

Para:

> Search operacional transversal, arquiteturalmente segura

Sem violar boundaries e sem redefinir verdade do domínio.
