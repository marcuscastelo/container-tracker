# Fase 1 — Base arquitetural e contratos E2E da feature

## Objetivo
Criar a fundação end-to-end da feature de “tracking requer validação”, sem ainda ativar regras reais de detecção em produção.

A fase deve entregar a infraestrutura mínima completa para que as próximas fases só adicionem regras sem precisar refazer contratos, boundaries, tipos, DTOs, ViewModels, UI plumbing ou wiring.

## Escopo
- Criar o conceito canônico no Tracking BC, sem ainda depender de heurísticas reais complexas.
- Definir tipos internos e contratos de projeção/read model para:
  - item granular de validation issue
  - agregação por container
  - agregação por processo
- Expor esses dados no backend que alimenta:
  - shipment/process page
  - dashboard list/summary
- Atualizar HTTP response DTOs e UI mappers
- Criar ViewModels mínimos
- Preparar UI para exibir placeholders/containers semânticos da feature
- Preparar i18n/translation keys
- Garantir que realtime/prefetch/reconciliation não quebrem com os novos campos
- Garantir que a adição dos novos campos não aumente desnecessariamente payload/egress

## Fora de escopo
- Regras reais de detecção de inconsistência
- Alertas críticos reais
- Persistência histórica de transições
- Observabilidade dev
- Regras de severidade complexas
- Time travel específico da feature

## Regras arquiteturais
- Tracking BC é o único dono da derivação de validation issue.
- Capability não define regra semântica.
- UI só consome DTO/ViewModel, nunca deduz validation issue.
- A feature não cria novo status canônico de container.
- A feature não altera observation/snapshot/status truth.
- A feature é um sinal derivado paralelo.

## Modelo conceitual inicial
Criar os conceitos abaixo no Tracking BC:

### Granular
- TrackingValidationIssue
  - code
  - severity: ADVISORY | CRITICAL
  - affectedScope
  - summaryKey
  - evidenceSummary
  - isActive

### Agregado por container
- hasTrackingValidationIssue
- highestTrackingValidationSeverity
- trackingValidationIssueCount
- trackingValidationIssueCodes[]

### Agregado por processo
- hasContainersRequiringValidation
- containersRequiringValidationCount
- highestTrackingValidationSeverity

## Contratos de fronteira
Atualizar:
- read model interno do tracking
- result/usecase que compõe shipment/process
- response DTOs HTTP
- UI mappers
- ViewModels de dashboard e shipment

## UI mínima
Adicionar suportes sem quebrar layout:
- shipment header: espaço para banner agregador
- container summary/header: espaço para badge/chip
- dashboard row: campo/badge para indicar que o processo contém containers com validação necessária

Ainda sem lógica real de exibição forte; pode aparecer apenas quando payload vier preenchido.

## i18n
Adicionar chaves mínimas para:
- validation necessary candidate labels
- process aggregate message
- container-level message
- severity labels internas, se necessário

## Realtime / prefetch / refresh
Garantir que:
- refresh de shipment continue reconciliando normalmente
- dashboard continue server-first
- novos campos façam parte do snapshot canônico vindo do backend
- realtime/local transient state nunca invente validation issue

## Performance / egress
- Não enviar evidence pesado.
- Não enviar arrays detalhados desnecessários para dashboard.
- No dashboard, mandar apenas agregados mínimos.
- Os detalhes por issue devem existir apenas onde necessários.

## Testes
### Unit
- tipos / mappers / projection contracts
- UI mappers DTO -> VM
- agregação vazia/default

### Manual
- shipment carrega sem issue
- dashboard carrega sem issue
- refresh/realtime não quebra
- layout não quebra
- textos i18n resolvem corretamente

## Critério de pronto
- pnpmcheck verde
- sem regressão de payload indevida
- contratos backend/frontend estáveis
- UI pronta para receber a feature nas próximas fases
- nenhum comportamento semântico novo ativado ainda

## Commit esperado
Um commit único e atômico para a base arquitetural da feature.

---

# Prompt de implementação — Fase 1

Implemente a base arquitetural end-to-end da feature de “tracking requer validação” no Container Tracker, sem ainda ativar regras reais de detecção.

Objetivo:
- criar contratos canônicos no Tracking BC
- propagar os novos campos até backend, DTO, UI mapper, ViewModels e UI
- manter boundaries estritos
- não inventar lógica na UI
- não criar novo status canônico
- não tocar em capabilities com regra semântica
- manter dashboard server-first reconciliation
- manter shipment timeline-first

Requisitos obrigatórios:
1. Tracking BC deve passar a expor estruturas para validation issues:
   - granular issue
   - agregado por container
   - agregado por processo
2. HTTP DTOs usados por shipment e dashboard devem incluir apenas os campos mínimos necessários.
3. UI mappers devem converter DTO -> VM explicitamente.
4. Dashboard deve receber apenas agregados mínimos, evitando payload pesado.
5. Shipment page deve ter suporte de UI para banner agregador e indicador por container.
6. Adicionar chaves i18n mínimas para a feature.
7. Garantir que refresh, prefetch e realtime não criem second source of truth.
8. Não adicionar heurísticas reais ainda.
9. Não adicionar persistência histórica ainda.
10. Rodar pnpmcheck e corrigir tudo até ficar verde.

Também:
- revisar payloads para não piorar egress sem necessidade
- revisar ViewModels para não carregar detalhes desnecessários no dashboard
- fazer testes unitários mínimos dos mappers e contratos
- fazer QA manual real no app, sem scripts automatizados de QA
- validar visualmente que a UI continua íntegra

Entregue:
- implementação
- testes unitários
- QA manual
- tudo verde no pnpmcheck
- exatamente 1 commit dessa fase

===

# Fase 2 — UI funcional mínima e naming validado visualmente

## Objetivo
Ativar a feature na UI de forma mínima, com dados mockados/controlados ou derivados por fallback explícito de desenvolvimento, apenas para validar:
- naming curto
- densidade visual
- posicionamento correto
- funil processo -> container -> fonte

Ainda sem regras reais relevantes em produção.

## Escopo
- Implementar exibição real dos campos da Fase 1 quando presentes
- Testar e escolher o melhor label visual para o badge principal
- Consolidar o padrão visual para:
  - dashboard
  - shipment process banner
  - container-level indication
- Garantir que a timeline não seja poluída
- Garantir que o usuário entenda o funil até o container afetado

## Fora de escopo
- Gatilhos reais complexos
- Histórico
- Alertas críticos reais derivados
- Integração com time travel
- Observabilidade dev

## Labels candidatos para teste visual
- Validação necessária
- Atenção necessária
- Rastreamento requer validação
- Rastreamento requer atenção
- Validação pendente

## Decisão de UX esperada
Escolher o label final com base em:
- ausência de quebra/truncamento relevante
- legibilidade em dashboard row
- legibilidade em shipment header
- legibilidade em container-level badge
- consistência visual em desktop e largura menor

## UI behavior
### Dashboard
- Mostrar badge agregador quando processo contém containers com validation issue
- Não exibir detalhes pesados
- Não quebrar sorting/filter atual
- Não criar regra nova de prioridade ainda

### Shipment
- Exibir mensagem agregadora:
  - “Este processo contém containers que requerem validação”
- Exibir indicador por container suspeito
- Manter timeline-first
- Não inserir cards quebrando fluxo cronológico

### Timeline
- Ainda não marcar itens específicos de forma detalhada nesta fase, apenas preparar slot/estrutura se necessário
- Evitar poluição visual prematura

## i18n
- Consolidar label final e textos de apoio
- Garantir fallback correto

## Testes
### Unit
- UI mapper com estados:
  - sem issue
  - com issue advisory
  - com issue critical
- renderização condicional dos badges/mensagens

### Manual
- Usar Playwright apenas para abrir telas, medir/comparar visualmente e registrar o melhor label
- QA manual do LLM sem script automatizado de assert visual
- Validar:
  - dashboard
  - shipment header
  - container selector/header
  - larguras menores

## Critério de pronto
- label final escolhido e fixado
- posicionamento aprovado visualmente
- zero poluição excessiva da timeline
- UI consistente com a arquitetura timeline-first
- pnpmcheck verde

## Commit esperado
Um commit único para ativar a UI mínima funcional e consolidar o naming.

---

# Prompt de implementação — Fase 2

Implemente a camada visual mínima funcional da feature de tracking validation issue usando os contratos da Fase 1.

Objetivo:
- escolher o melhor naming visual curto
- ativar a UI mínima de dashboard e shipment
- validar densidade e legibilidade
- manter o funil processo -> container

Requisitos:
1. Teste visualmente no app os labels candidatos:
   - Validação necessária
   - Atenção necessária
   - Rastreamento requer validação
   - Rastreamento requer atenção
   - Validação pendente
2. Use Playwright para abrir e navegar as telas reais e comparar o comportamento visual, mas faça a decisão final por inspeção manual do LLM, não por script automático de assertions visuais.
3. Escolha o label mais estável sem truncamento/quebra de linha problemática.
4. Ative a exibição no dashboard e shipment.
5. Shipment deve exibir texto agregador apontando que existem containers que requerem validação.
6. Container-level indication deve existir.
7. Não poluir timeline nem inserir cards quebrando a ordem cronológica.
8. Não criar heurística de detecção real ainda.
9. Fazer testes unitários de renderização/mapeamento.
10. Rodar pnpmcheck até ficar verde.

Entregue:
- implementação visual mínima
- label final escolhido e aplicado
- testes unitários
- QA manual documentado no resumo final
- 1 commit atômico

===

# Fase 3 — Detecção real #1: conflitos críticos de ACTUALs

## Objetivo
Implementar o primeiro gatilho canônico real da feature:
- conflitos críticos de ACTUALs que comprometem a leitura confiável da timeline derivada

## Escopo
- Detectar conflitos críticos de ACTUALs no Tracking BC
- Produzir TrackingValidationIssue canônico
- Agregar para container/processo
- Expor na UI
- Opcionalmente elevar para alerta crítico backend-derived, quando aplicável

## Definição
Entram aqui conflitos como:
- múltiplos ACTUALs críticos semanticamente incompatíveis na mesma série
- exemplo clássico: dois ACTUAL DISCHARGE irreconciliáveis
- outros ACTUALs críticos cuja coexistência comprometa a interpretação atual

## Regras
- O sistema nunca apaga fatos conflitantes
- Latest ACTUAL pode continuar primary para timeline, mas a série/container deve ganhar validation issue quando o conflito comprometer confiança
- Não criar lógica na UI
- A decisão nasce no tracking

## Severity
- padrão: CRITICAL

## Outputs
### Container
- hasTrackingValidationIssue = true
- highestTrackingValidationSeverity = CRITICAL
- issue code: CONFLICTING_CRITICAL_ACTUALS

### Processo
- containersRequiringValidationCount atualizado

### UI
- dashboard destaca via mecanismo consistente com severidade crítica
- shipment mostra agregador
- container afetado mostra indicador

## Alertas
Se o sistema atual já suportar semântica coerente de alertas críticos de data/validation para esse caso, integrar.
Se não suportar sem debt excessivo, manter o validation issue e preparar integração posterior.

## Testes
### Unit
- séries com ACTUAL único não geram issue
- séries com ACTUALs conflitantes críticos geram issue
- agregação por container
- agregação por processo

### Manual
- caso real ou fixture próximo do exemplo de dois DISCHARGEs
- validar dashboard, shipment e container-level output
- validar que timeline continua exibindo conflito sem esconder fatos

## Critério de pronto
- conflito crítico real detectado no tracking
- UI mostra o resultado
- sem regressão da timeline
- pnpmcheck verde

## Commit esperado
1 commit atômico para o primeiro gatilho real.

---

# Prompt de implementação — Fase 3

Implemente o primeiro gatilho real da feature: conflitos críticos de ACTUALs.

Objetivo:
- detectar no Tracking BC quando múltiplos ACTUALs críticos tornam a interpretação do tracking insegura
- gerar TrackingValidationIssue canônico
- propagar isso até dashboard e shipment

Requisitos:
1. A lógica deve nascer somente no Tracking BC.
2. Não apagar nem esconder ACTUALs conflitantes.
3. Detectar pelo menos o caso clássico de múltiplos ACTUAL DISCHARGE irreconciliáveis.
4. Gerar issue code `CONFLICTING_CRITICAL_ACTUALS`.
5. Severidade inicial `CRITICAL`.
6. Agregar por container e processo.
7. Expor na UI pelos contratos já criados.
8. Se houver encaixe limpo com alertas backend-derived, integrar sem violar a arquitetura; se não houver, deixe preparado com TODO técnico explícito e sem gambiarra.
9. Criar testes unitários robustos para séries e agregações.
10. Fazer QA manual em casos reais/fixtures.
11. Rodar pnpmcheck até verde.
12. Criar exatamente 1 commit desta fase.

Também revisar:
- payload no dashboard para manter leveza
- i18n de mensagens específicas
- ViewModels para não transportar detalhe excessivo

===

# Fase 4 — Detecção real #2: tracking continuando após encerramento forte

## Objetivo
Detectar o caso em que o processo/container já teve encerramento forte e, depois disso, novos eventos passam a aparecer como continuação espúria do tracking.

## Escopo
- Implementar detecção canônica no tracking ou projeção canônica apropriada
- Cobrir reuso de container após delivered/empty returned
- Marcar o container/processo como requerendo validação
- Expor isso na UI

## Definição de encerramento forte v1
Usar:
- DELIVERED ou EMPTY_RETURNED

## Definição de continuação espúria
Após encerramento forte, surgem novos eventos incompatíveis com continuação normal do mesmo processo, por exemplo:
- novo LOAD
- nova DEPARTURE
- nova ARRIVAL
- novos expecteds de nova jornada
- outros sinais de ciclo logístico reaberto incompatível

## Razão do gatilho
Sem esse sinal, processos já encerrados podem voltar a parecer ativos, gerar ETA e poluir o sistema.

## Severity
- padrão: CRITICAL

## Issue code
- POST_COMPLETION_TRACKING_CONTINUED

## Saída esperada
- Dashboard passa a evidenciar esses processos
- Shipment mostra mensagem agregadora
- Container afetado fica marcado
- Timeline pode continuar exibindo fatos, mas o sistema deixa explícito que a leitura exige validação

## Fora de escopo
- Feature estrutural de corte por data/sync
- Ferramenta manual para truncar tracking
- Reatribuição automática a novo processo/BL

## Testes
### Unit
- encerramento sem eventos posteriores não gera issue
- delivered seguido de novo tracking incompatível gera issue
- empty returned seguido de novo tracking incompatível gera issue

### Manual
- usar casos reais/fixtures de container reutilizado
- validar que processos entregues não parecem “normais” quando o tracking continua

## Critério de pronto
- caso detectado corretamente
- sem corte destrutivo de fatos
- sem workaround de UI
- pnpmcheck verde

## Commit esperado
1 commit atômico.

---

# Prompt de implementação — Fase 4

Implemente o segundo gatilho real da feature: continuação de tracking após encerramento forte do processo/container.

Objetivo:
- detectar casos em que o container foi entregue ou retornado vazio e, depois disso, o sistema começa a receber eventos de um novo tracking incompatível com o processo original
- marcar esse caso como requiring validation

Requisitos:
1. Use como encerramento forte v1: `DELIVERED` ou `EMPTY_RETURNED`.
2. Detecte reabertura incompatível de lifecycle após esse encerramento.
3. Gere issue code `POST_COMPLETION_TRACKING_CONTINUED`.
4. Severidade `CRITICAL`.
5. Não apague fatos históricos.
6. Não implemente ainda a feature futura de corte manual.
7. Propague até dashboard e shipment.
8. Criar testes unitários cobrindo delivered/empty_returned com e sem tracking posterior.
9. Fazer QA manual com fixture/caso real.
10. Rodar pnpmcheck até verde.
11. Criar exatamente 1 commit desta fase.

Também revisar:
- textos de UI para esse caso
- payload leve no dashboard
- se a timeline precisa de micro-indicação de que a continuação é inconsistente, sem poluir a tela

===


# Fase 5 — Severidade dupla real, integração com alertas e destaque consistente no dashboard

## Objetivo
Consolidar a infraestrutura de severidade `ADVISORY | CRITICAL` com comportamento E2E consistente, integrando com o sistema atual de alertas onde fizer sentido e ajustando o dashboard para refletir bem os casos críticos.

## Escopo
- Tornar severidade parte real do fluxo
- Padronizar exibição de ADVISORY vs CRITICAL
- Integrar casos críticos com alerta crítico backend-derived quando o encaixe for limpo
- Ajustar dashboard para refletir criticidade sem inventar nova semântica local

## Escopo detalhado
- Dashboard:
  - casos CRITICAL ganham destaque coerente com alertas críticos
  - casos ADVISORY não precisam de tratamento especial além do badge/estado
- Shipment:
  - mensagem agregadora permanece
  - containers podem mostrar severidade
- Timeline:
  - não virar carnaval visual
  - marcações discretas

## Objetivo técnico
Preparar o sistema para próximas rules advisory sem reabrir contratos.

## Regras
- UI não calcula severidade
- Alert semantics permanecem backend-derived
- Nem todo validation issue precisa virar alert
- Casos críticos iniciais implementados podem virar alert se isso não criar duplicidade confusa

## Testes
### Unit
- mappers e DTOs preservam severidade
- dashboard VM reflete severidade
- alert integration, se implementada

### Manual
- caso advisory mock/controlado
- caso critical real
- inspeção visual no dashboard e shipment

## Critério de pronto
- severidade dupla consolidada
- critical visualmente consistente com alert system
- advisory suportado sem hacks
- pnpmcheck verde

## Commit esperado
1 commit atômico.

---

# Prompt de implementação — Fase 5

Consolide a infraestrutura de severidade `ADVISORY | CRITICAL` da feature de tracking validation issue.

Objetivo:
- tornar a severidade parte real do fluxo E2E
- integrar casos críticos ao comportamento visual/alerta do sistema de forma consistente
- preparar a base para os próximos gatilhos advisory

Requisitos:
1. Severidade deve atravessar tracking -> result -> DTO -> VM -> UI.
2. Dashboard deve diferenciar bem critical dos demais, usando a semântica visual existente de alertas críticos sempre que possível.
3. Advisory deve ser suportado sem hacks, mesmo que ainda haja poucos casos concretos.
4. Não criar regra local de prioridade na UI além daquilo que já é coerente com alertas/estado vindo do backend.
5. Se houver integração com alertas, ela deve ser backend-derived e sem duplicidade semântica confusa.
6. Criar testes unitários de mappers/VMs/render.
7. Fazer QA manual comparando advisory vs critical.
8. Rodar pnpmcheck até verde.
9. Criar exatamente 1 commit desta fase.

===

# Fase 6 — Detecção real #3 (ADVISORY): classificação canônica de timeline/blocos inconsistente

## Objetivo
Detectar inconsistências semânticas na derivação canônica da timeline/blocos operacionais quando a leitura principal ainda existe, mas a classificação ficou insegura.

## Escopo
- Cobrir casos em que a derivação canônica produz classificação operacional improvável/incoerente
- Exemplo orientador:
  - item com evidência forte de contexto marítimo/vessel sendo classificado como post-carriage
- O erro deve existir no read model/backend canônico, não apenas na UI

## Severity
- padrão: ADVISORY
- pode subir para CRITICAL se o caso específico realmente comprometer a leitura principal

## Issue code
- CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT

## Regra de fronteira
Só entra nessa fase se:
- a inconsistência já existir antes da UI
- ou seja, no DTO/read model/backend canônico

Não entra:
- label bug
- layout bug
- posicionamento visual errado puramente na UI

## Estratégia
- Usar critérios objetivos mínimos
- Evitar heurísticas frágeis de NLP livre
- Usar sinais já existentes na derivação canônica, tipos, blocos, contexto de voyage/location/phase

## UI
- Expor como advisory
- sem poluição
- idealmente com mensagem curta de validação necessária

## Testes
### Unit
- caso consistente não gera issue
- caso backend/classificação canônica absurda gera issue
- caso puramente visual não deve depender dessa fase

### Manual
- reproduzir pelo menos um caso real semelhante aos vistos em prints
- confirmar no read model/DTO que o erro existe antes da UI

## Critério de pronto
- advisory real funcionando
- fronteira entre bug canônico e bug visual explicitamente preservada
- pnpmcheck verde

## Commit esperado
1 commit atômico.

---

# Prompt de implementação — Fase 6

Implemente um gatilho advisory para inconsistência na classificação canônica de timeline/blocos operacionais.

Objetivo:
- detectar quando a derivação canônica do tracking produz uma classificação semântica insegura, mesmo que a leitura principal ainda esteja disponível
- exemplo: algo com forte sinal de voyage/navio aparecendo como post-carriage no backend/read model

Requisitos:
1. A lógica deve nascer no backend canônico, nunca na UI.
2. Só gerar issue se o problema já existir no read model/DTO backend.
3. Issue code `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`.
4. Severidade inicial `ADVISORY`, salvo evidência forte de comprometimento maior.
5. Não use heurísticas frágeis demais ou NLP improvisado.
6. Baseie a detecção em sinais semânticos objetivos existentes no pipeline de tracking.
7. Escreva testes unitários.
8. Faça QA manual comprovando que o erro existe antes da UI.
9. Rode pnpmcheck até verde.
10. Crie exatamente 1 commit desta fase.


===

# Fase 7 — Histórico operacional por transição (activated / changed / resolved)

## Objetivo
Persistir o lifecycle operacional das tracking validation issues sem transformar isso em source of truth do domínio e sem armazenar snapshot completo por sync.

## Escopo
- Criar tabela operacional mínima para lifecycle de validation issue
- Registrar transições:
  - activated
  - changed
  - resolved
- Associar contexto mínimo:
  - process
  - container
  - issue code
  - severity
  - hash/resumo dos reasons ativos
  - referência temporal/sync/snapshot quando útil

## Regras
- Não persistir como truth do container/process status
- Não misturar com snapshots/observations
- Persistência é operacional/observabilidade
- Evitar alto volume desnecessário

## Modelo recomendado
Uma linha por transição relevante, não uma linha por sync.

## Uso futuro habilitado
- incidência por provider
- duração média
- issues ativos/resolvidos
- comparação antes/depois de correções

## Fora de escopo
- painel dev
- e-mails
- sentry
- snapshot completo por sync

## Testes
### Unit / integration local
- activated quando issue surge
- changed quando reasons/conjunto muda
- resolved quando issue desaparece
- não duplicar eventos idênticos inutilmente

### Manual
- validar geração das transições em cenários reais das fases anteriores

## Critério de pronto
- lifecycle persistido sem alto ruído
- sem acoplamento indevido ao domínio canônico
- pnpmcheck verde

## Commit esperado
1 commit atômico.

---

# Prompt de implementação — Fase 7

Implemente a persistência operacional do lifecycle de tracking validation issues por transição.

Objetivo:
- registrar `activated`, `changed`, `resolved`
- manter isso fora da source of truth canônica
- preparar observabilidade futura com baixo custo

Requisitos:
1. Criar estrutura operacional mínima para persistência.
2. Persistir somente transições relevantes.
3. Não gravar snapshot completo por sync nesta fase.
4. Armazenar contexto mínimo suficiente para análise futura.
5. Evitar duplicações inúteis.
6. Não misturar isso com observation/snapshot/status truth.
7. Criar testes unitários/integration locais para o lifecycle.
8. Fazer QA manual verificando transições geradas pelos casos das fases anteriores.
9. Rodar pnpmcheck até verde.
10. Criar exatamente 1 commit desta fase.

Também revisar:
- política de retenção futura, sem implementá-la agora se não for necessária
- impacto de storage para continuar leve

===

# Fase 8 — Time travel / sync-aware reconstruction + refinamento de prefetch e payloads

## Objetivo
Garantir que a feature se comporte corretamente ao navegar por syncs/time travel e refinar payloads/prefetch para não piorar egress e performance.

## Escopo
- Integrar a feature ao fluxo existente de time travel/sync navigation
- Garantir reconstrução coerente do estado por sync
- Refinar o que vai para dashboard vs shipment
- Otimizar prefetch e ViewModels para não carregar detalhes onde não precisam

## Estratégia
- Não persistir snapshot completo por sync
- Reconstruir o estado da feature por derivação quando a tela estiver navegando por syncs
- Usar o lifecycle persistido apenas como suporte operacional, não como fonte de renderização principal

## Performance
### Dashboard
- manter payload só com agregados mínimos
### Shipment atual
- detalhes agregados por container
### Time travel sync-specific
- carregar detalhe apenas quando necessário

## Realtime / refresh
- garantir coerência entre visão atual e visão histórica
- evitar glitches ao trocar sync
- preservar server-first behavior

## Testes
### Unit
- mappers/time travel state transitions
- reconstrução por sync em cenários básicos

### Manual
- navegar por syncs e confirmar que a feature acompanha corretamente o estado derivado
- validar que payload do dashboard não inchou
- validar que shipment detalhado só carrega o necessário

## Critério de pronto
- time travel coerente com a feature
- sem snapshot bloat por sync
- payloads refinados
- pnpmcheck verde

## Commit esperado
1 commit atômico.

---

# Prompt de implementação — Fase 8

Integre a feature de tracking validation issue ao fluxo de time travel/sync navigation e refine payloads/performance.

Objetivo:
- garantir comportamento correto ao navegar por syncs
- evitar snapshot bloat
- reduzir risco de aumento de egress
- manter dashboard leve

Requisitos:
1. A feature deve aparecer corretamente quando a UI navegar por syncs/time travel.
2. Preferir reconstrução derivada por sync, não persistência completa por sync.
3. Dashboard deve continuar recebendo apenas agregados mínimos.
4. Shipment/time travel detalhado só deve carregar detalhe quando realmente necessário.
5. Ajustar prefetch/reconciliation se preciso.
6. Não criar second source of truth em realtime/local state.
7. Criar testes unitários relevantes.
8. Fazer QA manual navegando por syncs reais/fixtures.
9. Medir e revisar payloads afetados.
10. Rodar pnpmcheck até verde.
11. Criar exatamente 1 commit desta fase.

===

# Fase 9 — Detecção real #4 e #5 + endurecimento das regras abertas

## Objetivo
Adicionar mais dois gatilhos reais relevantes da V1.1 e endurecer as rules abertas, aproveitando o que já foi visto nos chats/casos reais.

## Escopo
Adicionar até dois novos gatilhos concretos, desde que bem objetivos e sustentados por casos já discutidos.

### Candidatos preferenciais
- UNRECONCILABLE_TRACKING_STATE
- MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT
- EXPECTED_PLAN_NOT_RECONCILABLE

Escolher os dois melhores com base em:
- objetividade
- valor operacional
- baixo risco de falso positivo
- aderência aos casos reais já analisados

## Regras
- nada de heurística vaga
- nada de “parece estranho”
- cada rule precisa de critério objetivo e teste unitário robusto

## Severity
- por gatilho, conforme semântica
- advisory ou critical

## Testes
### Unit
- um conjunto robusto de fixtures por gatilho
### Manual
- validação com casos reais ou muito próximos dos já vistos

## Critério de pronto
- dois novos gatilhos reais
- baixo risco de ruído
- coverage unitária boa
- pnpmcheck verde

## Commit esperado
1 commit atômico.

---

# Prompt de implementação — Fase 9

Implemente mais dois gatilhos reais da feature, escolhendo os dois mais objetivos e úteis entre os candidatos abaixo:

- `UNRECONCILABLE_TRACKING_STATE`
- `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT`
- `EXPECTED_PLAN_NOT_RECONCILABLE`

Objetivo:
- ampliar a cobertura da feature sem cair em heurística vaga
- usar critérios objetivos sustentados pelos casos reais já discutidos

Requisitos:
1. Escolha apenas dois gatilhos nesta fase.
2. Justifique tecnicamente a escolha no resumo final da implementação.
3. Cada gatilho precisa de critério objetivo.
4. Cada gatilho precisa de testes unitários robustos.
5. Propague até UI sem piorar payload desnecessariamente.
6. Faça QA manual com casos reais/fixtures.
7. Rode pnpmcheck até verde.
8. Crie exatamente 1 commit desta fase.

===


# Fase 10 — Polimento final, QA de regressão end-to-end e fechamento da V1/V1.1

## Objetivo
Concluir a feature com polimento, ajustes finais de UX, revisão de payloads, revisão de textos, QA de regressão amplo e fechamento do escopo V1/V1.1 definido nesta conversa.

## Escopo
- Revisar todos os gatilhos implementados
- Revisar mensagens e i18n
- Revisar UI em dashboard, shipment, container, timeline
- Revisar realtime/refresh/prefetch
- Revisar payload/egress
- Revisar tests unitários
- Fazer rodada forte de QA manual
- Eliminar resíduos, flags mortas, contratos obsoletos e pequenos débitos locais introduzidos nas fases anteriores

## Checklist de polimento
- badges consistentes
- textos consistentes
- agregação processo/container clara
- timeline não poluída
- dashboards legíveis
- severidade coerente
- no false highlight óbvio
- payloads mínimos
- ViewModels enxutos
- nenhum rederive na UI

## QA manual obrigatório
Rodar uma bateria manual cobrindo:
- sem issue
- advisory
- critical por conflito de ACTUAL
- critical por tracking pós-conclusão
- gatilhos adicionais da fase 9
- dashboard
- shipment
- navegação por container
- time travel
- refresh/realtime
- responsividade básica

## Critério de pronto
- feature fechada no escopo acordado
- sem regressões graves
- pnpmcheck verde
- pronta para merge após revisão

## Commit esperado
1 commit final de polimento e fechamento.

---

# Prompt de implementação — Fase 10

Faça o fechamento final da feature de tracking validation issue no Container Tracker.

Objetivo:
- polir tudo o que foi implementado nas fases anteriores
- revisar UX, i18n, payloads, ViewModels, QA manual e regressões
- deixar a V1/V1.1 pronta dentro do escopo acordado

Requisitos:
1. Revisar toda a cadeia tracking -> DTO -> VM -> UI.
2. Eliminar resíduos técnicos locais deixados pelas fases anteriores.
3. Revisar textos e i18n.
4. Revisar densidade visual e consistência.
5. Revisar payloads para manter dashboard leve e shipment detalhado apenas quando necessário.
6. Garantir que UI não rederiva semântica.
7. Fazer uma rodada ampla de QA manual cobrindo todos os casos implementados.
8. Garantir pnpmcheck verde.
9. Criar exatamente 1 commit final desta fase.

No resumo final, inclua:
- o que foi ajustado
- o que foi validado manualmente
- qualquer risco residual pequeno que permaneça


===