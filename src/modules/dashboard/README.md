# modules/dashboard

1. Propósito do Módulo

- Bounded context: construção de read-models e presenters otimizados para as views de alto nível (lista de processos, KPIs, resumos operacionais).
- Responsável por: apresentar dados prontos para UI (process summaries), conversão de respostas de API para view models e funções de agregação leve.
- NÃO responsável por: lógica pesada de domínio ou derivação de observações (essas responsabilidades ficam em `process` e `tracking`).

2. Estrutura interna (presente nesta pasta)

- application/
  - `processListPresenter.ts` — conversão de payloads da API em `ProcessSummary` para o dashboard.
  - `tests/` — testes unitários dos presenters.
- ui/
  - componentes e mapeadores que consumirão os view models produzidos por `application`.

3. Fluxo interno (exemplo de listagem)

API Response (process list) → presenter (`application/processListPresenter.ts`) → ProcessSummary ViewModel → UI component

4. Tipos principais (arquivo / camada)

- `ProcessApiResponse` / `ProcessSummary` — `src/modules/dashboard/application/processListPresenter.ts` (application/read-model).

5. Regras arquiteturais do módulo

- Não executar regras de domínio no presenter; apresenta dados derivados pelo backend.
- Evitar chamadas diretas à infra de outros módulos; consumir apenas DTOs/Responses expostos pela API ou contratos compartilhados (`shared/api-schemas`).

6. Pontos sensíveis / armadilhas

- O dashboard muitas vezes precisa de status agregado; se o backend não fornecer esse resumo, prefira criar um endpoint read-model em `process`/`tracking` em vez de replicar regras de derivação no dashboard.

7. Evolução futura (curto)

- Adicionar endpoints de resumo (projections) que retornem status e contadores já agregados para a UI.
- Melhorar testes de apresentação para cobrir casos com containers sem observações.
