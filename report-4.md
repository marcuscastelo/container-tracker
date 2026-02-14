# Report 4 — Localizações: origem e uso de `location_display` / `location_code`

Data: 2026-02-14

Resumo curto: investiguei os normalizers (adapters), o modelo de Observation, a geração de Timeline e a derivação de transbordo. Há campos consistentes sendo populados pelos adapters, mas não existe um ponto único de verdade para resoluções legíveis de porto (display name). Recomendo extrair um LocationDisplayResolver para a camada de Application (com infra para lookup UN/LOCODE quando disponível).

Status geral: 🟡 Parcial (há coerência local, mas não uma fonte única e centralizada)

---

## 1) Normalizers (src/modules/tracking/infrastructure/adapters)
Arquivos inspecionados:
- /home/marucs/Development/Castro/container-tracker/src/modules/tracking/infrastructure/adapters/maersk.normalizer.ts
- /home/marucs/Development/Castro/container-tracker/src/modules/tracking/infrastructure/adapters/msc.normalizer.ts
- /home/marucs/Development/Castro/container-tracker/src/modules/tracking/infrastructure/adapters/cmacgm.normalizer.ts

Observação geral: todos os normalizers geram objetos do tipo ObservationDraft com a mesma shape; os campos preenchidos repetidamente são (ver código em cada arquivo):

Campos que cada normalizer preenche (por observação/draft):
- container_number
- type (ObservationType)
- event_time (ISO string | null)
- event_time_type ('ACTUAL' | 'EXPECTED')
- location_code (string | null)
- location_display (string | null)
- vessel_name (string | null)
- voyage (string | null)
- is_empty (boolean | null)
- confidence ('low'|'medium'|'high')
- provider (literal: 'maersk' | 'msc' | 'cmacgm')
- snapshot_id
- raw_event (verbatim carrier event object)

Fontes de `location_display` e `location_code` por adapter:

- Maersk (/src/.../maersk.normalizer.ts)
  - location_code: event.locationCode ?? location.location_code ?? null
    - ou seja, primeiro tenta o código no próprio evento (event.locationCode), senão cai para location.location_code (nível superior)
  - location_display: construção a partir de campos textuais: `[location.city, location.country_code].filter(Boolean).join(', ') || null`
    - exemplo: "PORT SAID EAST, EG"
  - Observação: Maersk normalizer monta um display legível a partir de city + country_code quando não há um campo `Location` textual.

- CMA-CGM (/src/.../cmacgm.normalizer.ts)
  - location_code: move.LocationCode ?? null
  - location_display: move.Location ?? null
    - CMA-CGM expõe `Location` (texto) e `LocationCode` (provavelmente UN/LOCODE em alguns casos). O adapter copia direto.

- MSC (/src/.../msc.normalizer.ts)
  - location_code: event.UnLocationCode ?? null
  - location_display: event.Location ?? null
  - Nota adicional: para ETA (PodEtaDate) o normalizer cria um draft com `location_display` vindo de `bill.GeneralTrackingInfo?.PortOfDischarge` e explicitamente define `location_code = null` (MSC não fornece UN/LOCODE nesse contexto).

Existe fallback padronizado?
- Não existe um serviço/lookup central que resolve display ↔ code. Cada adapter atribui `location_display` e `location_code` a partir dos campos que o provedor entrega (ou constrói `location_display` localmente com city + country_code no caso do Maersk).
- Em alguns pontos downstream há normalizações locais (uppercasing / trim) quando `location_code` é usado para grouping (veja deriveTimeline), mas não há um mecanismo centralizado que, por exemplo, consulta uma base de UN/LOCODE ou normaliza textual `location_display` de forma consistente para todo o sistema.

Conclusão do item 1: os normalizers preenchem consistentemente os mesmos campos, mas as regras de formação do `location_display` e a presença/ausência de `location_code` dependem de cada provider. Não há fallback central para resolver um display a partir de um código ou vice-versa.

---

## 2) Observation model
Arquivo consultado:
- /home/marucs/Development/Castro/container-tracker/src/modules/tracking/domain/observation.ts

Campos relacionados a location (ObservationLocationFields):
- location_code: z.string().nullable()
- location_display: z.string().nullable()

Notas importantes:
- `location_code` é o campo persistido para um identificador (esperado ser UN/LOCODE quando disponível), mas o schema não exige formato nem normalize automaticamente.
- `location_display` é um texto legível e é preservado no Observation (também preservado como parte do raw payload via raw_event).
- O cálculo de fingerprint explicitamente EXCLUI `location_display` (veja /src/.../domain/fingerprint.ts). Ou seja, a identidade semântica usa `location_code` (quando presente) — `location_display` não participa de deduplicação.

---

## 3) Timeline (deriveTimeline)
Arquivo consultado:
- /home/marucs/Development/Castro/container-tracker/src/modules/tracking/domain/deriveTimeline.ts

Respostas:
- Timeline usa `location_code` em preferencial: a função `semanticGroupKey` agrupa por `obs.location_code` (normalizada via `.toUpperCase().trim()`).
- Existe fallback: a função `buildSeriesKey` usa `obs.location_code ?? (obs.location_display ?? '').toUpperCase().trim()` — ou seja, quando `location_code` é null, o código passa a usar `location_display` (após normalização para UPPERCASE e trim) como fallback para agrupar séries.
- Transformações: a normalização aplicada no domínio é básica: `toUpperCase()` e `trim()` ao usar os valores para keys/grouping. Não há parsing adicional (ex.: tentativa de extrair UN/LOCODE de um display) nem lookup central.
- Padronização central: não existe um resolver centralizado; as normalizações são locais nas funções do domínio (upperCase/trim) e repetidas quando necessário (várias funções fazem `toUpperCase()` antes de agrupar).

Conclusão do item 3: O Timeline prefere `location_code` para identidade e agrupamento; quando não há code, usa `location_display` normalizado como fallback. A padronização é local (uppercasing/trim) e não há uma camada única que unifique a transformação ou enriqueça os dados com um mapeamento para UN/LOCODE.

---

## 4) Transshipment (deriveAlerts → deriveTransshipment)
Arquivo consultado:
- /home/marucs/Development/Castro/container-tracker/src/modules/tracking/domain/deriveAlerts.ts

Análise da função `deriveTransshipment` (usada pela derivação de alerts):
- Ela itera sobre `timeline.observations` e considera tipos relevantes ['LOAD','DISCHARGE','ARRIVAL','DEPARTURE'].
- Ela só adiciona ao conjunto `ports` observações que têm `obs.location_code` (i.e., `if (relevantTypes.includes(obs.type) && obs.location_code) { ports.add(obs.location_code.toUpperCase()) }`).

Respostas diretas:
- Ela usa `location_code`? Sim — exclusivamente. Se `location_code` for nulo a observação é ignorada para contagem de portos.
- Ela ignora `location_display`? Sim — `location_display` não é considerada.
- Ela converte para `toUpperCase()`? Sim — `obs.location_code.toUpperCase()` é utilizado antes de adicionar ao conjunto.
- Ela agrupa por código apenas? Sim — o agrupamento e contagem de ports é baseado apenas no `location_code` (uppercased). O resultado `ports` contém códigos normalizados, retornados como `uniquePorts`.

Impacto prático: transshipment detection falhará em detectar trocas de porto quando o carrier não fornece `location_code` (UN/LOCODE) mesmo que haja `location_display` legível diferente entre eventos. Há um trade-off deliberado: fact-based alerts exigem evidência (código confiável) — o sistema é conservador.

---

## 5) Conclusão e recomendação
Perguntas e respostas:

- Hoje existe um único ponto de verdade para nome legível de porto?
  - Resposta: ❌ Inconsistente — Não. `location_display` é gerado por cada adapter a partir dos campos do provider (ou localmente construído, como Maersk). Não existe um serviço central que padronize/normalize/resolve displays a partir de codes (UN/LOCODE) nem que faça lookup para um catálogo único.

- Ou está espalhado?
  - Está espalhado: cada normalizer decide como preencher `location_display` e `location_code`; o domínio aplica apenas normalizações simples (upper/trim) quando precisa agrupar.

- Onde deveria viver um LocationDisplayResolver (domain ou application)?
  - Recomendação: Application layer (src/modules/tracking/application) com infra adapter opcional.
    - Razões:
      - Resolver displays a partir de códigos (ou buscar nome canônico a partir de UN/LOCODE) é uma operação de enriquecimento/integração (dependência externa — lookup tables, caches) e portanto pertence à camada de Application/Infrastructure.
      - O Domain deve permanecer puro: regras de derivação (ex.: timeline, transshipment) devem operar sobre dados normalizados e determinísticos (preferivelmente `location_code`). Domain não deve depender de I/O ou serviços externos.
      - A Application layer pode oferecer uma API internalizada (LocationDisplayResolver) que: aceita { location_code?, location_display? } e retorna { canonical_code?, canonical_display? } aplicando heurísticas, cache e fallback (ex.: query local DB of locations, external UN/LOCODE service). Os adapters (normalizers) podem continuar populando `location_display`/`location_code` brutos; a aplicação enriquece e persiste versões canonical quando desejado.

Recomendações práticas de implementação (passos curtos):
1. Criar `src/modules/tracking/application/locationResolver.ts` que exponha uma função `resolveLocation({location_code, location_display}): { canonical_code?: string | null; canonical_display?: string | null }`.
2. Implementar adapter infra opcional para lookup UN/LOCODE (e.g., local CSV/JSON or external service) dentro de `infrastructure/` e injetá-lo na Application.
3. AtualizarPresentation/Presenter (`tracking.timeline.presenter.ts`) para usar `resolveLocation` quando apresentar informação ao usuário, mantendo fallback `location_display ?? location_code` para compatibilidade.
4. Considerar, se desejado, persistir `canonical_location_code`/`canonical_display` junto às Observations (ou um mapeamento separado) para otimizar consultas/alerts; evitar alterar fingerprint behavior (já depende de location_code, o que é correto).

---

## Referências (paths citados)
- /src/modules/tracking/infrastructure/adapters/maersk.normalizer.ts
- /src/modules/tracking/infrastructure/adapters/msc.normalizer.ts
- /src/modules/tracking/infrastructure/adapters/cmacgm.normalizer.ts
- /src/modules/tracking/domain/observation.ts
- /src/modules/tracking/domain/fingerprint.ts
- /src/modules/tracking/domain/deriveTimeline.ts
- /src/modules/tracking/domain/deriveAlerts.ts
- /src/modules/tracking/application/tracking.timeline.presenter.ts

---

Se quiser, eu posso: 
- abrir um PR com uma proposta inicial de `LocationDisplayResolver` (implementation + tests + small infra adapter with a tiny lookup table),
- ou gerar testes que documentem o comportamento atual (p.ex., um caso em que MSC tem apenas `location_display` e deriveTransshipment perde a transshipment).

Fim do relatório.
