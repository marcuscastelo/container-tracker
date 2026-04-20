# Fase 1 — Base arquitetural e contratos E2E da feature

## Objetivo
Criar fundação end-to-end da feature de “tracking requer validação”, sem ainda ativar regras reais de detecção em produção.

fase deve entregar infraestrutura mínima completa para que próximas fases só adicionem regras sem precisar refazer contratos, boundaries, tipos, DTOs, ViewModels, UI plumbing ou wiring.

## Escopo
- Criar conceito canônico no Tracking BC, sem ainda depender de heurísticas reais complexas.
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
- Garantir que realtime/prefetch/reconciliation não quebrem com novos campos
- Garantir que adição dos novos campos não aumente desnecessariamente payload/egress

## Fora de escopo
- Regras reais de detecção de inconsistência
- Alertas críticos reais
- Persistência histórica de transições
- Observabilidade dev
- Regras de severidade complexas
- Time travel específico da feature

## Regras arquiteturais
- Tracking BC é único dono da derivação de validation issue.
- Capability não define regra semântica.
- UI só consome DTO/ViewModel, nunca deduz validation issue.
- feature não cria novo status canônico de container.
- feature não altera observation/snapshot/status truth.
- feature é sinal derivado paralelo.

## Modelo conceitual inicial
Criar conceitos abaixo no Tracking BC:

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
- dashboard row: campo/badge para indicar que processo contém containers com validação necessária

Ainda sem lógica real de exibição forte; pode aparecer quando payload vier preenchido.

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
- No dashboard, mandar agregados mínimos.
- detalhes por issue devem existir onde necessários.

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
- UI pronta para receber feature nas próximas fases
- nenhum comportamento semântico novo ativado ainda

## Commit esperado
commit único e atômico para base arquitetural da feature.

---

# Prompt de implementação — Fase 1

Implemente base arquitetural end-to-end da feature de “tracking requer validação” no Container Tracker, sem ainda ativar regras reais de detecção.

Objetivo:
- criar contratos canônicos no Tracking BC
- propagar novos campos até backend, DTO, UI mapper, ViewModels e UI
- manter boundaries estritos
- não inventar lógica na UI
- não criar novo status canônico
- não tocar em capabilities com regra semântica
- manter dashboard server-first reconciliation
- manter shipment timeline-first

Requisitos obrigatórios:
1. Tracking BC deve passar expor estruturas para validation issues:
   - granular issue
   - agregado por container
   - agregado por processo
2. HTTP DTOs usados por shipment e dashboard devem incluir campos mínimos necessários.
3. UI mappers devem converter DTO -> VM explicitamente.
4. Dashboard deve receber agregados mínimos, evitando payload pesado.
5. Shipment page deve ter suporte de UI para banner agregador e indicador por container.
6. Adicionar chaves i18n mínimas para feature.
7. Garantir que refresh, prefetch e realtime não criem second source of truth.
8. Não adicionar heurísticas reais ainda.
9. Não adicionar persistência histórica ainda.
10. Rodar pnpmcheck e corrigir tudo até ficar verde.

Também:
- revisar payloads para não piorar egress sem necessidade
- revisar ViewModels para não carregar detalhes desnecessários no dashboard
- fazer testes unitários mínimos dos mappers e contratos
- fazer QA manual real no app, sem scripts automatizados de QA
- validar visualmente que UI continua íntegra

Entregue:
- implementação
- testes unitários
- QA manual
- tudo verde no pnpmcheck
- exatamente 1 commit dessa fase

===

# Fase 2 — UI funcional mínima e naming validado visualmente

## Objetivo
Ativar feature na UI de forma mínima, com dados mockados/controlados ou derivados por fallback explícito de desenvolvimento, para validar:
- naming curto
- densidade visual
- posicionamento correto
- funil processo -> container -> fonte

Ainda sem regras reais relevantes em produção.

## Escopo
- Implementar exibição real dos campos da Fase 1 quando presentes
- Testar e escolher melhor label visual para badge principal
- Consolidar padrão visual para:
  - dashboard
  - shipment process banner
  - container-level indication
- Garantir que timeline não seja poluída
- Garantir que usuário entenda funil até container afetado

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
Escolher label final com base em:
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
- Ainda não marcar itens específicos de forma detalhada nesta fase, preparar slot/estrutura se necessário
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
- Usar Playwright para abrir telas, medir/comparar visualmente e registrar melhor label
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
- UI consistente com arquitetura timeline-first
- pnpmcheck verde

## Commit esperado
commit único para ativar UI mínima funcional e consolidar naming.

---

# Prompt de implementação — Fase 2

Implemente camada visual mínima funcional da feature de tracking validation issue usando contratos da Fase 1.

Objetivo:
- escolher melhor naming visual curto
- ativar UI mínima de dashboard e shipment
- validar densidade e legibilidade
- manter funil processo -> container

Requisitos:
1. Teste visualmente no app labels candidatos:
   - Validação necessária
   - Atenção necessária
   - Rastreamento requer validação
   - Rastreamento requer atenção
   - Validação pendente
2. Use Playwright para abrir e navegar telas reais e comparar comportamento visual, mas faça decisão final por inspeção manual do LLM, não por script automático de assertions visuais.
3. Escolha label mais estável sem truncamento/quebra de linha problemática.
4. Ative exibição no dashboard e shipment.
5. Shipment deve exibir texto agregador apontando que existem containers que requerem validação.
6. Container-level indication deve existir.
7. Não poluir timeline nem inserir cards quebrando ordem cronológica.
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
Implementar primeiro gatilho canônico real da feature:
- conflitos críticos de ACTUALs que comprometem leitura confiável da timeline derivada

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
- outros ACTUALs críticos cuja coexistência comprometa interpretação atual

## Regras
- sistema nunca apaga fatos conflitantes
- Latest ACTUAL pode continuar primary para timeline, mas série/container deve ganhar validation issue quando conflito comprometer confiança
- Não criar lógica na UI
- decisão nasce no tracking

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
Se sistema atual já suportar semântica coerente de alertas críticos de data/validation para esse caso, integrar.
Se não suportar sem debt excessivo, manter validation issue e preparar integração posterior.

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
- UI mostra resultado
- sem regressão da timeline
- pnpmcheck verde

## Commit esperado
1 commit atômico para primeiro gatilho real.

---

# Prompt de implementação — Fase 3

Implemente primeiro gatilho real da feature: conflitos críticos de ACTUALs.

Objetivo:
- detectar no Tracking BC quando múltiplos ACTUALs críticos tornam interpretação do tracking insegura
- gerar TrackingValidationIssue canônico
- propagar isso até dashboard e shipment

Requisitos:
1. lógica deve nascer somente no Tracking BC.
2. Não apagar nem esconder ACTUALs conflitantes.
3. Detectar pelo menos caso clássico de múltiplos ACTUAL DISCHARGE irreconciliáveis.
4. Gerar issue code `CONFLICTING_CRITICAL_ACTUALS`.
5. Severidade inicial `CRITICAL`.
6. Agregar por container e processo.
7. Expor na UI pelos contratos já criados.
8. Se houver encaixe limpo com alertas backend-derived, integrar sem violar arquitetura; se não houver, deixe preparado com TODO técnico explícito e sem gambiarra.
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
Detectar caso em que processo/container já teve encerramento forte e, depois disso, novos eventos passam aparecer como continuação espúria do tracking.

## Escopo
- Implementar detecção canônica no tracking ou projeção canônica apropriada
- Cobrir reuso de container após delivered/empty returned
- Marcar container/processo como requerendo validação
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
Sem esse sinal, processos já encerrados podem voltar parecer ativos, gerar ETA e poluir sistema.

## Severity
- padrão: CRITICAL

## Issue code
- POST_COMPLETION_TRACKING_CONTINUED

## Saída esperada
- Dashboard passa evidenciar esses processos
- Shipment mostra mensagem agregadora
- Container afetado fica marcado
- Timeline pode continuar exibindo fatos, mas sistema deixa explícito que leitura exige validação

## Fora de escopo
- Feature estrutural de corte por data/sync
- Ferramenta manual para truncar tracking
- Reatribuição automática novo processo/BL

## Testes
### Unit
- encerramento sem eventos posteriores não gera issue
- delivered seguido de novo tracking incompatível gera issue
- empty returned seguido de novo tracking incompatível gera issue

### Manual
- usar casos reais/fixtures de container reutilizado
- validar que processos entregues não parecem “normais” quando tracking continua

## Critério de pronto
- caso detectado corretamente
- sem corte destrutivo de fatos
- sem workaround de UI
- pnpmcheck verde

## Commit esperado
1 commit atômico.

---

# Prompt de implementação — Fase 4

Implemente segundo gatilho real da feature: continuação de tracking após encerramento forte do processo/container.

Objetivo:
- detectar casos em que container foi entregue ou retornado vazio e, depois disso, sistema começa receber eventos de novo tracking incompatível com processo original
- marcar esse caso como requiring validation

Requisitos:
1. Use como encerramento forte v1: `DELIVERED` ou `EMPTY_RETURNED`.
2. Detecte reabertura incompatível de lifecycle após esse encerramento.
3. Gere issue code `POST_COMPLETION_TRACKING_CONTINUED`.
4. Severidade `CRITICAL`.
5. Não apague fatos históricos.
6. Não implemente ainda feature futura de corte manual.
7. Propague até dashboard e shipment.
8. Criar testes unitários cobrindo delivered/empty_returned com e sem tracking posterior.
9. Fazer QA manual com fixture/caso real.
10. Rodar pnpmcheck até verde.
11. Criar exatamente 1 commit desta fase.

Também revisar:
- textos de UI para esse caso
- payload leve no dashboard
- se timeline precisa de micro-indicação de que continuação é inconsistente, sem poluir tela

===


# Fase 5 — Severidade dupla real, integração com alertas e destaque consistente no dashboard

## Objetivo
Consolidar infraestrutura de severidade `ADVISORY|CRITICAL` com comportamento E2E consistente, integrando com sistema atual de alertas onde fizer sentido e ajustando dashboard para refletir bem casos críticos.

## Escopo
- Tornar severidade parte real do fluxo
- Padronizar exibição de ADVISORY vs CRITICAL
- Integrar casos críticos com alerta crítico backend-derived quando encaixe for limpo
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
Preparar sistema para próximas rules advisory sem reabrir contratos.

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

Consolide infraestrutura de severidade `ADVISORY|CRITICAL` da feature de tracking validation issue.

Objetivo:
- tornar severidade parte real do fluxo E2E
- integrar casos críticos ao comportamento visual/alerta do sistema de forma consistente
- preparar base para próximos gatilhos advisory

Requisitos:
1. Severidade deve atravessar tracking -> result -> DTO -> VM -> UI.
2. Dashboard deve diferenciar bem critical dos demais, usando semântica visual existente de alertas críticos sempre que possível.
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
Detectar inconsistências semânticas na derivação canônica da timeline/blocos operacionais quando leitura principal ainda existe, mas classificação ficou insegura.

## Escopo
- Cobrir casos em que derivação canônica produz classificação operacional improvável/incoerente
- Exemplo orientador:
  - item com evidência forte de contexto marítimo/vessel sendo classificado como post-carriage
- erro deve existir no read model/backend canônico, não na UI

## Severity
- padrão: ADVISORY
- pode subir para CRITICAL se caso específico realmente comprometer leitura principal

## Issue code
- CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT

## Regra de fronteira
Só entra nessa fase se:
- inconsistência já existir antes da UI
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
- reproduzir pelo menos caso real semelhante aos vistos em prints
- confirmar no read model/DTO que erro existe antes da UI

## Critério de pronto
- advisory real funcionando
- fronteira entre bug canônico e bug visual explicitamente preservada
- pnpmcheck verde

## Commit esperado
1 commit atômico.

---

# Prompt de implementação — Fase 6

Implemente gatilho advisory para inconsistência na classificação canônica de timeline/blocos operacionais.

Objetivo:
- detectar quando derivação canônica do tracking produz classificação semântica insegura, mesmo que leitura principal ainda esteja disponível
- exemplo: algo com forte sinal de voyage/navio aparecendo como post-carriage no backend/read model

Requisitos:
1. lógica deve nascer no backend canônico, nunca na UI.
2. Só gerar issue se problema já existir no read model/DTO backend.
3. Issue code `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`.
4. Severidade inicial `ADVISORY`, salvo evidência forte de comprometimento maior.
5. Não use heurísticas frágeis demais ou NLP improvisado.
6. Baseie detecção em sinais semânticos objetivos existentes no pipeline de tracking.
7. Escreva testes unitários.
8. Faça QA manual comprovando que erro existe antes da UI.
9. Rode pnpmcheck até verde.
10. Crie exatamente 1 commit desta fase.


===

# Fase 7 — Histórico operacional por transição (activated / changed / resolved)

## Objetivo
Persistir lifecycle operacional das tracking validation issues sem transformar isso em source of truth do domínio e sem armazenar snapshot completo por sync.

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
linha por transição relevante, não linha por sync.

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

Implemente persistência operacional do lifecycle de tracking validation issues por transição.

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
7. Criar testes unitários/integration locais para lifecycle.
8. Fazer QA manual verificando transições geradas pelos casos das fases anteriores.
9. Rodar pnpmcheck até verde.
10. Criar exatamente 1 commit desta fase.

Também revisar:
- política de retenção futura, sem implementá-la agora se não for necessária
- impacto de storage para continuar leve

===

# Fase 8 — Time travel / sync-aware reconstruction + refinamento de prefetch e payloads

## Objetivo
Garantir que feature se comporte corretamente ao navegar por syncs/time travel e refinar payloads/prefetch para não piorar egress e performance.

## Escopo
- Integrar feature ao fluxo existente de time travel/sync navigation
- Garantir reconstrução coerente do estado por sync
- Refinar que vai para dashboard vs shipment
- Otimizar prefetch e ViewModels para não carregar detalhes onde não precisam

## Estratégia
- Não persistir snapshot completo por sync
- Reconstruir estado da feature por derivação quando tela estiver navegando por syncs
- Usar lifecycle persistido como suporte operacional, não como fonte de renderização principal

## Performance
### Dashboard
- manter payload só com agregados mínimos
### Shipment atual
- detalhes agregados por container
### Time travel sync-specific
- carregar detalhe quando necessário

## Realtime / refresh
- garantir coerência entre visão atual e visão histórica
- evitar glitches ao trocar sync
- preservar server-first behavior

## Testes
### Unit
- mappers/time travel state transitions
- reconstrução por sync em cenários básicos

### Manual
- navegar por syncs e confirmar que feature acompanha corretamente estado derivado
- validar que payload do dashboard não inchou
- validar que shipment detalhado só carrega necessário

## Critério de pronto
- time travel coerente com feature
- sem snapshot bloat por sync
- payloads refinados
- pnpmcheck verde

## Commit esperado
1 commit atômico.

---

# Prompt de implementação — Fase 8

Integre feature de tracking validation issue ao fluxo de time travel/sync navigation e refine payloads/performance.

Objetivo:
- garantir comportamento correto ao navegar por syncs
- evitar snapshot bloat
- reduzir risco de aumento de egress
- manter dashboard leve

Requisitos:
1. feature deve aparecer corretamente quando UI navegar por syncs/time travel.
2. Preferir reconstrução derivada por sync, não persistência completa por sync.
3. Dashboard deve continuar recebendo agregados mínimos.
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
Adicionar mais dois gatilhos reais relevantes da V1.1 e endurecer rules abertas, aproveitando que já foi visto nos chats/casos reais.

## Escopo
Adicionar até dois novos gatilhos concretos, desde que bem objetivos e sustentados por casos já discutidos.

### Candidatos preferenciais
- UNRECONCILABLE_TRACKING_STATE
- MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT
- EXPECTED_PLAN_NOT_RECONCILABLE

Escolher dois melhores com base em:
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
- conjunto robusto de fixtures por gatilho
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

Implemente mais dois gatilhos reais da feature, escolhendo dois mais objetivos e úteis entre candidatos abaixo:

- `UNRECONCILABLE_TRACKING_STATE`
- `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT`
- `EXPECTED_PLAN_NOT_RECONCILABLE`

Objetivo:
- ampliar cobertura da feature sem cair em heurística vaga
- usar critérios objetivos sustentados pelos casos reais já discutidos

Requisitos:
1. Escolha dois gatilhos nesta fase.
2. Justifique tecnicamente escolha no resumo final da implementação.
3. Cada gatilho precisa de critério objetivo.
4. Cada gatilho precisa de testes unitários robustos.
5. Propague até UI sem piorar payload desnecessariamente.
6. Faça QA manual com casos reais/fixtures.
7. Rode pnpmcheck até verde.
8. Crie exatamente 1 commit desta fase.

===


# Fase 10 — Polimento final, QA de regressão end-to-end e fechamento da V1/V1.1

## Objetivo
Concluir feature com polimento, ajustes finais de UX, revisão de payloads, revisão de textos, QA de regressão amplo e fechamento do escopo V1/V1.1 definido nesta conversa.

## Escopo
- Revisar todos gatilhos implementados
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
Rodar bateria manual cobrindo:
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

Faça fechamento final da feature de tracking validation issue no Container Tracker.

Objetivo:
- polir tudo que foi implementado nas fases anteriores
- revisar UX, i18n, payloads, ViewModels, QA manual e regressões
- deixar V1/V1.1 pronta dentro do escopo acordado

Requisitos:
1. Revisar toda cadeia tracking -> DTO -> VM -> UI.
2. Eliminar resíduos técnicos locais deixados pelas fases anteriores.
3. Revisar textos e i18n.
4. Revisar densidade visual e consistência.
5. Revisar payloads para manter dashboard leve e shipment detalhado quando necessário.
6. Garantir que UI não rederiva semântica.
7. Fazer rodada ampla de QA manual cobrindo todos casos implementados.
8. Garantir pnpmcheck verde.
9. Criar exatamente 1 commit final desta fase.

No resumo final, inclua:
- que foi ajustado
- que foi validado manualmente
- qualquer risco residual pequeno que permaneça


===