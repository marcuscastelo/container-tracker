# Respostas do quiz — entendimento prévio

As respostas abaixo refletem o entendimento do domínio e das regras arquiteturais do projeto `Container Tracker` antes de informações adicionais.

## Section 1 — Layering & Types

Q1
A repository method receives `CreateContainerCommand` directly and maps it to `ContainerRow`.
Resposta: Viola a separação de camadas. A camada de aplicação/domínio não deve criar rows de persistência; isso é responsabilidade do mapper de infraestrutura. Misturar esses papéis vaza detalhes de persistência para as camadas superiores e quebra abstração.

Q2
A UI component imports `ContainerEntity` to derive a label.
Resposta: Não é permitido. A UI deve consumir read models/view models (application layer) e não importar entidades de domínio — isso evita acoplamento e duplicação de lógica de negócio no frontend.

Q3
Where must snake_case exist? A) Domain B) Application C) Infrastructure persistence mappers D) UI
Resposta: C) Infrastructure persistence mappers. Snake_case pertence ao shape do DB/rows; as camadas superiores usam camelCase.

Q4
Is `Partial<ProcessEntity>` allowed as an update input model?
Resposta: Não. `Partial<Entity>` é proibido porque quebra contratos e invariantes; preferir DTOs/comandos explícitos e validados.

Q5
`Response DTO` contains `created_at: string`. In domain it becomes `createdAt: Date`. Where must this transformation occur?
Resposta: No boundary infra → application: o mapper/adapter que converte o DTO para o modelo de domínio (ou input do application) deve transformar strings em `Date`.

## Section 2 — Domain & Tracking Invariants

Q6
Can a Snapshot ever be updated in place?
Resposta: Não. Snapshots são imutáveis para garantir auditabilidade e reprodutibilidade.

Q7
Why must Observations be append-only?
Resposta: Para preservar o histórico factual; se forem mutáveis perde-se auditoria, surgem inconsistências e corrompe-se a capacidade de gerar alerts retroativos e investigar conflitos.

Q8
Is ContainerStatus a stored truth or a derived value?
Resposta: É derivado — obtido a partir da timeline/observations/event series.

Q9
If a carrier sends: EXPECTED LOAD → EXPECTED LOAD (updated date) → ACTUAL LOAD
Resposta: Observations: 3 (append-only). Timeline entries exibidas: tipicamente 2 (a série EXPECTED/LOAD e, quando ACTUAL chega, o primary passa a ACTUAL). Mantém-se todos os facts; timeline escolhe primaries por série.

Q10
Two ACTUAL events appear in the same series.
Resposta: Registrar ambas as Observations, sinalizar conflito na série, exibir ambos com indicação de conflito e gerar alert/fact alert para investigação.

## Section 3 — Event Series Nuance

Q11
What is the Safe-First Primary Selection rule?
Resposta: Em cada série, selecione um único primary que maximize segurança/consistência: preferir ACTUAL se presente; caso contrário escolher EXPECTED relevante. Não apagar ACTUAL em favor de EXPECTED.

Q12
When does EXPECTED become EXPIRED_EXPECTED?
Resposta: Quando o ETA/expected time expira sem ocorrência do ACTUAL, segundo regras de expiração na camada de leitura/derivação (read model).

Q13
Should EXPECTED events after ACTUAL be deleted?
Resposta: Não. Mantém-se como histórico; podem ser ocultados, marcados como redundantes, mas não deletados.

Q14
Why is series grouping necessary instead of simply sorting all events chronologically?
Resposta: Series mantêm associação semântica entre eventos relacionados, permitem escolher primaries, detectar conflitos e derivar status corretamente — ordenação cronológica simples perde essa semântica.

## Section 4 — Alert Policy

Q15
Difference between Fact Alert and Monitoring Alert?
Resposta: Fact Alert: derivado de fatos (pode ser retroativo). Monitoring Alert: depende de "now" (tempo real) e não pode ser retroativo.

Q16
Can a Monitoring alert be generated retroactively?
Resposta: Não. Monitoring alerts dependem do estado corrente e não devem ser geradas retroativamente.

Q17
If fingerprint collision occurs for two conflicting ACTUAL events,
Resposta: Registrar ambas as Observations, sinalizar conflito, gerar alert; revisar fingerprinting/dedup logic. Nunca suprimir fatos automaticamente.

## Section 5 — BC vs Capability

Q18
Can a capability import `modules/*/domain`?
Resposta: Não. Capabilities podem usar `modules/*/application` (read models/usecases) mas não importar domain do BC. Isso preserva boundaries.

Q19
Dashboard needing ProcessOperationalSummary, Active Alerts, Tracking Status — where to place?
Resposta: `capabilities/dashboard`. Dashboards orquestram múltiplos BCs e vivem nas capabilities.

Q20
If two BCs need the same Value Object, what is preferred?
Resposta: Duplicar intencionalmente primeiro; só extrair shared kernel quando houver necessidade estável. Evita acoplamento prematuro.

## Section 6 — Read Models & Performance

Q21
Should dashboards load full Aggregates?
Resposta: Não. Use read models/denormalized projections otimizadas para leitura.

Q22
Where does date formatting for locale belong?
Resposta: Na UI/presentation layer.

Q23
Can Tracking return fully formatted strings?
Resposta: Não recomendado — mistura apresentação com domínio/read model e prejudica i18n e reuso.

Q24
If UI re-implements status derivation logic locally, what principle is violated?
Resposta: Viola single source of truth / boundaries — lógica de derivação do domínio não deve ser duplicada na UI.

## Section 7 — Trick Scenarios

Q25
Developer proposes deleting old EXPECTED events to keep DB clean.
Resposta: Inaceitável — viola invariantes append-only e auditabilidade.

Q26
Controller catches infra errors and returns `{ success: false }`.
Resposta: Incorreto — erros devem ser propagados/estruturados; booleanos escondem contextos e quebram observabilidade.

Q27
Repository returns `{ success: true, data: Entity }`.
Resposta: Padrão proibido — repositórios devem lançar erros ou retornar tipos claros; booleans de sucesso encorajam tratamento pobre de erros.

Q28
Status regresses from IN_TRANSIT to LOAD — what investigate?
Resposta: Verificar agrupamento de séries, timestamps, ingestão retroativa, collisions ou bugs nas regras de derivação.

Q29
Carrier omits intermediate milestones — timeline fail or tolerate holes?
Resposta: Tolerate holes; incomplete data is valid and must be explicit in UI.

Q30
Explain why: "The UI must never define domain truth."
Resposta: Domain truth contém regras/invariantes; UI é para apresentação. Se UI define verdades surgem inconsistências, duplicação de lógica e perda de auditabilidade. Domain logic deve ficar nos domain services/read models.

## Bonus Section — Master Alignment

Q31 — Which document defines layering rules?
Resposta: `docs/arquitetura_de_tipos_e_camadas_container_tracker_guia_definitivo-0211.md` (e `docs/BOUNDARIES.md`).

Q32 — Which document defines event series classification?
Resposta: `docs/TRACKING_EVENT_SERIES.md`.

Q33 — Which document defines invariants?
Resposta: `docs/TRACKING_INVARIANTS.md`.

Q34 — Which document defines alert semantics?
Resposta: `docs/ALERT_POLICY.md`.

Q35 — Which document defines product-level domain model?
Resposta: `docs/MASTER_v2.md`.

---
Arquivo gerado automaticamente em 2026-02-17 com base no entendimento prévio do repositório.
