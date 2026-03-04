# Container Tracker  
## Proposta de Plataforma de Visibilidade Operacional de Importação

Esta proposta apresenta um sistema focado em **visibilidade operacional de containers de importação**.

O objetivo do sistema não é substituir um TMS completo, ERP ou sistema aduaneiro.

O objetivo é resolver um problema muito específico e caro nas operações de importação:

> **falta de visibilidade operacional sobre containers em trânsito**

Hoje isso normalmente é resolvido com:

- sites de carriers
- planilhas
- Trello
- e-mails
- WhatsApp

Esse método funciona, mas tem três problemas estruturais:

1. exige trabalho manual constante  
2. aumenta risco de erros operacionais  
3. dificulta detectar problemas antes que virem custo

O Container Tracker foi pensado para resolver exatamente isso.

---

# O que o MVP já entrega

O MVP é um **painel operacional de importação**.

Ele centraliza as informações de containers e apresenta o estado operacional da operação de forma clara e auditável.

## 1. Dashboard operacional

Lista todos os processos de importação com:

- número do processo
- importador
- status logístico
- ETA
- alertas operacionais
- containers associados

Permite:

- ordenar
- filtrar
- identificar rapidamente processos com risco

O objetivo do dashboard é simples:

> permitir que o operador identifique problemas em segundos.

---

## 2. Página de processo

Cada processo possui uma página detalhada contendo:

- cabeçalho do embarque
- containers associados
- linha do tempo logística
- alertas operacionais
- mudanças de navio
- transshipments

Cada container pode ser selecionado individualmente.

Isso é importante porque containers do mesmo processo frequentemente:

- viajam em navios diferentes
- chegam em datas diferentes
- sofrem atrasos diferentes.

---

## 3. Timeline logística clara

O sistema reconstrói a **linha do tempo completa do container**.

Exemplo:

```
Loaded on vessel
Departed port
Transshipment detected
Loaded on new vessel
Arrived at destination port
Discharged
Delivered
```

Eventos são agrupados por viagem de navio para facilitar leitura.

Exemplo:

```
MSC PARIS
Alexandria → Algeciras

MAERSK LAMANAI
Algeciras → Santos
```

Isso permite identificar **transshipments imediatamente**.

---

## 4. Detecção de lacunas operacionais

O sistema detecta intervalos relevantes entre eventos.

Exemplo:

```
Vessel departed
⏳ 8 days at sea
Arrived at port
```

Ou:

```
Arrived at port
⚠ Container at port for 4 days
```

Isso ajuda a identificar:

- containers parados
- atrasos inesperados
- riscos de armazenagem.

---

## 5. Alertas operacionais

O sistema gera alertas derivados de eventos logísticos.

Exemplos:

- ETA atrasado
- mudança de ETA
- container parado em porto
- conflito de eventos
- inconsistência de dados

Esses alertas aparecem:

- no dashboard
- na página do processo.

---

## 6. Arquitetura auditável

O sistema foi construído para **preservar histórico completo**.

Isso significa:

- snapshots de carriers são preservados
- eventos são imutáveis
- estados são derivados

Ou seja:

> o sistema sempre consegue explicar **por que um container está naquele estado**.

Isso é importante quando algo dá errado.

---

# O que planejamos para as próximas fases

O sistema foi pensado para evoluir.

Principais melhorias planejadas:

## Alertas operacionais avançados

Exemplo:

- container parado no porto há X dias
- atraso relevante em relação ao ETA original
- atraso entre eventos logísticos
- mudanças frequentes de ETA

---

## Visão operacional estilo Kanban

Painel de trabalho baseado em status como:

- aguardando chegada
- aguardando presença
- aguardando numerário
- aguardando ICMS
- faturamento

Isso aproxima o sistema do fluxo operacional real.

---

## Busca operacional avançada

Busca por:

- container
- processo
- importador
- BL
- navio
- status

---

## Exportação de auditoria

Exportar um processo completo contendo:

- timeline
- eventos
- status
- histórico

Para fins de auditoria ou compartilhamento.

---

# O que nosso sistema faz que muitos concorrentes não fazem

O foco do sistema é **clareza operacional**.

Algumas coisas que o sistema faz bem:

## Reconstrução real da timeline

Muitos sistemas apenas mostram eventos.

Nosso sistema:

- reconstrói a sequência correta
- detecta previsões vencidas
- separa eventos reais de previsões.

---

## Agrupamento por viagem de navio

Isso torna transshipments muito mais claros.

---

## Histórico completo preservado

Eventos nunca são apagados.

Isso garante auditabilidade.

---

## Detecção de inconsistências

O sistema identifica:

- eventos conflitantes
- previsões vencidas
- mudanças de ETA.

---

# O que sistemas grandes fazem que nós não fazemos

É importante ser transparente.

Grandes plataformas fazem coisas que este sistema não pretende fazer neste momento.

Exemplos:

- gestão financeira
- faturamento
- gestão aduaneira completa
- integração EDI massiva
- gestão documental
- gestão de transporte terrestre
- gestão de armazém.

Esses sistemas são chamados de **TMS completos**.

Eles são muito mais amplos, mas também muito mais complexos.

---

# Comparação com alternativas

## Planilha + Trello

Prós:

- barato
- flexível

Contras:

- sem timeline real
- sem alertas
- trabalho manual constante
- difícil detectar problemas.

---

## TMS completo

Prós:

- solução abrangente
- automação completa

Contras:

- custo alto
- implantação longa
- complexidade elevada.

---

## Container Tracker

Posicionamento:

> **painel operacional de visibilidade logística**

Mais simples que um TMS  
Muito mais poderoso que planilhas.

---

# Comparação de preços

Valores típicos de mercado.

## TMS enterprise

```
R$10k – R$40k por mês
```

Implantação:

```
R$50k – R$200k
```

---

## Sistemas de tracking globais

```
USD 20k – USD 200k por ano
```

---

## Container Tracker

Estrutura proposta:

```
Implantação inicial
R$10.000
```

```
Operação mensal
R$2.000 – R$3.000
```

Inclui:

- manutenção
- monitoramento
- melhorias pequenas
- suporte operacional.

---

# Diluição do custo de desenvolvimento

Normalmente um sistema assim seria cobrado como projeto.

Neste caso, a proposta é **diluir o custo ao longo do tempo**.

Ou seja:

- implantação menor
- evolução contínua
- custo mensal previsível.

---

# Economia operacional estimada

Valores conservadores.

## Economia de tempo

Hoje operadores frequentemente precisam:

- abrir site de carrier
- buscar container
- verificar ETA
- atualizar planilha ou Trello.

Estimativa conservadora:

```
3 minutos por verificação
3 verificações por container
100 containers por mês
```

Tempo mensal:

```
900 minutos
15 horas
```

Se o custo total de um operador for:

```
R$6000 / mês
```

Custo por hora:

```
R$37.50
```

Economia operacional:

```
15 × 37.50 = R$562.50 por mês
```

---

## Redução de risco de demurrage

Custos típicos:

```
demurrage ≈ R$400 por dia
armazenagem ≈ R$500 por dia
```

Total:

```
≈ R$900 por dia
```

Se o sistema evitar apenas:

```
3 dias de atraso por trimestre
```

Economia:

```
R$2700 por trimestre
≈ R$900 por mês
```

---

## Economia total conservadora

```
tempo operacional ≈ R$560
risco evitado ≈ R$900
```

Total aproximado:

```
R$1.400 – R$2.000 por mês
```

Esse valor pode ser maior dependendo do volume de containers.

---

# Custo por container

Se a operação tiver:

```
100 containers por mês
```

E o sistema custar:

```
R$3000 por mês
```

Custo por container:

```
R$30
```

Um único dia de armazenagem costuma custar:

```
≈ R$500
```

---

# Adoção da equipe e período inicial de adaptação

Toda nova ferramenta operacional exige um **período de adaptação**.

É importante tratar isso com transparência.

## Tempo típico de adaptação

Para sistemas desse tipo, normalmente observamos:

```
Primeira familiarização da equipe
≈ 1 semana
```

```
Uso confortável
≈ 2 a 3 semanas
```

Durante esse período a equipe aprende:

- como navegar no dashboard
- como ler timelines
- como interpretar alertas.

---

# Período de testes recomendado

Recomenda-se um período inicial de validação operacional.

```
Duração sugerida
2 a 4 semanas
```

Durante esse período o sistema roda **em paralelo ao fluxo atual**.

Ou seja:

- o sistema já é utilizado
- mas decisões operacionais ainda podem ser confirmadas manualmente.

Esse modelo reduz risco e aumenta confiança.

---

# Possíveis bugs iniciais

Como qualquer sistema que integra dados externos (carriers), podem ocorrer:

- eventos com nomenclatura diferente
- mudanças inesperadas em APIs de carriers
- casos raros de timeline incompleta.

Esses casos tendem a aparecer apenas após uso real.

Por isso o período de testes é importante.

---

# Como mitigar o risco no início

A melhor prática é usar o sistema com **paridade de verificação** no início.

Fluxo sugerido:

```
1. operador consulta o Container Tracker
2. se houver dúvida, confirma no site do carrier
3. feedback é enviado
4. ajustes são feitos rapidamente
```

Esse processo geralmente estabiliza o sistema rapidamente.

---

# Por que isso não enfraquece o projeto

Esse modelo é comum em sistemas operacionais novos.

Na prática ele traz três benefícios:

- aumenta confiança da equipe
- permite ajustes rápidos
- garante que o sistema reflita exatamente a operação real.

Após esse período inicial, o sistema tende a se tornar **a principal fonte de consulta**.

---

# Filosofia da proposta

O objetivo não é vender um software caro.

O objetivo é construir uma ferramenta operacional que:

- facilite o trabalho da equipe
- reduza risco de custos logísticos
- aumente a visibilidade da operação.

A proposta foi estruturada para ser:

- financeiramente viável
- transparente
- evolutiva.

---

# Conclusão

O Container Tracker propõe:

- centralizar a visibilidade logística
- reduzir trabalho manual
- detectar riscos operacionais mais cedo
- evoluir junto com a operação da empresa.

Ele não pretende substituir sistemas maiores.

Ele pretende resolver **um problema específico e caro da operação logística**.

E fazer isso de forma simples, confiável e sustentável.