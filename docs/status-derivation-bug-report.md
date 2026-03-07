Relatório: Bug de status incorreto — "Descarregado" apesar de reembarque/partida

Resumo rápido

- Sintoma: Container mostra status "DISCHARGED" apesar da timeline conter eventos posteriores: LOAD seguido por DEPARTURE (ou seja, reembarque e partida).
- Impacto: UI/Read-model exibe um status operacional regressivo; deveria refletir o evento operacional mais recente (DEPARTURE → IN_TRANSIT).

1) Onde o status é calculado

- Arquivo: src/modules/tracking/domain/derive/deriveStatus.ts
- Função: export function deriveStatus(timeline: Timeline): ContainerStatus

2) Causa-raiz (root cause)

- A implementação atual usa uma lógica de "dominance-first" combinada com uma heurística de `finalLocation` que caminha o timeline de trás para frente e identifica o último evento do tipo DISCHARGE/ARRIVAL/DELIVERY como o destino final.
- Em seguida a função aplica checks booleanos como `hasActualDischargeAtFinal()` que retornam true se existir qualquer ACTUAL DISCHARGE naquele finalLocation, e essa checagem ocorre antes de verificar DEPARTURE/LOAD.
- Como consequência, mesmo quando há eventos ACTUAL posteriores do tipo LOAD ou DEPARTURE (em timestamp posterior), o algoritmo pode ainda retornar DISCHARGED porque encontrou um DISCHARGE no "finalLocation" e aplica precedência por tipo em vez de usar a sequência temporal.

Porque isso falha para o caso reportado

- Exemplo: timeline ordenada (ascendente):
  2026-02-13 DISCHARGE (ACTUAL) – SINE A
  2026-02-22 LOAD (ACTUAL) – MAERSK PANGANI
  2026-02-23 DEPARTURE (ACTUAL) – MAERSK PANGANI

- A função `deriveStatus` calcula `finalLocation` percorrendo do fim e encontra o DISCHARGE anterior (porque LOAD/DEPARTURE não estão no conjunto {DISCHARGE, ARRIVAL, DELIVERY}), marca `hasActualDischargeAtFinal()` === true e retorna 'DISCHARGED' antes de ver que há um DEPARTURE posterior. Resultado: status incorreto.

3) Regra correta (recomendada)

- A seleção de status deve priorizar o evento ACTUAL mais recente (latest ACTUAL) sobre qualquer ordem de dominância global.
- Em outras palavras: compute primary = última observação com event_time_type === 'ACTUAL' (usando a ordenação do timeline — deriveTimeline já produz observações ordenadas ascendentemente). O status deve ser mapeado a partir do tipo desse primary.
- Exceções possíveis (política a confirmar com produto): EMPTY_RETURN e DELIVERY permaneceriam sujeitos à mesma regra de "último ACTUAL" (i.e., prevalecem somente se forem os ACTUALs mais recentes). Se for desejado manter uma precedência especial de EMPTY_RETURN independentemente da ordem, isso deve ser uma regra explícita e documentada.

Pseudo-código da regra correta

```
actuals = timeline.observations.filter(o => o.event_time_type === 'ACTUAL')
if (actuals.length > 0) {
  last = actuals[actuals.length - 1] // timeline é ascendente
  status = OBSERVATION_TO_STATUS[last.type] ?? 'IN_PROGRESS'
  return status
}
if (timeline.observations.length > 0) return 'IN_PROGRESS'
return 'UNKNOWN'
```

4) Patch sugerido (tipo: sugestão, NÃO APLICAR automaticamente)

Alterar `src/modules/tracking/domain/derive/deriveStatus.ts` para substituir a lógica dominante pela lógica "último ACTUAL primeiro". Abaixo está uma sugestão completa da função substituta (mantém a const de mapeamento existente):

```typescript
export function deriveStatus(timeline: Timeline): ContainerStatus {
  // Observations are already reconciled/chronologically ordered by deriveTimeline
  const actuals = timeline.observations.filter((o) => o.event_time_type === 'ACTUAL')

  if (actuals.length > 0) {
    const last = actuals[actuals.length - 1]
    const mapped = OBSERVATION_TO_STATUS[last.type as ObservationType]
    if (mapped) return mapped

    // If the last ACTUAL is an unrecognized operational type, treat as IN_PROGRESS
    return 'IN_PROGRESS'
  }

  // No ACTUAL — fall back to presence of any observations
  if (timeline.observations.length > 0) return 'IN_PROGRESS'

  return 'UNKNOWN'
}
```

Notas adicionais sobre o patch sugerido

- Usa a ordenação já fornecida por `deriveTimeline` (event_time asc, ACTUAL before EXPECTED for equal times). Assim, o último ACTUAL corresponde ao evento operacional mais recente.
- Remove a inferência de `finalLocation` e a checagem global `hasActualDischargeAtFinal()` que causavam a regressão de estado.
- Mantém comportamento simples e previsível: status = mapeamento do último ACTUAL; caso não mapeado, fallback para 'IN_PROGRESS'.

5) Efeitos colaterais e pontos de atenção

- Transshipment: o novo comportamento trata ciclos de transshipment corretamente — após DISCHARGE → LOAD → DEPARTURE, o último ACTUAL será DEPARTURE e o status será IN_TRANSIT (correto). Para o caso LOAD → DISCHARGE → LOAD → DISCHARGE, o último ACTUAL é DISCHARGE, logo status = DISCHARGED (também correto).
- EMPTY_RETURN / DELIVERY: se existirem EMPTY_RETURN ou DELIVERY posteriores, como ACTUAL, serão escolhidos como último ACTUAL e prevalecerão. Se o time de produto exigir que EMPTY_RETURN tenha precedência independentemente de ordem, precisamos de uma regra expressa e testar as implicações.
- Multi-vessel: a lógica proposta não tenta inferir "final location" nem fazer checagens por location/vessel; assume que events posteriores representam avanço operacional.
- Read-models que dependam da antiga precedência (por exemplo, alguma micro-otimização que espera DISCHARGED caso exista um DISCHARGE no finalLocation) deverão ser validadas.

6) Testes a adicionar / ajustar

- Caso reproduzir: criar teste com sequência DISCHARGE(13) → LOAD(22) → DEPARTURE(23) (todos ACTUAL) e afirmar deriveStatus === 'IN_TRANSIT'.
- Garantir que testes existentes de transshipment (LOAD → DISCHARGE → LOAD → DISCHARGE) continuem passando (deveriam, pois último ACTUAL é DISCHARGE).
- Cobrir caso com EMPTY_RETURN anterior + LOAD posterior — confirmar comportamento desejado.

7) Passos recomendados para correção

1. Adicionar novo teste unitário reproduzindo o caso real (DISCHARGE → LOAD → DEPARTURE → espera IN_TRANSIT).
2. Aplicar a mudança em `deriveStatus` conforme patch sugerido.
3. Executar suíte de testes e validar integrações de read-models (especialmente `deriveTimelineWithSeriesReadModel` e projeções que consomem deriveStatus).
4. Revisar alertas/monitoring que dependam do status (por exemplo, alertas retroativas) para garantir que semântica não seja alterada indesejadamente.

Conclusão (resumida)

- Root cause: `deriveStatus` aplica regras de precedência/dominância e `finalLocation` em vez de consumir o ACTUAL mais recente; isso deixa o status preso em DISCHARGED mesmo quando há ACTUAL LOAD/DEPARTURE posteriores.
- Arquivo/função exatos: `src/modules/tracking/domain/derive/deriveStatus.ts` → `deriveStatus`.
- Correção: mudar para lógica baseada no último ACTUAL (pseudocódigo e patch sugerido acima).

Arquivo com esta análise gravado em: docs/status-derivation-bug-report.md

Se desejar, aplico o patch proposto e adiciono o teste de regressão automaticamente (posso abrir um branch e criar o commit).