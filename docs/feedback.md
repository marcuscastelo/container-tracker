# Container Tracker — Feedback do Cliente (Status Corrigido)

Lista corrigida com base no seu ajuste manual.

---

# ✅ Já Fizemos

### Sistema de Alertas na Tabela

- Colapsar colunas:

  ```
  SEVERIDADE DOMINANTE
  ALERTA DOMINANTE
  ALERTAS ATIVOS
  ```

em única coluna **ALERTAS** exibindo:

  - ícone de severidade
  - contagem de alertas
  - alerta dominante

### Shipment / Process View

- **Alertas não devem ser sticky** na página de processo.
- Devem **rolar junto com página**.

### Agent (Windows)

- Adicionar **ícone personalizado no tray icon do agent no Windows**.

---

# ⚠️ Parcial / Precisa Validar

### Estrutura e Legibilidade

- Linhas verticais finas na tabela para facilitar leitura das colunas.
- Garantir que **Process Ref sempre caiba na coluna** (testar Windows + Chrome + EN/PTBR).
- Fazer **cards/panels se destacarem mais do fundo** (sombras).
- Escurecer **fontes secundárias** para melhorar legibilidade.

### Ordenação e Estrutura da Tabela

- Permitir **sort em todas colunas ordenáveis**.

Estado atual:
  - parte do comportamento existe
  - ainda está inconsistente visualmente
  - algumas colunas parecem texto comum
  - no mínimo todas colunas ordenáveis devem parecer clicáveis

- Definir **ordenação padrão por severidade**:

  ```
  critical → warning → none
  ```

### Botões e Ações

- Posicionar **coluna de sync como penúltima ou última coluna**.

---

# ❌ Ainda Não Fizemos

### Estrutura e Legibilidade

- Aumentar altura da navbar.

### Botões e Ações

- Substituir botão de **sync** por **ícone de duas setas (estilo refresh de browser)**.

### Colunas e Informações Operacionais

- Adicionar **Importador e Exportador como colunas do dashboard**.
- Posicionar **Importador logo após Process Ref**.

### Sistema de Alertas na Tabela

- Remover **chip "atenção"**, mantendo apenas:

  - **strip de atenção**
  - **ícone warning**

- Tooltip do **ícone warning** deve mostrar:

  - alerta dominante
  - até **2–3 alertas adicionais**

### Personalização da Tabela

- Permitir **reordenar colunas pelo usuário** (persistir em `localStorage`).

### Shipment / Process View

- Escurecer **fontes secundárias específicas** (exemplo: `EGITO → MOVECTA`).

---

# Impacto no planejamento paralelo

Com essa correção, plano de execução muda assim:

## Grupo A — Sistema de Tabela do Dashboard

Cobre juntos:

- sort em todas colunas ordenáveis
- estado visual consistente de colunas ordenáveis
- ordenação padrão por severidade
- reordenação de colunas
- posicionamento da coluna de sync
- colunas configuráveis no futuro, se você quiser aproveitar mesma base

Motivo para agrupar:
essas mudanças compartilham mesma infraestrutura de tabela e evitam retrabalho.

---

## Grupo B — Alertas da Tabela

Cobre juntos:

- remover chip "atenção"
- manter strip + ícone warning
- tooltip do warning com alerta dominante + até 2–3 adicionais

Motivo para agrupar:
é mesmo bloco visual/comportamental da coluna de alertas.

---

## Grupo C — Legibilidade Geral do Dashboard

Cobre juntos:

- linhas verticais finas
- Process Ref caber melhor
- sombras dos cards/panels
- escurecer fontes secundárias no dashboard
- navbar mais alta

Motivo para agrupar:
tudo é refinamento visual/operacional com baixo acoplamento ao domínio.

---

## Grupo D — Sync UX

Cobre juntos:

- trocar botão de sync para ícone de duas setas
- garantir que coluna de sync esteja no fim da tabela

Observação:
a posição da coluna também toca Grupo A.  
Para evitar conflito, o ideal é:

- **Grupo A** define a infraestrutura e ordem das colunas
- **Grupo D** altera apenas o conteúdo visual do botão de sync

---

## Grupo E — Shipment / Process View Visual

Cobre:

- escurecer fontes secundárias específicas da página de processo

Motivo:
mudança localizada, ideal para agente UI separado.

---

# O que ficou coberto

## Coberto no planejamento revisado

- navbar height
- linhas verticais
- Process Ref sizing
- card shadows
- secondary text contrast
- sort clicável/consistente
- default severity sort
- sync icon
- sync column near end
- importer/exporter columns
- importer after Process Ref
- remover chip atenção
- warning tooltip com múltiplos alertas
- reordenação de colunas
- secondary text no shipment/process

---

# O que NÃO está coberto por esse recorte

Nada do feedback do cliente ficou fora.

que continua fora são itens do backlog técnico / idea dump que não pertencem ao feedback do cliente, por exemplo:

- soft-lock create process
- BL removal bug
- transshipment duplicate alert bug
- copy button hit area
- multi-container paste
- CSV import
- pagination
- global search
- email alerts
- carrier auto-detection

Motivo:
isso pertence ao backlog técnico/produto, não ao pacote “finalizar feedback do cliente”.

---

# Ambiguidades ainda abertas

## 1. Importador / Exportador

Precisa confirmar se:

- campos já existem no DTO do dashboard
- ou se será necessário expandir projection / response

## 2. Sort “todas as colunas ordenáveis”

Convém fechar lista explícita de colunas ordenáveis, para evitar interpretação livre do agente.

## 3. Reordenação de colunas

Precisamos decidir se:

- qualquer coluna pode ser movida
- ou algumas serão fixas, por exemplo:
  - Process Ref
  - Alertas
  - Sync

Minha recomendação:
deixar algumas colunas fixas para preservar usabilidade operacional.

---

# Recomendação de paralelização atualizada

Rodar em paralelo:

- **Agent UI 1** → Grupo A (infra visual da tabela)
- **Agent UI 2** → Grupo B (alert cell + tooltip)
- **Agent UI 3** → Grupo C (legibilidade dashboard + navbar)
- **Agent UI 4** → Grupo E (shipment/process visual)
- **Agent UI/Eng 5** → Importer/Exporter wiring, se campos não existirem

Depois disso:

- **Agent UI 6** → Grupo D (ícone de sync), já em cima da tabela estabilizada

---

# Recomendações para evitar merge conflicts

## Não rodar em paralelo

- Grupo A e Grupo D no mesmo momento, se ambos alterarem header/cell da coluna sync
- Grupo A e qualquer tarefa que mexa em estrutura central de colunas sem combinar ownership

## Seguro rodar em paralelo

- Grupo B com Grupo C
- Grupo C com Grupo E
- Grupo B com Grupo E
- Grupo A com wiring de importer/exporter, desde que o DTO seja mexido fora do componente principal da tabela

---

Se quiser, eu agora gero versão seguinte: **plano de implementação paralelo final**, já transformado em **blocos de PR/PRD por agente**, com:
- objetivo
- arquivos prováveis
- boundaries
- critérios de aceite
- dependências
- ordem de execução