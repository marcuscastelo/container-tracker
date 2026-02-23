# Ideas
Assim que o processo for criado e ele redirecionado, o usuario poderia ver algo como "ultima edicao há 1s, 2s, 3s etc" para ter o feedback imediato de que a criacao foi bem sucedida. As vezes o usuario nao tem certeza se trocou de processo, principalmente se o processo novo for parecido com o anterior, e isso daria um feedback visual imediato.
Plano futuro: deixar templates de email prontos para serem preenchidos para alertas específicos, como transbordo, atraso, etc. para facilitar a comunicação com os clientes, terminal, etc.
Se armador desconhecido, ao tentar o refresh, usar heuristicas para tentar identificar o armador, testando APIs em ordem de probabilidade (maersk, then hapag, etc) e caso o container seja encontrado em alguma delas, atualizar o processo com o armador identificado e os dados retornados. Risco: Processo com containers de 2 armadores diferentes, mas isso hoje é tratado como impossível. Revisar.
No Status, em vez de "Discharged", "Loaded", etc. poderia ter "Discharged (3/7)", "Loaded (5/10)", etc. para dar uma ideia de quantos eventos ainda falta para o "Arrived at destination" acontecer, e dar uma ideia melhor do progresso do container, lembrando que no X/Y X é o ultimo ACTUAL e Y é o último EXPECTED e pode mudar. Talvez seja melhor criar outro campo na UI (progresso?) para permitir futuros filtros por status sem poluir com progresso meramente visual.
Fazer efeitos de blur serem transicionados para nao ser abrupto (searchoverlay)
Animacoes ao abrir e fechar dialogs, trocar de pagina, etc.

# Refine
src/modules/process/application/errors.ts -> Em vez de mensagens hardcoded, adotar códigos de erro padronizados, parametros para poder usar i18n nos erros.
Usei IDs para containers em vez de container number por achar que havia a possibilidade de um container aparecer em mais de um armador por erro humano em cadastro. Mas pensando bem, talvez seja melhor usar o container numbe como PK, sem IDs. Avaliar possíveis impactos e limitacoes em processos com erro humano que precisa ser representado mesmo "incorretamente" para ser um proceso "legalmente correto" caso containerNumber fosse PK.

# TODO
Quando o usuario colocar armador errado e o fetch der erro, deve exibir na tela um alerta dizendo "Nao foi possivel encontrar o container, por favor cheque o armador e tente novamente". Hoje ele nao tem feedback do que aconteceu, e pode ficar tentando refresh sem saber o que esta errado. Com o tempo podemos colocar um botao nesse alerta "Tentar identificar armador automaticamente", que ai rodaria a heuristica de testar as APIs em ordem de probabilidade para tentar identificar o armador, como descrito na ideia acima.
Remover coluna operation_type do banco depois de confirmar que sempre é importacao e transbordo nao é um tipo de operacao, mas um estado do container.
Adicionar booking_number no processo (domain).
Pensar se mantemos unknown ou null para os campos (carrier e operationType) que nao sao obrigatorios, e se sim, padronizar isso em todo o codigo (domain, application, ui). Null gasta menos espaço no banco...

Gerar eventos de transbordo quando o NAVIO A CHEGA, E NAVIO B SAI COM O MESMO CONTAINER (MAERSK, falta checar como outras api reportam isso). Isso vai gerar um alerta para o sistema, para que o operador possa tomar as medidas necessarias, tambem vai atualizar o processo para os importadores terem visibilidade do que esta acontecendo. 
Tratar casos que o container é removido do processo, seja por erro ou porque o cliente mudou de ideia. Hoje é impossível adicionar um container que foi removido do processo porque a checagem de container já existente é feita nos containers e nao nos processos, entao o sistema assume que o container ja existe e nao deixa adicionar. Melhorar isso para permitir re-adicionar um container que foi removido, e para ter uma checagem mais robusta de containers realmente existentes vs erros de conexao, etc.

Atualmente, o sistema nao lida bem com promocao de observations EXPECTED para ACTUAL, o que pode acontecer quando um evento esperado acontece de fato. Atualmente o sistema duplica o observation, criando um novo ACTUAL e mantendo o EXPECTED, o que pode gerar confusao e poluir a timeline. Melhorar isso para que quando um evento esperado acontece, ele seja promovido a ACTUAL sem criar um novo registro, ou seja, atualizando o registro existente de EXPECTED para ACTUAL. Isso vai manter a timeline mais limpa e evitar confusao entre eventos duplicados.


# Pedidos do cliente (alguns precisam de mais detalhes)
Adicionar campo mercadoria (description of goods) no processo.

# Debito tecnico
CopyButton e ShipmentView duplicado clipboard utils
ShipmentView, Dashboard, refresh, [id] route, estao com parsings e enrichment extensos que deveriam ser feitos na camada de dados/adapters e testáveis
Mappers duplicados, F1, UI, etc. api collections deprecated? Avaliar se ja resolvido ou se simplesmente falso.
Aparentemente o check se o container já existe é naive, nao checa o erro de fato e assume que qualquer erro é por container existente. Melhorar isso, se ainda estiver assim.
CreateProcessDialog exige reimplementacao de logica de submit, duplicacao para permitir edit, etc. em todos os lugares que usam. Refatorar para um hook ou componente separado.