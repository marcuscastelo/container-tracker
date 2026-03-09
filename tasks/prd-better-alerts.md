# PRD — Alertas Operacionais com Contexto de Container + Compatibilidade i18n

## Contexto

Atualmente os **alertas operacionais** exibidos no `/shipment` não indicam claramente **qual container gerou o alerta**.

Exemplo atual:

⚠ ATENÇÃO  
Transshipment detected at MAPTM02 — Vessel change: MAERSK NARMADA → CMA CGM LISA MARIE

Problemas:

1. Operador não sabe imediatamente **qual container está afetado**.
2. Quando existem múltiplos containers, alertas podem parecer duplicados.
3. Mensagem está parcialmente **hardcoded em inglês**, quebrando o sistema de i18n.
4. A UI precisa inferir contexto que já existe no domínio.

Isso viola dois princípios do sistema:

- **Clareza operacional** (alertas devem explicar a exceção rapidamente)
- **UI não deve derivar domínio** (ela deve receber dados já estruturados)  

O domínio já conhece o container que originou o alerta; a UI deve apenas exibir.

---

# Objetivo

Melhorar os alertas operacionais para:

1. Indicar **qual container gerou o alerta**
2. Permitir **agrupamento visual por tipo**
3. Tornar mensagens **100% compatíveis com i18n**
4. Manter **UI livre de regras de domínio**
5. Preservar **auditabilidade do alerta**

---

# Não Objetivos

Este PRD **não muda**:

- Lógica de derivação de alertas
- Alert policy
- Fingerprints
- Deduplicação
- Severidade

O PRD trata apenas de **exposição de dados + renderização UI**.

---

# Requisitos Funcionais

## 1 — Alerta deve indicar container

Cada alerta deve conter:

```
container_number
```

Exemplo de renderização:

⚠ Transshipment detectado  
Container: **MRSU8798130**  
Troca de navio: MAERSK NARMADA → CMA CGM LISA MARIE

---

## 2 — Alertas devem continuar individuais

Mesmo que dois containers gerem o mesmo alerta:

```
container A → alerta
container B → alerta
```

Eles continuam sendo **dois alertas distintos**.

Motivo:

- auditabilidade
- consistência com domínio
- deduplicação correta

---

## 3 — UI pode agrupar visualmente

A UI **pode opcionalmente agrupar**:

```
⚠ Transshipment detectado
2 containers afetados

• MRSU8798130
• CAAU7648798
```

Mas isso é **apenas visual**.

Cada alerta continua sendo entidade independente.

---

# Mudanças no DTO

## Atual (simplificado)

```
AlertDisplayDTO {
  id
  type
  severity
  message
  createdAt
}
```

---

## Novo

```
AlertDisplayDTO {
  id
  type
  severity
  createdAt

  containerNumber
  messageKey
  messageParams
}
```

---

# messageKey + messageParams

Em vez de enviar mensagem pronta:

```
"Transshipment detected..."
```

Enviar:

```
messageKey: "alerts.transshipmentDetected"
messageParams: {
  port: "MAPTM02",
  fromVessel: "MAERSK NARMADA",
  toVessel: "CMA CGM LISA MARIE"
}
```

---

# Benefícios

- i18n compatível
- UI controla idioma
- domínio não depende de tradução
- textos consistentes

---

# i18n Keys

Arquivo:

```
src/i18n/en/alerts.json
src/i18n/pt/alerts.json
```

---

## Exemplo

### en

```
alerts:
  transshipmentDetected: >
    Transshipment detected at {port} — Vessel change: {fromVessel} → {toVessel}

  containerLabel: "Container"
```

---

### pt

```
alerts:
  transshipmentDetected: >
    Transbordo detectado em {port} — Troca de navio: {fromVessel} → {toVessel}

  containerLabel: "Container"
```

---

# UI Rendering

Exemplo final:

```
⚠ ATENÇÃO
Transbordo detectado em MAPTM02 — Troca de navio: MAERSK NARMADA → CMA CGM LISA MARIE

Container: MRSU8798130
```

---

# Componente UI

Arquivo provável:

```
modules/process/ui/components/OperationalAlertCard.tsx
```

Renderização:

```
title
message
containerNumber
timestamp
```

---

# ViewModel

```
AlertDisplayVM {
  id
  severity
  createdAt
  containerNumber

  messageKey
  messageParams
}
```

Mapper:

```
AlertResponseDTO → AlertDisplayVM
```

---

# Compatibilidade Arquitetural

Este PRD respeita:

### Domain ownership

Alertas continuam sendo derivados pelo **Tracking BC**.

UI apenas consome.

Conforme regra arquitetural:

> Domain defines truth. UI only renders it.

---

### Type Architecture

Pipeline mantido:

```
Domain Alert
↓
Application Result
↓
HTTP Response DTO
↓
UI ViewModel
```

---

# Critérios de Aceite

### Backend

- [ ] `AlertResponseDTO` contém `containerNumber`
- [ ] DTO usa `messageKey + messageParams`
- [ ] Nenhuma string de alerta hardcoded

---

### UI

- [ ] Alertas exibem container
- [ ] Tradução via i18n
- [ ] Sem lógica de domínio

---

### i18n

- [ ] `alerts.*` namespace criado
- [ ] suporte pt/en
- [ ] placeholders funcionando

---

# Testes

### Backend

```
alert should include containerNumber
```

```
alert messageKey should exist
```

---

### UI

```
renders container number
renders translated message
```

---

# Impacto Esperado

Operador agora entende imediatamente:

```
o que aconteceu
em qual container
qual evento gerou o alerta
```

Reduz:

- leitura duplicada
- confusão com múltiplos containers
- dependência de texto hardcoded

---

# Resultado Visual Esperado

Antes:

```
⚠ ATENÇÃO
Transshipment detected...
```

Depois:

```
⚠ ATENÇÃO
Transbordo detectado em MAPTM02 — Troca de navio: MAERSK NARMADA → CMA CGM LISA MARIE

Container: MRSU8798130
```

---

# Prioridade

Alta

Motivo:

- melhoria operacional direta
- baixo risco técnico
- melhora compatibilidade i18n