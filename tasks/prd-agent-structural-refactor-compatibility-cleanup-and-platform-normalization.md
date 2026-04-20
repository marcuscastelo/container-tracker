# PRD — Agent Structural Refactor: Compatibility Cleanup and Platform Normalization

- Status: Ready for implementation
- Escopo-alvo: `apps/agent/src/**`
- Contexto imediato: continuação estrutural do PR #322
- Tipo: refactor estrutural sem mudança intencional de contrato externo
- Prioridade: P0
- Dono: Agent platform
- Natureza: redução de dívida estrutural + congelamento de ownership real

---

## 1. O que será feito

Este trabalho implementará um refactor estrutural focado em:

1. remover compat layers internos redundantes
2. consolidar entrypoints canônicos do agent
3. unificar o layout de paths/arquivos do agent entre Linux e Windows
4. isolar diferenças de controle por OS em estratégias menores
5. centralizar parsing, validação e serialização de configuração em `config/*`
6. reforçar `state/*` como owner exclusivo da persistência de estado local
7. reduzir drift entre Linux e Windows sem reescrever o sistema inteiro
8. preservar o comportamento operacional atual do agent

## 2. Problema

O refactor do agent avançou, mas o shape atual ainda carrega bagunça estrutural importante:

- wrappers internos ainda duplicam entrypoints e composition roots
- diferenças Windows/Linux continuam vazando para fluxos que deveriam ser canônicos
- parsing/serialização/configuração ainda tem múltiplos owners implícitos
- layout de arquivos e paths do agent ainda está parcialmente duplicado
- controle local mistura:
  - concern de OS
  - concern de installed vs dev
  - concern de service/task/process
- persistência de estado ainda corre risco de continuar espalhando writes fora de `state/*`

Resultado operacional atual:

- manutenção lenta
- drift silencioso entre modos de execução
- maior chance de regressão em release/control/runtime
- dificuldade de saber qual camada é dona de cada decisão

## 3. Objetivo do produto

Tornar o agent estruturalmente compreensível e previsível sem mudar seu contrato externo.

Ao final deste trabalho, o time deve conseguir responder com clareza:

- qual é o entrypoint canônico de cada executável
- onde termina compatibilidade externa e começa código real
- onde ficam as diferenças Linux/Windows
- quem decide layout de arquivos
- quem decide parse/serialize/validate de config
- quem pode escrever estado local
- quais módulos são orquestradores e quais são apenas infra

## 4. Resultado esperado

Ao final da implementação:

- haverá apenas um conjunto canônico de entrypoints reais
- wrappers remanescentes existirão apenas por exigência externa de packaging/CLI/runtime
- Linux e Windows compartilharão o mesmo layout lógico do agent
- diferenças de OS ficarão restritas à camada `platform/*`
- `local-control.adapter.ts` deixará de concentrar múltiplas responsabilidades
- parsing/serialização de config deixará de ser replicado
- state file IO ficará explicitamente centralizado em `state/*`
- o refactor continuará sem alterar API/backend/UI contracts

## 5. Decisões fechadas

### 5.1 Raiz canônica

A raiz canônica do agent é:

```text
apps/agent
```

`tools/agent` e equivalentes legados não são mais source of truth de arquitetura.

### 5.2 Compat layer interna

Compat layer dentro de `src/` só pode existir quando houver necessidade externa real, como:

- packaging
- launcher legado
- executável esperado por script externo
- bootstrap de distribuição

Compat layer não pode existir apenas para “facilitar transição” entre arquivos internos.

### 5.3 Entry points

Cada executável terá:

- 1 entrypoint canônico real
- 0 ou mais wrappers finos estritamente externos

Regra:

- wrapper chama `main()`
- wrapper não contém regra operacional
- wrapper não resolve paths manualmente
- wrapper não parseia config
- wrapper não conhece OS differences

### 5.4 Ownership de diferenças Linux/Windows

Diferenças de OS ficam exclusivamente em:

```text
apps/agent/src/platform/*
```

Nenhuma outra camada pode implementar branching estrutural de OS, exceto composição muito fina para selecionar o adapter.

### 5.5 Ownership de config

Tudo que for:

- parse
- validate
- normalize
- serialize
- placeholder policy
- resolução de config efetiva

fica em:

```text
apps/agent/src/config/*
```

### 5.6 Ownership de estado local

Tudo que for escrita persistente de arquivos de estado local fica em:

```text
apps/agent/src/state/*
```

Fora de `state/*`, é proibido escrever diretamente arquivos de estado canônicos do agent.

### 5.7 Layout canônico

O layout lógico do agent é único.

Linux e Windows podem divergir apenas na forma de:

- resolver `dataDir`
- juntar paths
- linkar current/previous
- extrair bundle
- controlar processo/serviço/tarefa

Os nomes lógicos de arquivos e diretórios devem ser os mesmos.

### 5.8 Escopo deste trabalho

Este trabalho **não** vai reescrever o release system inteiro.

Também **não** vai desmontar completamente `runtime.entry.ts`/orquestradores grandes, exceto onde isso for necessário para cumprir as decisões acima.

### 5.9 Sem mudança de contrato externo

Este refactor não muda intencionalmente:

- protocolos backend
- contratos UI
- formato público esperado pelos installers
- semântica operacional de release/update/control

Mudanças de comportamento só são aceitas se forem correção de bug estrutural inequívoca.

## 6. Escopo

### 6.1 Em escopo

#### A. Consolidar entrypoints
- revisar todos os entrypoints atuais
- remover duplicações internas evidentes
- padronizar padrão `wrapper -> main()`
- renomear arquivos ambíguos quando necessário

#### B. Criar layout canônico compartilhado
- extrair um builder canônico de layout de paths
- fazer Linux e Windows consumirem o mesmo layout lógico
- deixar cada OS responsável apenas por suas diferenças reais

#### C. Quebrar `local-control.adapter.ts`
- separar em estratégias menores por modo operacional
- remover mistura entre:
  - Linux service control
  - Linux dev process control
  - Windows task control

#### D. Centralizar config
- extrair parser/serializer/validator único
- remover duplicação em runtime/CLI/control-core
- formalizar policy de placeholders inválidos

#### E. Reforçar ownership de state
- garantir que state file IO canônico passe por `state/*`
- eliminar writes ad hoc de estado canônico fora do boundary

#### F. Limpeza de compat layer inútil
- remover wrappers internos que apenas espelham outros arquivos
- manter apenas wrappers necessários para runtime externo

#### G. Guardrails
- adicionar/ajustar testes e checks de boundary
- garantir que novos drift points não reapareçam

### 6.2 Fora de escopo

- reescrever todo o release state machine
- reescrever todo o supervisor loop
- remodelar provider execution
- alterar protocolos backend do agent
- redesign da UI de controle
- mudança de semântica de auto-update
- abstração genérica “bonita” mas desnecessária para OS beyond current needs

## 7. Arquitetura alvo

### 7.1 Árvore lógica-alvo

```text
apps/agent/src/
  app/
  core/
  config/
  release/
  runtime/
  sync/
  providers/
  state/
  observability/
  platform/
```

### 7.2 Regras arquiteturais

#### app/*
- composition root
- entrypoints finos
- chama `main()`
- não decide semântica operacional

#### config/*
- parse/validate/serialize de configuração
- resolve config efetiva
- resolve placeholder policy
- não executa controle de processo

#### platform/*
- único owner de OS differences
- paths
- process/service/task control
- extraction strategy
- link strategy

#### state/*
- único owner de leitura/escrita de state files canônicos
- atomic write policy
- parse/serialize de state files

#### runtime/release/sync/observability/*
- consomem `config/*`, `platform/*`, `state/*`
- não reimplementam essas decisões

## 8. Design alvo detalhado

### 8.1 Entry points canônicos

#### Requisito
Todo executável deve expor uma `main()` canônica.

#### Regra
Arquivos de bootstrap devem ser apenas adaptadores finos para `main()`.

#### Decisão
Arquivos redundantes que apenas importam outro entrypoint sem agregar boundary real devem ser removidos ou convertidos em wrappers oficialmente justificados.

#### Critério
Se dois arquivos fazem apenas:

```ts
import 'x'
```

ou

```ts
import { runXMain } from 'y'
void runXMain()
```

eles não coexistem como “código real”.
Um deles vira wrapper externo documentado; o outro vira entrypoint real.

### 8.2 Layout canônico de paths

#### Requisito
Haverá um layout lógico único do agent.

#### Shape canônico
Exemplo de layout lógico:

```text
dataDir/
  releases/
  current
  previous
  logs/
  downloads/
  run/
  config.env
  bootstrap.env
  release-state.json
  runtime-state.json
  supervisor-control.json
  pending-activity-events.json
  control-overrides.local.json
  control-remote-cache.json
  infra-config.json
  agent-control-audit.ndjson
  agent-log-forwarder-state.json
```

#### Decisão
A camada compartilhada define:
- nomes lógicos
- estrutura
- fields do layout

O adapter de OS define:
- como resolver `dataDir`
- qual join/path impl usar
- qual tipo de link criar
- como interpretar pointer/symlink

### 8.3 Platform control por estratégia

#### Requisito
Controle local não pode continuar concentrando tudo num único arquivo grande.

#### Estratégias obrigatórias
- `linux-service-control`
- `linux-dev-process-control`
- `windows-task-control`

#### Regra
Cada estratégia implementa a mesma interface operacional.

#### Regra adicional
A escolha entre installed/dev/process/task/service deve acontecer por composição, não por acúmulo de `if` no mesmo arquivo principal.

### 8.4 Config centralizada

#### Requisito
Parse/validate/serialize de config deve ter um owner único.

#### Decisão
Criar um núcleo canônico que ofereça APIs explícitas, por exemplo:

```ts
parseAgentEnv(text)
serializeAgentEnv(config)
validateAgentConfig(config)
validateBootstrapPlaceholders(config)
resolveEffectiveAgentConfig(...)
```

#### Regra
Runtime, CLI, control-core e qualquer outro fluxo consomem essa API; não replicam parsing.

### 8.5 State ownership

#### Requisito
State files canônicos do agent não podem ser escritos fora de `state/*`.

#### Exemplos de state canônico
- release state
- runtime state
- demais arquivos de estado persistente oficialmente reconhecidos como source of truth local

#### Regra
Módulos consumidores pedem “write/read/update” para `state/*`.
Eles não montam persistência ad hoc.

## 9. Mudanças de código esperadas

### 9.1 Criar

```text
apps/agent/src/platform/agent-path-layout.ts
apps/agent/src/platform/control/linux-service-control.ts
apps/agent/src/platform/control/linux-dev-process-control.ts
apps/agent/src/platform/control/windows-task-control.ts
apps/agent/src/config/agent-env.ts
apps/agent/src/config/agent-config.policy.ts
```

### 9.2 Revisar ou simplificar

```text
apps/agent/src/agent.ts
apps/agent/src/supervisor.ts
apps/agent/src/bootstrap/runtime-entry.ts
apps/agent/src/bootstrap/supervisor-entry.ts
apps/agent/src/bootstrap/create-platform-adapter.ts
apps/agent/src/bootstrap/create-control-service.ts
apps/agent/src/platform/local-control.adapter.ts
apps/agent/src/platform/linux.adapter.ts
apps/agent/src/platform/windows.adapter.ts
apps/agent/src/config/resolve-agent-paths.ts
```

### 9.3 Ajustar consumidores

Consumidores atuais devem migrar para os novos owners:

- `control-core/*` -> consumir `config/*` e `state/*`
- `app/*` -> consumir entrypoints reais
- `runtime/*` / `release/*` / `observability/*` -> consumir layout canônico e state/config APIs
- qualquer write direto de state canônico fora de `state/*` -> remover

## 10. Requisitos funcionais

### RF-01 — Entry points canônicos
O sistema deve ter 1 entrypoint real por executável.

### RF-02 — Compat wrappers mínimos
O sistema deve permitir wrappers finos apenas quando exigidos externamente.

### RF-03 — Layout lógico único
O sistema deve expor um layout canônico compartilhado por Linux e Windows.

### RF-04 — Diferenças de OS isoladas
O sistema deve isolar diferenças de OS exclusivamente em `platform/*`.

### RF-05 — Controle local modular
O sistema deve separar controle local por estratégia operacional.

### RF-06 — Config centralizada
O sistema deve possuir parser/validator/serializer único de config.

### RF-07 — State centralizado
O sistema deve concentrar persistência de state files canônicos em `state/*`.

### RF-08 — Sem breaking external contract
O sistema deve manter contratos externos atuais.

## 11. Requisitos não funcionais

### RNF-01 — Sem mudança comportamental intencional
O refactor deve preservar comportamento.

### RNF-02 — Determinismo
O novo desenho deve reduzir decisões duplicadas e drift estrutural.

### RNF-03 — Testabilidade
Cada estratégia de platform control deve ser testável isoladamente.

### RNF-04 — Legibilidade
Deve ficar evidente quem é owner de cada capacidade.

### RNF-05 — Portabilidade operacional
O desenho deve continuar suportando Linux e Windows sem abstração excessiva.

## 12. Critérios de aceite

### CA-01
Não existe mais duplicação estrutural óbvia de entrypoints reais dentro de `apps/agent/src`.

### CA-02
Wrappers remanescentes estão documentados como wrappers externos e não contêm lógica operacional relevante.

### CA-03
Existe um layout canônico consumido por Linux e Windows.

### CA-04
`linux.adapter.ts` e `windows.adapter.ts` não duplicam mais o shape completo do layout lógico.

### CA-05
`local-control.adapter.ts` deixa de concentrar:
- Linux installed service control
- Linux dev process control
- Windows task control

### CA-06
Parsing/serialization/placeholder validation de config não permanecem duplicados em runtime/CLI/control-core.

### CA-07
State file IO canônico não é escrito diretamente fora de `state/*`.

### CA-08
Não há novos imports de produção para caminhos legados internos.

### CA-09
Os testes do agent continuam cobrindo:
- path layout
- local control
- config parsing
- runtime/release boundaries mais afetadas pelo refactor

### CA-10
Não há mudança intencional de contrato HTTP/backend/UI.

## 13. Plano de implementação

### Fase 1 — Consolidar entrypoints
#### Objetivo
Eliminar duplicação interna de executáveis.

#### Tarefas
- mapear entrypoints reais vs wrappers
- escolher 1 real por executável
- converter wrappers remanescentes em forwarders finos
- remover wrappers internos inúteis
- corrigir imports/scripts/testes

#### Saída esperada
Árvore de entrypoints legível e sem espelhos desnecessários.

### Fase 2 — Extrair layout canônico
#### Objetivo
Parar de duplicar shape de paths entre Linux e Windows.

#### Tarefas
- criar builder/layout canônico
- mover nomes lógicos de arquivos/diretórios para owner único
- adaptar Linux e Windows para consumirem esse layout
- manter apenas diferenças reais em cada adapter

#### Saída esperada
Uma fonte única de verdade para layout do agent.

### Fase 3 — Modularizar control por estratégia
#### Objetivo
Explodir `local-control.adapter.ts` em estratégias pequenas.

#### Tarefas
- extrair `linux-service-control`
- extrair `linux-dev-process-control`
- extrair `windows-task-control`
- deixar `local-control.adapter.ts` como composition/dispatch

#### Saída esperada
Controle local previsível e orientado a strategy.

### Fase 4 — Centralizar config
#### Objetivo
Eliminar drift em parse/serialize/validate de config.

#### Tarefas
- criar `agent-env.ts`
- criar `agent-config.policy.ts`
- migrar consumidores
- remover parsing duplicado restante

#### Saída esperada
Config com owner único.

### Fase 5 — Reforçar state ownership
#### Objetivo
Impedir persistência canônica espalhada.

#### Tarefas
- identificar writes diretos
- mover para `state/*` quando for state canônico
- manter apenas logs/artifacts não canônicos fora desse boundary

#### Saída esperada
Persistência estruturalmente consistente.

### Fase 6 — Cleanup final e guardrails
#### Objetivo
Fechar regressão estrutural.

#### Tarefas
- ajustar testes
- ajustar boundary scan/checks
- revisar nomes ambíguos
- remover compat leftovers

#### Saída esperada
Branch pronto para review estrutural.

## 14. Regras de implementação

1. Não adicionar nova compat layer interna.
2. Não mover responsabilidade para `app/*` por conveniência.
3. Não criar abstração cross-platform genérica demais.
4. Não reimplementar parse de config fora de `config/*`.
5. Não reimplementar state write fora de `state/*`.
6. Não espalhar branching de OS fora de `platform/*`.
7. Não aproveitar este refactor para mudar semântica de release/update.
8. Toda mudança estrutural deve reduzir owner ambiguity.

## 15. Riscos

### Risco 1 — quebrar launchers/packaging
#### Mitigação
Manter wrappers externos estritamente necessários até testes de packaging passarem.

### Risco 2 — regressão silenciosa em path resolution
#### Mitigação
Cobrir layout canônico com testes por OS.

### Risco 3 — regressão em control flow local
#### Mitigação
Testes isolados por strategy:
- linux service
- linux dev process
- windows task

### Risco 4 — refactor crescer demais
#### Mitigação
Bloquear explicitamente:
- release state machine completa
- reescrita ampla de supervisor/runtime loop

## 16. Estratégia de testes

### Unit
- `agent-env`
- `agent-config.policy`
- `agent-path-layout`
- `linux-service-control`
- `linux-dev-process-control`
- `windows-task-control`

### Integration
- layout resolution Linux
- layout resolution Windows
- start/stop/restart local control
- wrappers chamando `main()` correta

### Regression
- self-update / release flow smoke
- current/previous switching smoke
- runtime selection smoke
- scripts/packaging smoke relevantes

## 17. Definição de pronto

Este trabalho está pronto quando:

- código compila
- testes relevantes passam
- não há duplicação estrutural óbvia remanescente nas áreas-alvo
- reviewers conseguem identificar owners por capacidade sem inferência subjetiva
- Linux/Windows compartilham layout lógico único
- wrappers remanescentes estão justificados e mínimos

## 18. Fora do PR atual / follow-up planejado

Os itens abaixo ficam explicitamente para sequência, não para este trabalho:

1. decomposição maior dos grandes orchestrators (`app/agent.main.ts`, loops extensos)
2. state machine única de release mais profunda
3. refactor mais amplo de supervisor/runtime orchestration
4. reorganização mais profunda de observability/log pipeline

## 19. Nome recomendado do PR de implementação

### Opção principal
**Refactor agent structure: remove internal compat layers and normalize platform boundaries**

### Opção alternativa
**Normalize agent platform boundaries, config ownership, and local control strategies**

## 20. TLDR

### Resumo
Vamos fazer um refactor estrutural focado em três cortes principais:

1. matar compat layer interna redundante
2. unificar layout/path ownership entre Linux e Windows
3. separar controle local por strategy e centralizar config/state nos owners certos

### Decisões tomadas
- `apps/agent` é a raiz canônica
- só `platform/*` conhece diferenças de OS
- só `config/*` parseia/serializa/valida config
- só `state/*` escreve estado local canônico
- wrappers só sobrevivem se forem exigência externa real
- release/runtime loop grande não será reescrito neste trabalho

### Ações implementáveis
1. consolidar entrypoints reais e remover wrappers inúteis
2. criar `agent-path-layout` canônico
3. quebrar `local-control.adapter.ts` em 3 strategies
4. centralizar env/config policy em `config/*`
5. mover writes canônicos para `state/*`
6. fechar com testes e guardrails

### Resultado esperado
Menos drift, menos bagunça, menos duplicação, boundaries claros e um agent muito mais previsível para evoluir.
