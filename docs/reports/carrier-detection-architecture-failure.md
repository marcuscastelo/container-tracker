---
title: Falha de arquitetura — Carrier auto-detection em ambiente serverless
date: 2026-03-14
authors: ["Automated report by Copilot"]
---

Resumo
-------
Em ambiente serverless a implementação atual do fluxo de detecção de carrier não é resiliente: o servidor enfileira um probe e aguarda até 180s pelo resultado via polling. Como o processo serverless pode ser finalizado por inatividade antes do polling terminar, a detecção acaba não completando e o fluxo quebra.

Impacto
-------
- Detecções automáticas não concluem (containers permanecem sem carrier detectado).
- Agents processam os pedidos iniciais (por exemplo provider `msc`), falham com "No container found for ..." e marcam os pedidos como FAILED; o servidor espera (poll) por 180s e, se o processo morrer, não faz os retries para outros providers.
- Fluxo observável: agent tentou uma vez, marcou FAILED, e não houve novos probes até lease expirar — portanto nenhuma detecção adicional.

Evidências
---------

1) Logs do agent (trecho relevante):

```
[agent] target 7fe1d551-0ec2-4f61-8572-d6a402d4f363 failed: ingest failed (422): {"error":"No container found for msc:CMAU1945069"}
[agent] target 7fe1d551-0ec2-4f61-8572-d6a402d4f363 will be available again after lease expiration
[agent] cycle processed 4 target(s)
... (repetidos: "no targets available")
```

2) Linhas em `sync_requests` para os containers afetados (extraído do banco):

| id                                   | ref_type  | ref_value   | provider | status | leased_by                            | leased_until | last_error                             | created_at                    |
| ------------------------------------ | --------- | ----------- | -------- | ------ | ------------------------------------ | ------------ | -------------------------------------- | ----------------------------- |
| f7e8106b-18ce-473d-b4df-35eb90802327 | container | APZU3864510 | msc      | FAILED | ef1ffc75-f116-4ad2-9131-7c781085e926 | null         | No container found for msc:APZU3864510 | 2026-03-15 00:32:49.75271+00  |
| 30939969-6b4f-41a4-8690-b86532564916 | container | TCNU5438459 | msc      | FAILED | ef1ffc75-f116-4ad2-9131-7c781085e926 | null         | No container found for msc:TCNU5438459 | 2026-03-15 00:32:49.746108+00 |
| 931ff163-ccdc-4f61-8572-d6a402d4f363 | container | CMAU0224520 | msc      | FAILED | ef1ffc75-f116-4ad2-9131-7c781085e926 | null         | No container found for msc:CMAU0224520 | 2026-03-15 00:32:49.74225+00  |
| 7fe1d551-0ec2-4f61-8572-d6a402d4f363 | container | CMAU1945069 | msc      | FAILED | ef1ffc75-f116-4ad2-9131-7c781085e926 | null         | No container found for msc:CMAU1945069 | 2026-03-15 00:32:49.728434+00 |

Análise técnica (causa raiz)
----------------------------

- Arquitetura atual: server (usecase) enfileira `sync_request` e aguarda por status terminal até 180s (polling). O engine de detecção usa esse mecanismo para provar se um provider encontra o container.
- Em ambiente serverless (funções curtas/short-lived) o processo que iniciou o polling pode ser terminado antes do timeout de 180s, interrompendo o fluxo. Não existe um mecanismo resiliente que garanta continuação do polling após a finalização do processo.
- O agent (worker) é independente e processa os `sync_requests` — ele não invoca automaticamente o servidor para prosseguir com retries; quando marca FAILED, a coordenação que faria o retry depende do processo caller que já morreu.

Riscos
-----

- Perda de detecções em produção ao executar em ambientes serverless.
- Aumento de tickets/triagem manual para containers sem carrier detectado.
- Reprocessamento manual arriscado (pode gerar load desnecessário ao re-enfileirar sem ajustar providers).

Recomendações
---------------

Curto prazo (mitigação rápida):

- Reprocessar manualmente os pedidos falhados (SQL) apenas após confirmar estratégia de provider/ordenamento ou antes de ajustar a arquitetura:

```sql
UPDATE sync_requests
SET status = 'PENDING', leased_by = NULL, leased_until = NULL, last_error = NULL
WHERE id IN (
  'f7e8106b-18ce-473d-b4df-35eb90802327',
  '30939969-6b4f-41a4-8690-b86532564916',
  '931ff163-ccdc-4f61-8572-d6a402d4f363',
  '7fe1d551-0ec2-4f61-8572-d6a402d4f363'
);
```

- Ou chamar o endpoint de sync/detect no servidor para disparar o engine (server-side) se o caller for mantido vivo (apenas em ambiente non-serverless):

```bash
curl -X POST "http://localhost:3000/api/containers/CMAU1945069/sync" -H "Content-Type: application/json"
```

Médio/longo prazo (correção arquitetural recomendada):

1. Implementar callback do agent (menor alteração):
   - Agent invoca POST /internal/sync-callback quando marcar um request DONE/FAILED.
   - Endpoint server-side persiste carrier detectado (via `carrierDetectionWritePort`) e dispara retry sync imediata para provider detectado.
   - Benefício: não depende de serverless long-lived polling; agente notifica imediatamente.

2. Alternativa robusta: mover toda a coordenação/polling para um worker persistente (background detector):
   - Server enfileira probes e retorna; um worker persistente observa `sync_requests` e aplica a lógica de detect/persist.
   - Melhor escalabilidade e observabilidade.

3. Complementar: enfileirar probes para todos providers candidatos (ou mais parallelismo controlado) para reduzir latência de re-tries.

Notas de implementação
---------------------

- Pontos do código relevantes:
  - `src/capabilities/sync/application/usecases/sync-execution.ts` (espera/polling)
  - `src/capabilities/sync/carrier-detection/carrier-detection.engine.ts` (engine de detecção)
  - `src/shared/api/sync.bootstrap/sync.bootstrap.ports.ts` (enqueue via RPC `enqueue_sync_request`)
  - `src/routes/api/processes/[id]/detect-carrier.ts` e `src/capabilities/sync/interface/http/sync.controllers.ts` (rota manual/usecase)
  - Agent runtime (logs mostrados) — local do runtime `/.agent-runtime/releases/.../dist/tools/agent/agent.js` (para alteração do callback)

Plano de ações recomendado
-------------------------
1. Implementar endpoint interno `POST /internal/sync-callback` + wiring para `carrierDetectionWritePort`. (1-2 dias)
2. Atualizar agent runtime para chamar callback após DONE (1 dia; mais se tiver CI/release). 
3. Testar end-to-end em staging e monitorar `sync_requests`/logs. (0.5-1 dia)
4. Refatorar para worker persistente (opcional, esforço maior) como melhoria arquitetural.

Conclusão
---------
O root cause é arquitetural: esperar por 180s em um processo serverless é inseguro. Recomenda-se adotar um fluxo em que a confirmação do resultado venha do agent (callback) ou de um worker persistente, removendo dependência de polling de processos curtos.

— fim do relatório
