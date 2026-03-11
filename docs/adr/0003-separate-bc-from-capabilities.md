# ADR-0003 — Separação explícita entre Bounded Contexts e Capabilities

* Status: Accepted
* Data: 2026-02-20
* Branch de implementação: `refactor/separate-bc-from-capabilities`
* Relacionado a: `docs/plans/refactor-bc-capabilities-execution-plan.md`

---

## Contexto

O projeto apresentava os seguintes problemas estruturais:

1. Imports cross-BC de `domain` (process ↔ tracking ↔ container).
2. Rotas (`src/routes/api/**`) acessando diretamente `application` e `infrastructure`.
3. Readmodels de application dependentes de DTOs HTTP (`shared/api-schemas`).
4. Módulos importando `capabilities`.
5. Endpoint de verificação de container localizado no BC errado (`process`).
6. Ausência de regras automatizadas impedindo regressão de boundary.

Esses pontos criavam:

* Acoplamento estrutural entre BCs.
* Dificuldade de evolução isolada.
* Risco de regressão silenciosa.
* Inversão de dependências entre camadas.

O objetivo foi estabilizar boundaries reais e enforceáveis, mantendo o monólito modular.

---

## Decisão

### 1. Separação formal entre BCs e Capabilities

* `modules/*` representam Bounded Contexts.
* `capabilities/*` representam composições transversais.

Regras:

* Modules NÃO podem importar capabilities.
* Capabilities NÃO podem importar `modules/*/domain`.
* Cross-BC `domain` imports são proibidos.

---

### 2. Rotas como adapters finos

Todas as rotas em `src/routes/api/**`:

* Não podem importar `domain`, `application` ou `infrastructure` diretamente.
* Devem delegar exclusivamente para controllers em `modules/*/interface/http` ou `capabilities/*/interface/http`.

---

### 3. DTO interno para projeção (Tracking)

Foi introduzido `TrackingObservationDTO` interno.

* `tracking.application/projection` não depende mais de DTO HTTP (`ObservationResponse`).
* Meta arquitetural: `application` não deve importar `shared/api-schemas`.
* Estado atual: ainda existe exceção residual em `process/application/process.presenter.ts`.

Application trabalha com contratos internos estáveis.

---

### 4. Endpoints canônicos por BC correto

* Criado: `POST /api/containers/check`.
* Removido: `POST /api/processes/check`.

Responsabilidade de verificação pertence ao BC `container`.

---

### 5. Isolamento completo de refresh (tracking)

* Rotas `refresh` convertidas para adapters finos.
* Orquestração movida para usecases.
* Puppeteer/Maersk isolado em infraestrutura.

Controller chama um único usecase.

---

### 6. Contrato semântico local no Process

`ProcessOperationalSummary` deixou de depender de `tracking/domain`.

Foi criado contrato semântico local (`operationalSemantics.ts`) com:

* Status operacional
* Severidade
* Regras de dominância

O BC process não depende mais do domínio de tracking.

---

### 7. Erros compartilhados mínimos

Erros neutros foram movidos para `src/shared/errors`.

* Nenhum erro compartilhado carrega entidade ou VO.
* Container não importa mais Process.

---

### 8. Enforcement via ESLint

Foram adicionadas regras de boundary que bloqueiam:

* Routes → domain/application/infrastructure
* Modules → capabilities
* Domain → interface/http/shared-ui/routes
* Cross-BC domain imports

As regras só foram ativadas após estado verde.

---

### 9. Implicação para UI operacional

Com boundaries explícitos:

* UI de shipment/process consome read models e permanece presentation-only.
* Timeline-first layout e agrupamentos operacionais devem ser renderizados a partir de contratos canônicos, sem re-derivação na UI.

Referência de composição visual/operacional:

* `docs/UI_PHILOSOPHY.md`

---

## Consequências

### Positivas

* Boundaries reforçados e automatizados no lint local.
* Redução total de imports cross-BC críticos.
* Readmodel de tracking independente de `ObservationResponse`.
* Rotas como camada de transporte pura.
* Evolução isolada por BC.
* Menor risco arquitetural futuro.

### Negativas

* Mais arquivos e boilerplate estrutural.
* Maior verbosidade em mapeamentos.
* Curva de aprendizado maior para novos contribuidores.

---

## Alternativas consideradas

1. Permitir cross-BC `domain` como "shared kernel implícito".

   * Rejeitado por gerar acoplamento difícil de rastrear.

2. Manter DTO HTTP como contrato interno.

   * Rejeitado por misturar transporte com modelo de aplicação.

3. Não aplicar regras ESLint e confiar em disciplina manual.

   * Rejeitado por alto risco de regressão.

---

## Estado atual após decisão (snapshot em 2026-02-21)

* `lint`: verde (execução local)
* `type-check`: verde (execução local)
* `test`: 1 teste falhando (`pipeline.integration.test.ts`, caso ACTUAL vs EXPECTED)
* Boundary scans: sem imports cross-BC de `domain`; ainda há import residual de `shared/api-schemas` em `application` (process presenter)
* CI: atualmente roda `i18n:check`; `lint`/`type-check`/`test` ainda não estão gateados no workflow

Arquitetura está significativamente mais estável, com pendências residuais explícitas para convergência completa.

---

## Notas futuras

* Avaliar métricas automatizadas de boundary no CI.
* Considerar ADR específico para política de Shared Kernel.
* Avaliar se Capabilities devem ter convenções adicionais formais.
