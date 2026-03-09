# Container Tracker — Feedbacks do Cliente (Status Atual)

Lista deduplicada e classificada por status de implementação.

---

# ✅ Já Fizemos

### Estrutura e Legibilidade

- Aumentar altura da navbar.
- Tentar aumentar hierarquia de fontes para destacar **"Intervalo: X dias sem novos eventos"**.

### Sistema de Alertas na Tabela

- Colapsar colunas:

  ```
  SEVERIDADE DOMINANTE
  ALERTA DOMINANTE
  ALERTAS ATIVOS
  ```

  em uma única coluna **ALERTAS** exibindo:

  - ícone de severidade
  - contagem de alertas
  - alerta dominante

---

# ⚠️ Parcial / Precisa Validar

### Estrutura e Legibilidade

- Linhas verticais finas na tabela para facilitar leitura das colunas.
- Garantir que **Process Ref sempre caiba na coluna** (testar Windows + Chrome + EN/PTBR).
- Fazer **cards/panels se destacarem mais do fundo** (sombras).
- Escurecer **fontes secundárias** para melhorar legibilidade.

### Ordenação e Estrutura da Tabela

- Permitir **sort em todas as colunas ordenáveis**.
- Definir **ordenação padrão por severidade**:  
  `critical → warning → none`

### Botões e Ações

- Substituir botão de **sync** por **ícone de duas setas (estilo refresh de browser)**.
- Posicionar **coluna de sync como penúltima ou última coluna**.

---

# ❌ Ainda Não Fizemos

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

---

# Shipment / Process View

### Legibilidade Operacional

- Escurecer **fontes secundárias específicas** (exemplo: `EGITO → MOVECTA`).

### Comportamento de Alertas

- **Alertas não devem ser sticky** na página de processo.
- Devem **rolar junto com a página**.

---

# Agent (Windows)

### UX do Agent

- Adicionar **ícone personalizado no tray icon do agent no Windows**.