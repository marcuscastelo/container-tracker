# Container Tracker — Plano Paralelizável v3 (Feedback do Cliente + Bugs Integrados)

Objetivo deste plano:

- finalizar **todo o feedback do cliente**
- integrar **bugs correlatos nos mesmos grupos**
- reduzir retrabalho e economizar tokens de LLM
- manter **N >= 2 agentes em paralelo**
- minimizar merge conflicts
- separar **UI-mocked-first** de **wiring/E2E**
- deixar explícito o que está coberto e o que não está

---

# Princípios de agrupamento

Os grupos abaixo foram montados por **superfície de código compartilhada**, não apenas por tema funcional.

Critérios usados:

1. juntar mudanças que tocam os mesmos componentes / hooks / projections
2. evitar abrir vários PRs mexendo na mesma tabela/página
3. resolver bug junto com o refinamento visual da mesma área
4. manter o domínio canônico no backend quando houver semântica de tracking
5. preferir:
   - **PR 1 = UI mock / estrutura**
   - **PR 2 = wiring / backend / realtime / cache / mutation reconciliation**

---

# Visão geral dos grupos

```text
Grupo A — Dashboard Table Platform
Grupo B — Dashboard Alerts Cell + Severity UX
Grupo C — Dashboard Sync UX + Realtime Sync State Bug
Grupo D — Process Creation / Editing Bugs
Grupo E — Shipment / Process View UX
Grupo F — Tracking Domain Fixes (transshipment / expected→actual / severity aging)
Grupo G — Dashboard Data Contract Expansion (Importer/Exporter)
```

Observação importante:

- **Grupo A** é a base estrutural da tabela.
- **Grupo C** depende parcialmente de A.
- **Grupo G** pode rodar em paralelo com A porque toca projection/DTO, não necessariamente o componente visual principal.
- **Grupo F** é backend/domain e roda em paralelo quase sem conflito com os grupos de UI.

---

# GRUPO A — Dashboard Table Platform

## Objetivo

Consolidar toda a infraestrutura da tabela do dashboard em um único bloco evolutivo.

## Cobre

### Feedback do cliente
- linhas verticais finas na tabela
- garantir que **Process Ref** caiba melhor
- escurecer fontes secundárias no dashboard
- cards/panels com mais destaque
- permitir **sort em todas as colunas ordenáveis**
- fazer todas as colunas ordenáveis parecerem clicáveis
- definir **ordenação padrão por severidade**
- permitir **reordenação de colunas**
- posicionar **coluna de sync** como penúltima ou última
- preparar base para colunas configuráveis, se você decidir aproveitar o embalo

### Bugs integrados
- inconsistência visual de headers que parecem texto comum em vez de header ordenável
- qualquer bug de layout/hit area/header alignment associado à tabela
- base para evitar bugs futuros de reorder/sort divergentes entre estado visual e estado real

## Não cobre
- ícone visual do botão de sync em si
- bug de realtime do sync nas rows
- tooltip de alertas
- importer/exporter wiring
- lógica de tracking

---

## Fase A1 — UI mock / estrutura

Agente ideal: **UI**

### Entregas
- unificar definição de colunas em um único módulo/config
- separar:
  - `column definition`
  - `sortable metadata`
  - `reorder metadata`
  - `visibility metadata` se for aproveitar
- deixar todos os headers ordenáveis com affordance visual consistente
- implementar layout da tabela:
  - divisórias verticais suaves
  - widths/min-widths previsíveis
  - tratamento explícito de overflow do `Process Ref`
- persistir ordem das colunas em `localStorage`
- definir posição default da coluna de sync no fim
- implementar sort default por severidade:
  - `critical`
  - `warning`
  - `none`

### Critérios de aceite
- todas as colunas ordenáveis têm affordance visual de click
- nenhuma coluna ordenável parece texto estático
- trocar ordenação não quebra layout
- reordenar colunas persiste ao recarregar
- coluna sync abre no fim por padrão
- `Process Ref` fica mais resiliente a Windows/Chrome/EN/PTBR
- dashboard continua funcional com dados mockados

---

## Fase A2 — Wiring / E2E

Agente ideal: **engenharia frontend/fullstack**

### Entregas
- conectar tabela à fonte real de dados
- conectar sort aos campos reais
- garantir que reorder não quebre:
  - realtime
  - refresh local
  - seleção/navegação
- garantir estabilidade da ordenação default por severidade

### Critérios de aceite
- sort funciona com dados reais
- sort default é aplicado sem hacks visuais
- reorder não gera desalinhamento entre header/cell
- nenhuma coluna some por engano após reload
- comportamento consistente após navegação dashboard → shipment → dashboard

---

# GRUPO B — Dashboard Alerts Cell + Severity UX

## Objetivo

Concentrar toda a célula de alertas do dashboard em um único pacote visual/comportamental.

## Cobre

### Feedback do cliente
- remover chip **"atenção"**
- manter apenas:
  - strip de atenção
  - ícone warning
- tooltip do warning mostrando:
  - alerta dominante
  - até 2–3 alertas adicionais

### Bugs integrados
- severidade no dashboard exibindo **ATENÇÃO** incorretamente por muito tempo
- inconsistência entre alerta dominante e representação visual na célula
- bugs de rendering/agrupamento local da célula de alertas, desde que não impliquem rederivação de domínio

## Não cobre
- regra canônica de aging da severidade no domínio
- bug de transbordo duplicado
- sync visual em realtime

---

## Fase B1 — UI mock

Agente ideal: **UI**

### Entregas
- componente isolado da célula de alertas
- remover chip textual
- manter strip + ícone
- tooltip com:
  - dominante
  - mais 2–3
  - fallback quando houver 1 único alerta
- estados mockados:
  - no alerts
  - one warning
  - one critical
  - many alerts
  - dominant + extras

### Critérios de aceite
- não existe chip “atenção”
- ícone warning comunica severidade sem poluir horizontalidade
- tooltip é legível e operacional
- célula mantém densidade horizontal da tabela

---

## Fase B2 — Wiring

Agente ideal: **frontend/fullstack**

### Entregas
- conectar tooltip aos dados reais
- garantir que a UI só consome DTO/VM
- ajustar ordenação/agrupamento do que aparece no tooltip sem reimplementar regras de domínio

### Critérios de aceite
- dominante exibido bate com o payload real
- extras respeitam limite 2–3
- célula não recalcula severidade canônica
- atualização do dashboard reflete alertas reais sem hard refresh

### Dependência
- se a severidade canônica estiver errada por aging, depende do **Grupo F**

---

# GRUPO C — Dashboard Sync UX + Realtime Sync State Bug

## Objetivo

Resolver de uma vez toda a superfície de sync no dashboard: visual, estados transitórios, mutation reconciliation, atualização em tempo real das rows.

## Cobre

### Feedback do cliente
- substituir botão de sync por **ícone de duas setas**
- manter coluna de sync no final da tabela

### Bugs integrados
- **global sync não atualiza visualmente os sync states das rows sem hard refresh**
- botões de sync no dashboard apresentam bugs visuais
- sync state da row não reflete mutation/realtime de forma imediata
- inconsistência entre “sync disparado” e feedback visual por linha
- estados de loading/success/error do sync mal reconciliados no dashboard

## Não cobre
- infraestrutura geral de reorder/sort da tabela
- semântica de tracking
- bug de carrier incorreto
- “sync all ignora archived/recently synced” (isso é feature futura, não feedback atual)

---

## Fase C1 — UI mock

Agente ideal: **UI**

### Entregas
- substituir botão por ícone refresh-like de duas setas
- padronizar estados visuais:
  - idle
  - syncing
  - success recent
  - failed
  - disabled
- criar cell/action component específico de sync
- definir comportamento visual da row durante sync:
  - spinner/state chip/overlay leve, conforme padrão atual da UI

### Critérios de aceite
- botão visual não parece botão antigo
- estados são distinguíveis sem precisar refresh
- coluna de sync continua densa e operacional
- componente fica isolado para wiring posterior

---

## Fase C2 — Wiring / realtime / reconciliation

Agente ideal: **engenharia frontend/fullstack**

### Entregas
- corrigir invalidation/update local após sync individual e global
- reconciliar:
  - mutation local
  - resposta HTTP
  - evento realtime
  - refetch eventual
- garantir que global sync reflita estado nas rows sem hard refresh
- corrigir bugs visuais atuais do botão de sync

### Critérios de aceite
- clicar sync em uma row atualiza a própria row imediatamente
- disparar sync global atualiza visualmente as rows afetadas sem hard refresh
- retorno a estado idle/success/error é previsível
- dashboard não precisa recarregar para refletir sync em andamento ou concluído
- mudança não introduz reload de página

### Arquivos/superfícies prováveis
- dashboard table/actions
- hooks de fetch/cache
- mutation handlers
- subscriptions/realtime dashboard
- VM de sync state

### Dependências
- idealmente depois de **Grupo A Fase A1** se a coluna de sync estiver sendo reorganizada

---

# GRUPO D — Process Creation / Editing Bugs

## Objetivo

Resolver de forma consolidada os bugs de criação/edição de processo que compartilham lógica de formulário, validação e reconciliação de containers.

## Cobre

### Bugs integrados
- soft-lock ao manipular containers no create process
- container removido do processo não pode ser re-adicionado
- não é possível remover BL do processo durante update
- checagem atual de container existente parece naive:
  - qualquer erro vira “container já existente”

### Não cobre
- múltiplos containers via paste
- import CSV/markdown
- refatorações cosméticas do form sem valor direto
- mudanças de tracking

---

## Fase D1 — Investigação + testes de reprodução

Agente ideal: **engenharia**

### Entregas
- mapear fluxos exatos do formulário
- criar reprodução automatizada ou pelo menos testes de unidade/integration dos cenários
- identificar onde o estado do form quebra:
  - UI local
  - validator
  - DTO mapping
  - backend validation
  - repository error mapping

### Critérios de aceite
- cada bug tem cenário reproduzível documentado
- origem do erro diferenciada:
  - duplicidade real
  - erro de conexão
  - erro inesperado

---

## Fase D2 — Fix

Agente ideal: **engenharia**

### Entregas
- corrigir validação/contexto de duplicidade
- permitir remove/re-add determinístico
- permitir remoção de BL no update
- corrigir mapeamento de erros para não confundir usuário

### Critérios de aceite
- container removido pode ser re-adicionado sem estado fantasma
- editar container no form não entra em soft-lock
- BL pode ser removido no update
- erro de backend não vira mensagem falsa de “container já existente”
- formulário permanece resolvível sem refresh

---

# GRUPO E — Shipment / Process View UX

## Objetivo

Concentrar o refinamento visual restante da página de shipment/process.

## Cobre

### Feedback do cliente
- escurecer fontes secundárias específicas na página de processo
  - exemplo: `EGITO → MOVECTA`

### Bugs integrados
- qualquer bug estritamente visual de contraste/hierarquia nessa página
- desalinhamentos menores descobertos durante esse ajuste, desde que não mudem estrutura macro

## Já está feito e não precisa entrar aqui
- alertas não sticky
- alertas rolarem com a página

## Não cobre
- busca global na página
- navegação por alertas
- lógica de status
- tracking semantics

---

## Fase E1 — UI-only

Agente ideal: **UI**

### Entregas
- revisar tokens/variants usados para secondary text no shipment
- escurecer pontos de baixa legibilidade
- preservar hierarquia entre:
  - header
  - status principal
  - metadados secundários
  - timeline/supporting labels

### Critérios de aceite
- textos secundários ficam mais legíveis sem competir com status principal
- melhoria perceptível em ambiente real
- mudança localizada sem side effects em dashboard

---

# GRUPO F — Tracking Domain Fixes

## Objetivo

Agrupar as correções de domínio que afetam alertas, timeline e severidade canônica, sem misturar com rendering da UI.

## Cobre

### Bugs integrados
- alertas de transbordo duplicam após sync
- melhoria da fingerprint/deduplicação de alerta de transbordo
- severidade do dashboard continua exibindo atenção incorretamente por muitas horas, **se a origem for a regra canônica**
- melhoria de promoção:
  - `EXPECTED -> ACTUAL`
  - evitar timeline duplicada
- TODO de domínio relacionado:
  - gerar evento de transbordo de forma canônica, se necessário para corrigir a origem do problema

## Possível cobertura de feedback indireta
- melhora a qualidade do dado consumido pelo tooltip do Grupo B
- melhora a coerência da severidade usada no default sort do Grupo A

## Não cobre
- rendering da tabela
- tooltip/cell UI
- sync button
- create process form

---

## Fase F1 — Investigação de semântica

Agente ideal: **engenharia/domain**

### Entregas
- confirmar se duplicação de transshipment está na:
  - geração do evento
  - geração do alerta
  - fingerprint
  - dedupe persistente
- confirmar se problema de severidade está:
  - na regra canônica
  - no projection/dashboard
  - no VM/UI
- confirmar o ponto correto para promoção `EXPECTED -> ACTUAL`

### Critérios de aceite
- causa raiz de cada bug documentada
- não reimplementar semântica em UI/capability
- mudança planejada respeita:
  - ADR-0007
  - tracking invariants
  - append-only / deterministic derivation

---

## Fase F2 — Fix de domínio

Agente ideal: **engenharia/domain**

### Entregas
- corrigir dedupe/fingerprint de transshipment alert
- corrigir regra de aging/severity se a origem for canônica
- corrigir promoção `EXPECTED -> ACTUAL` sem apagar histórico indevidamente
- adicionar/ajustar testes do tracking pipeline

### Critérios de aceite
- sync repetido não duplica indevidamente alerta de transbordo
- timeline não duplica desnecessariamente EXPECTED e ACTUAL para o mesmo marco
- severidade canônica evolui corretamente ao longo do tempo
- domínio continua determinístico e auditável

---

# GRUPO G — Dashboard Data Contract Expansion (Importer / Exporter)

## Objetivo

Adicionar os campos necessários para completar o feedback operacional do dashboard sem misturar isso com o trabalho visual principal da tabela.

## Cobre

### Feedback do cliente
- adicionar **Importador** e **Exportador** como colunas
- posicionar **Importador** logo após `Process Ref`

### Bugs integrados
- nenhum bug crítico direto
- apenas contract expansion / projection alignment

## Não cobre
- configuração visual profunda da tabela
- reorder/sort infra
- tracking semantics

---

## Fase G1 — Contract / projection / DTO

Agente ideal: **backend/fullstack**

### Entregas
- verificar se importer/exporter já existem em:
  - entity
  - projection
  - response DTO
  - VM
- se não existirem, expandir contrato de leitura do dashboard
- preservar boundaries:
  - domain -> result -> response DTO -> VM

### Critérios de aceite
- dashboard recebe importer/exporter no payload
- não vaza row/infra para UI
- mapping explícito em cada fronteira

---

## Fase G2 — UI wiring leve

Agente ideal: **frontend**

### Entregas
- plugar colunas no dashboard
- colocar Importador logo após `Process Ref`
- integrar com a infraestrutura de colunas do Grupo A

### Critérios de aceite
- importer/exporter aparecem com dados reais
- posição default respeitada
- não quebra responsividade atual mais do que o aceitável

### Dependência
- idealmente depois de **Grupo A Fase A1**

---

# Ordem recomendada de execução paralela

## Onda 1 — máximo paralelismo com baixo conflito

Rodar juntos:

- **Agent 1** → Grupo A / Fase A1
- **Agent 2** → Grupo B / Fase B1
- **Agent 3** → Grupo D / Fase D1
- **Agent 4** → Grupo E / Fase E1
- **Agent 5** → Grupo F / Fase F1
- **Agent 6** → Grupo G / Fase G1

Motivo:
- A, B, E são superfícies visuais diferentes
- D e F são backend/domain diferentes
- G toca projection/DTO

---

## Onda 2 — wiring e correções profundas

Depois da Onda 1:

- **Agent 1** → Grupo A / Fase A2
- **Agent 2** → Grupo C / Fase C1
- **Agent 3** → Grupo D / Fase D2
- **Agent 4** → Grupo F / Fase F2
- **Agent 5** → Grupo G / Fase G2

---

## Onda 3 — sync realtime final

Depois de A2 e preferencialmente depois de estabilizar a tabela:

- **Agent 6** → Grupo C / Fase C2

Motivo:
o bug de sync em realtime é o mais propenso a conflito com a estrutura da tabela.

---

# Merge conflict strategy

## Pode rodar em paralelo com segurança
- A1 com B1
- A1 com D1
- A1 com E1
- A1 com F1
- B1 com D1
- B1 com F1
- D1 com F1
- G1 com quase todos

## Melhor evitar ao mesmo tempo
- A2 com C2
- A2 com G2 se ambos mexerem diretamente na mesma definição final de colunas
- B2 com F2 se o formato do payload de alertas ainda estiver mudando
- C2 com qualquer PR que refatore subscriptions/caching do dashboard ao mesmo tempo

---

# Cobertura explícita

## Feedback do cliente coberto
- aumentar altura da navbar
- linhas verticais finas
- Process Ref caber melhor
- cards/panels com mais destaque
- escurecer fontes secundárias no dashboard
- sort em todas as colunas ordenáveis
- affordance visual consistente para colunas clicáveis
- ordenação padrão por severidade
- trocar botão de sync por ícone de duas setas
- coluna de sync no fim
- adicionar importer/exporter
- importer após Process Ref
- remover chip atenção
- manter strip + ícone warning
- tooltip com dominante + 2–3 extras
- reordenação de colunas
- escurecer fontes secundárias específicas na página de processo

## Bugs cobertos
- global sync não atualiza visualmente os sync states das rows sem hard refresh
- bugs visuais dos botões de sync do dashboard
- severidade do dashboard exibindo ATENÇÃO incorretamente por tempo excessivo
- alerta de transbordo duplicado após sync
- soft-lock ao manipular containers no create process
- container removido não pode ser re-adicionado
- não é possível remover BL no update
- checagem naive de “container já existente” confundindo erro real com duplicidade

---

# O que NÃO está coberto neste plano

Itens fora deste recorte, mesmo que importantes:

- copy button hit area não cobre todo o botão
- barra de busca global na página de processo
- animações de dialog / blur overlay
- colar múltiplos containers
- importar CSV / markdown human-friendly
- copiar valores da tabela com um clique
- paginação no dashboard
- clicar em N alertas para abrir overlay de processos/containers
- clicar no container dentro do alerta para navegar/scroll
- sync apenas um container como feature nova explícita
- sync all ignorar archived / recently synced
- progress do container no status
- carrier auto-detection
- templates de email
- booking_number no processo
- operation_type / null vs unknown cleanup
- error codes estruturados + i18n
- deduplicação de clipboard utils
- mover parsing/enrichment para data layer em escopo amplo
- refactor CreateProcessDialog por arquitetura interna
- tools folder restructure
- API versioning
- container_number como PK
- vitest/vite dev env issue

## Motivo
Esses itens pertencem ao backlog técnico/produto mais amplo, não ao objetivo imediato de:
- concluir feedback do cliente
- resolver bugs diretamente colados às mesmas superfícies

---

# Ambiguidades abertas

## 1. Navbar height
Você marcou que **não foi feito**.  
Ambiguidade restante: a navbar deve crescer:
- globalmente em toda a aplicação
- ou só no dashboard / desktop
- ou apenas ajustar padding/height sem mexer no logo/brand balance

## 2. Sort “todas as colunas ordenáveis”
Precisamos idealmente fechar a lista exata de colunas ordenáveis.
Hoje a frase correta para os agentes deve ser:
- “todas as colunas que semanticamente podem ser ordenadas precisam ser clicáveis e parecer clicáveis”

Mas ainda faltaria congelar a lista.

## 3. Reorder de colunas
Precisamos decidir se algumas colunas serão fixas:
- `Process Ref`
- `Alertas`
- `Sync`

Minha recomendação:
- `Process Ref` fixo
- `Alertas` e `Sync` movíveis apenas dentro de um subconjunto, ou `Sync` fixo no fim

## 4. Severidade incorreta
Ainda existe uma ambiguidade importante:
- o erro está na regra canônica do tracking
- ou no projection/dashboard
- ou só na representação visual

O Grupo F resolve isso via investigação antes da correção.

## 5. Importer / Exporter
Precisa confirmar se os dados já existem de forma confiável no backend atual ou se haverá lacunas por processo.

---

# Pedido de informação para fechar o plano sem suposições

Preciso de 3 definições para transformar isso em PRDs executáveis por agente sem margem de interpretação ruim:

1. **Lista explícita de colunas ordenáveis do dashboard**
2. **Quais colunas podem ser reordenadas e quais devem ser fixas**
3. **Regra desejada da navbar**
   - aumentar só altura
   - aumentar altura + padding interno
   - desktop apenas ou global

Com isso, eu consigo converter este plano diretamente em:
- PRDs por grupo
- prompts separados para UI agents
- prompts separados para engineering agents
- ordem de merge recomendada