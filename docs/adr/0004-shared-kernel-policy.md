# ADR-0004 — Política operacional de Shared Kernel

- Status: Accepted
- Data: 2026-02-21
- Relacionado a: `docs/BOUNDARIES.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`

---

## Contexto

Após a separação explícita entre BCs e capabilities (ADR-0003), continuou pendente a decisão operacional sobre quando compartilhar tipos entre BCs.

Sem uma regra objetiva, surgem dois riscos:

- acoplamento semântico prematuro via imports cross-BC de `domain`
- extração precoce de tipos para `shared/domain` sem estabilidade comprovada

---

## Decisão

1. **Padrão atual: duplicar por BC.**

- Tipos de domínio ficam locais em `src/modules/<bc>/domain`.
- `cross-BC domain imports` continuam proibidos.

2. **Não criar `src/shared/domain` nesta entrega.**

- A pasta só será introduzida quando existir necessidade comprovada.

3. **Critérios obrigatórios para extrair tipo para shared kernel:**

- Uso real em **>= 2 BCs**.
- Tipo com semântica **estável** por pelo menos um ciclo de roadmap.
- Tipo **sem regra de negócio** (apenas identidade/valor estável).
- Contrato equivalente já validado por testes nos BCs consumidores.

4. **Escopo permitido de shared kernel (quando criado):**

- value objects mínimos e estáveis (ex.: ids/códigos canônicos)
- nenhum comportamento que derive regra operacional

---

## Consequências

### Positivas

- Evita acoplamento antecipado entre BCs.
- Mantém autonomia de evolução de cada domínio.
- Torna a extração para shared kernel uma decisão rastreável e mensurável.

### Negativas

- Haverá duplicação temporária de VOs/tipos.
- Pode existir custo de sincronização manual até a extração ser justificada.

---

## Regras de enforcement

- Continuar bloqueando imports cross-BC de `domain` via lint.
- Qualquer proposta de introduzir `src/shared/domain` deve abrir nova ADR de evolução citando esta política.
