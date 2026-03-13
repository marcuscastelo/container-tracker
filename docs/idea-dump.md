# Container Tracker — Clean Idea Dump

Versão limpa e organizada do dump antigo.  
Itens foram **deduplicados, agrupados e normalizados** em:

- Bugs
- Product Ideas
- TODOs
- Technical Debt
- Investigations

Itens obsoletos ou redundantes foram removidos.

---

# 🐞 Bugs

## Dashboard UI

- Botões de **sync no dashboard apresentam bugs visuais** e só atualizam após refresh.

- Área clicável do botão **copy** não cobre todo o botão.

---

## Alert System

- Severidade no dashboard continua exibindo **ATENÇÃO** mesmo quando alerta já tem muitas horas.

- Alertas de **transbordo duplicam após sync**.

  Comportamento esperado:

  ```
  alerta deve ser único por container + navio + voyage
  ```

  Casos a considerar:

  ```
  Navio A -> Navio B -> Navio A -> Navio B
  ```

---

# 💡 Product Ideas

## UX Improvements

- Mostrar **"Última edição há Xs"** logo após criar processo  
  para confirmar que o processo foi criado com sucesso.

- Adicionar **animações de abertura/fechamento de dialogs**.

- Adicionar **transição suave nos efeitos de blur** do search overlay.

---

## Dashboard Improvements

- Permitir **copiar valores da tabela com um clique**.

- Permitir **configurar colunas visíveis do dashboard**  
  e salvar preferências do usuário.

- Adicionar **paginação no dashboard**.

---

## Alert Interaction

- Clicar em **"N alertas"** abre overlay com processos/containers correspondentes.

- Clicar no **container dentro do alerta** deve:

  ```
  selecionar container
  scroll automático para "Status Atual"
  ```

---

## Sync Improvements

- Botão para **sincronizar apenas um container**.

- Botão **"Sincronizar todos"** deve ignorar processos:

  ```
  sincronizados recentemente
  archived
  ```

---

## Operational Visibility

- Mostrar **progresso do container** no status.

  Exemplo:

  ```
  Loaded (5/10)
  Discharged (7/10)
  ```

  onde:

  ```
  X = último ACTUAL
  Y = último EXPECTED
  ```

  Alternativa:

  ```
  campo separado "Progress"
  ```

---

## Carrier Detection

- Se carrier estiver incorreto:

  ```
  tentar APIs em ordem de probabilidade
  maersk -> hapag -> etc
  ```

  Caso encontrado:

  ```
  atualizar processo automaticamente
  ```

---

## Alerts / Notifications

- Criar **templates de email** para alertas:

  ```
  atraso
  transbordo
  eventos operacionais
  ```

---

# 📋 TODO

## UX Feedback

Quando carrier está errado e refresh falha:

UI deve mostrar:

```
"Não foi possível encontrar o container.
Verifique o armador e tente novamente."
```

Futuro:

```
botão "Tentar identificar armador automaticamente"
```

---

## Domain

- Revisar se `operation_type` pode ser removido do banco.

- Padronizar uso de:

```
null vs undefined
```

para campos opcionais.

---


## Alert Content

Alertas de transbordo devem incluir:

```
container
navio original
navio novo
redestinação do processo (hoje falta, como aplicar?)
```

---

# 🧱 Technical Debt

## Error Handling

- Substituir **mensagens hardcoded** por:

```
error codes + parâmetros
```

para suportar i18n.

---

## i18n

- Diversos textos ainda **não usam i18n parametrizado**.

Exemplo:

```
"Vessel change"
```

---

## UI Architecture

- Deduplicar **clipboard utils** usados em:

```
CopyButton
ShipmentView
```

- Parsing/enrichment extensos em:

```
ShipmentView
Dashboard
refresh logic
[id] route
```

devem ser movidos para:

```
data layer / adapters
```

---

## Component Architecture

`CreateProcessDialog` exige duplicação de lógica de submit.

Refatorar para:

```
hook compartilhado
ou componente reutilizável
```

---

## Repository / Validation

Checagem atual de **container existente** parece naive:

```
qualquer erro -> assume container existente
```

Precisa diferenciar:

```
container duplicado
erro de conexão
erro de API
```

---

## Project Structure

A pasta `tools/` está acumulando:

```
scripts
AI prompts
agent
```

Avaliar nova estrutura:

```
/agent
/devtools
/ai-tools
```

---

## API Versioning

Existe:

```
Processes API v1
Processes API v2
```

Avaliar estratégia:

```
remover v1
renomear v2
ou manter versionamento explícito
```

---

# 🔍 Investigations

## Container Identity

Hoje containers possuem:

```
internal ID
```

Motivo:

```
container pode aparecer em carriers diferentes
```

Avaliar se seria melhor usar:

```
container_number como PK
```

Considerando casos de:

```
erro humano em cadastro
processos legalmente incorretos mas operacionalmente necessários
```

---

# ⚙️ Dev Environment

## VSCode / Vitest Error

Erro ao iniciar Vitest:

```
ERR_MODULE_NOT_FOUND
Cannot find package 'vite'
```

Possível causa:

```
vite não instalado ou dependência quebrada
```

Investigar:

```
pnpm install
dependências do workspace
config do vitest
```