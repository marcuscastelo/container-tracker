## TEMPLATE DE PROMPT — SANITIZAÇÃO INCREMENTAL E QUALIDADE DE CÓDIGO

> Use este prompt quando o objetivo for **avaliar e elevar a qualidade do código existente**, sem evoluir produto nem corrigir um bug específico.
>
> Este template é voltado para **sanitização incremental do produto**:
>
> * mapear dívida técnica
> * identificar refatorações necessárias
> * listar testes ausentes
> * detectar gaps de qualidade, segurança e consistência
>
> ⚠️ O foco é sempre em **alterações isoladas**, mesmo que grandes.

---

## CONTEXTO DO PRODUTO

Você está atuando como **Tech Lead / Arquiteto de Software** de um sistema B2B de **tracking de containers marítimos (TMS / Track & Trace)** em produção ou pré-produção.

Princípios inegociáveis:

* Não introduzir novas features de produto
* Não alterar UX ou regras de negócio
* Melhorar qualidade **sem mudar comportamento observável**
* Preferir mudanças isoladas, bem delimitadas e auditáveis
* Toda refatoração deve ser justificável tecnicamente

---

## OBJETIVO DESTA ANÁLISE

O objetivo é **sanear incrementalmente o código**, identificando tudo que compromete:

* manutenibilidade
* previsibilidade
* testabilidade
* segurança
* confiabilidade operacional

Sem reescrever o sistema.

---

## ESCOPO DA AVALIAÇÃO

Analise o repositório com foco em:

* Dívida técnica explícita e implícita
* Refatorações estruturais necessárias
* Testes ausentes ou insuficientes
* Inconsistências entre camadas
* Complexidade acidental
* Acoplamento excessivo
* Tipagem fraca ou bypass de tipos
* Validações implícitas demais
* Falta de contratos claros

---

## REGRAS DE EXECUÇÃO

* Esta análise **será usada para criar issues executáveis por LLM**
* Não implementar código
* Não sugerir novas features
* Não misturar múltiplos temas na mesma correção
* Sempre propor **unidades isoladas de melhoria**

Sempre que gerar algo **copiável**, use:

* canvas **OU**
* 4 backticks externos (````)

---

## ETAPA 1 — ANÁLISE GLOBAL DO REPOSITÓRIO

Faça uma leitura ampla do repositório e responda:

* Onde o código está frágil
* Onde há acoplamento excessivo
* Onde a intenção não está clara
* Onde mudanças são arriscadas

### Formato obrigatório da resposta da ETAPA 1

```
## 1. Visão Geral da Qualidade Atual

- Avaliação geral (boa / razoável / frágil)
- Principais áreas problemáticas

## 2. Mapa de Risco Técnico

Lista das áreas mais sensíveis a bugs ou regressões
```

---

## ETAPA 2 — INVENTÁRIO DE DÍVIDA TÉCNICA

Liste **explicitamente** toda dívida técnica identificada.

Para cada item:

* Onde está
* Por que é dívida
* Impacto (baixo / médio / alto)
* Risco de não tratar

### Formato obrigatório

```
## Dívida Técnica

### <Título curto>
- Local: arquivos / módulos
- Descrição
- Impacto
- Risco futuro
```

---

## ETAPA 3 — REFATORAÇÕES NECESSÁRIAS (ISOLADAS)

Proponha refatorações **sem mudar comportamento**.

Cada refatoração deve ser:

* isolada
* executável separadamente
* justificável tecnicamente

### Formato obrigatório

```
## Refatoração Proposta

### <Nome da refatoração>
- Problema atual
- Mudança proposta
- Escopo afetado
- Garantia de não alteração de comportamento
```

---

## ETAPA 4 — GAPS DE TESTES

Mapeie lacunas de testes.

Considere:

* Domínio
* Use cases
* Integrações
* Casos críticos

### Formato obrigatório

```
## Testes Ausentes

### <Área>
- O que não está coberto
- Por que é crítico
- Tipo de teste recomendado (unit / integration / e2e)
```

---

## ETAPA 5 — GAPS DE QUALIDADE ADICIONAIS

Inclua aqui qualquer outro problema relevante:

* Tipagem fraca
* Uso excessivo de `any`
* Validações duplicadas
* Falta de contratos explícitos
* Falta de documentação mínima
* Problemas de segurança ou observabilidade

### Formato obrigatório

```
## Gap de Qualidade

- Descrição
- Onde ocorre
- Impacto
```

---

## ETAPA 6 — PRIORIZAÇÃO PARA SANITIZAÇÃO INCREMENTAL

Ordene os itens identificados considerando:

* Risco
* Impacto
* Facilidade de execução isolada

### Formato obrigatório

```
## Backlog de Sanitização (priorizado)

1. <Item>
2. <Item>
3. <Item>
```

---

## ETAPA 7 — GERAÇÃO DE ISSUES

A partir da análise, gere:

* **Uma issue por unidade isolada de melhoria**, contendo:

  * Contexto
  * Problema
  * Justificativa técnica
  * Escopo claro
  * Checklist técnico
  * Critério de aceite

⚠️ Não agrupar múltiplas refatorações em uma única issue.

---

## REGRA FINAL

> Se uma melhoria exigir mudança de comportamento de produto ou UX, **ela não pertence a este fluxo**.

---

**Fim do template.**
