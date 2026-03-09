# Idea Dump — Status Atual

Classificação dos itens do dump antigo em:
- ✅ Fizemos
- ⚠️ Parcial / precisa validar
- ❌ Ainda não fizemos

Itens de domínio e arquitetura foram avaliados considerando as mudanças recentes
(tracking, timeline, alerts, UI overhaul, etc).

---

# ✅ Fizemos

### UI / UX

- Permitir que o usuário escolha **quais colunas quer ver no dashboard** e salvar preferências.
- Colar **múltiplos containers** para adicionar vários de uma vez.
- Permitir **copiar valores da tabela do dashboard** com um clique.
- Adicionar **paginação no dashboard**.
- Barra de **busca global** existente e integrada à navegação principal.

### Alertas / UX Operacional

- Permitir **clicar no container dentro do alerta** e navegar para o container correspondente.

### Sistema

- Agents fazem **heartbeat periódico** e a UI pode detectar ausência de agentes.

---

# ⚠️ Parcial / Precisa Validar

### Bugs

- Bug visual nos botões de **sync no dashboard**.
- Severidade do alerta no dashboard fica **"ATENÇÃO" mesmo quando o alerta é antigo**.
- Área clicável do botão **copy** pequena / desalinhada.

### Tracking / Alertas

- Alertas de **transbordo duplicando após sync** (idempotência incompleta).

### UI / UX

- Efeitos de **blur do search overlay** sem transição suave.
- **Animações de dialogs e navegação** inconsistentes.
- Botão **sincronizar todos os processos** poderia evitar processos sincronizados recentemente.

### Backend / Domínio

- Alertas ainda possuem **textos hardcoded** em alguns lugares (i18n parcial).
- Alguns textos de eventos ainda não usam **i18n parametrizado**.

---

# ❌ Ainda Não Fizemos

## Bugs Funcionais

- Soft-lock ao manipular containers no **Create Process** (fluxo adicionar/remover/readicionar).
- Não é possível **remover BL do processo** durante update.
- Container removido do processo **não pode ser re-adicionado**.

---

## Ideias de Produto

### UX

- Mostrar **"Última edição há X segundos"** logo após criar processo.
- Barra de busca global também **na página de processo**.
- Overlay mostrando **lista de processos/containers ao clicar em "N alertas"**.
- Botão para **sincronizar apenas um container**.
- Templates de **email para alertas operacionais**.

### Tracking / Domínio

- Heurística para **identificar automaticamente o armador** se o carrier estiver errado.
- Mostrar **progresso operacional do container** (ex: `Loaded 5/10`).
- Gerar **evento de transbordo** quando navio A chega e navio B sai com o mesmo container.
- Melhorar lógica de **promoção EXPECTED → ACTUAL** sem duplicar observation.

### Alertas

- Alertas de transbordo incluírem:

  - container
  - navio original
  - navio novo
  - redestinação do processo

---

## TODO / Evoluções Técnicas

- Adicionar **booking_number** ao processo no domínio.
- Padronizar uso de **null vs unknown** em campos opcionais.
- Remover coluna **operation_type** do banco se confirmado redundante.

---

## Refactors / Dívida Técnica

- Substituir **mensagens de erro hardcoded por códigos padronizados**.
- Revisar uso de **containerNumber vs ID como chave primária**.
- Refatorar **CreateProcessDialog** para evitar duplicação de lógica.
- Mover parsing/enrichment extensos para **camada de adapters/dados testáveis**.
- Deduplicar **clipboard utils**.
- Revisar estrutura da pasta **tools/** (scripts + agent + prompts).
- Revisar **Processes API versioning** (v1/v2).

---

## Outros

- Ícone customizado no **tray icon do agent no Windows**.