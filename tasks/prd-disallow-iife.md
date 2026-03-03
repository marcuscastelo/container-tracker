# PRD — Code Quality: Proibir IIFE dentro de `<For>`, `<Show>`, `<Switch>`, etc.

---

## 1. Contexto

Na UI (SolidJS), foi observado o uso de IIFEs (Immediately Invoked Function Expressions) dentro de JSX, especialmente em control-flow primitives como:

* `<For>`
* `<Show>`
* `<Switch>`
* `<Match>`
* `<Index>`

Exemplo problemático:

```tsx
<For each={items()}>
  {(item) => (
    (() => {
      const x = heavyCompute(item);
      return <Row value={x} />;
    })()
  )}
</For>
```

Problemas causados:

* Aumenta complexidade ciclomática do componente.
* Esconde lógica imperativa dentro do render.
* Dificulta leitura e revisão de código.
* Mistura transformação de dados com apresentação.
* Pode gerar recomputações implícitas difíceis de auditar.
* Incentiva derivação ad hoc dentro da UI.

A UI deve ser declarativa. Transformações devem ocorrer antes do JSX.

---

## 2. Objetivo

Proibir via ESLint (ou ferramenta equivalente):

* IIFE dentro de JSX.
* `CallExpression` cujo `callee` seja `FunctionExpression` ou `ArrowFunctionExpression` dentro de qualquer `JSXExpressionContainer`.

Garantir que:

* JSX permaneça declarativo.
* Lógica intermediária seja extraída para:

  * variáveis antes do JSX
  * funções puras externas
  * `createMemo`
  * ViewModel previamente calculado

---

## 3. Fora de Escopo

* Proibir funções inline em geral.
* Refatoração automática completa do legado.
* Alteração de regras de domínio.

---

## 4. Regra Arquitetural Formal

### 4.1 Princípio

A UI é camada de apresentação.

* Não deve conter lógica imperativa oculta.
* Não deve misturar transformação pesada com render.
* Não deve derivar regras de domínio.

Render deve ser previsível, legível e auditável.

---

## 5. Solução Técnica

### 5.1 ESLint Custom Rule

Criar regra custom:

```
no-iife-in-jsx
```

### 5.2 O que detectar

Dentro de `JSXExpressionContainer`, detectar padrão:

```
CallExpression {
  callee: FunctionExpression | ArrowFunctionExpression
}
```

Exemplos proibidos:

```tsx
{(() => { ... })()}
```

```tsx
{(function () { ... })()}
```

### 5.3 Severidade

* Fase inicial: `warn`
* Após estabilização: `error` + gate CI

---

## 6. Alternativas Aceitas

### 6.1 Pré-cálculo antes do JSX

```tsx
const rows = items().map(mapToRowVM);

return (
  <For each={rows}>
    {(row) => <Row {...row} />}
  </For>
);
```

### 6.2 Uso de `createMemo`

```tsx
const computed = createMemo(() =>
  items().map(transform)
);
```

### 6.3 Função pura externa

```tsx
function renderRow(item: Item) {
  const x = compute(item);
  return <Row value={x} />;
}
```

---

## 7. Benefícios Esperados

* Redução da complexidade de componentes.
* Melhor legibilidade.
* Separação clara entre transformação e render.
* Menor risco de lógica escondida.
* Melhor auditabilidade em PRs.

---

## 8. Plano de Implementação

### Fase 1 — Implementação da regra

* Criar plugin interno (`eslint-plugin-container-tracker`).
* Implementar rule `no-iife-in-jsx`.
* Aplicar inicialmente em `src/modules/**/ui/**`.

### Fase 2 — Scan do repositório

* Executar com severidade `warn`.
* Mapear ocorrências.
* Criar tarefas de refatoração incremental.

### Fase 3 — Gate CI

* Alterar severidade para `error`.
* Incluir no pipeline junto com:

  * lint
  * type-check
  * test

---

## 9. Métrica de Sucesso

* 0 ocorrências de IIFE em JSX.
* Redução de complexidade média dos componentes.
* Nenhum caso de lógica de negócio escondida no render.

---

## 10. Riscos

### 10.1 Falsos positivos

Casos raros de IIFE legítima (ex: workaround de tipagem).

Mitigação:

```tsx
// eslint-disable-next-line no-iife-in-jsx -- justified reason
```

### 10.2 Resistência da equipe

Mitigação:

* Documentar guideline.
* Mostrar exemplos antes/depois.
* Reforçar princípio de UI declarativa.

---

## 11. Decisão Recomendada

Implementar a regra.

Aumenta previsibilidade, reduz complexidade estrutural da UI e reforça separação clara entre transformação de dados e renderização.
