# Ideas
Assim que o processo for criado e ele redirecionado, o usuario poderia ver algo como "ultima edicao há 1s, 2s, 3s etc" para ter o feedback imediato de que a criacao foi bem sucedida. As vezes o usuario nao tem certeza se trocou de processo, principalmente se o processo novo for parecido com o anterior, e isso daria um feedback visual imediato.
Plano futuro: deixar templates de email prontos para serem preenchidos para alertas específicos, como transbordo, atraso, etc. para facilitar a comunicação com os clientes, terminal, etc.
Se armador desconhecido, ao tentar o refresh, usar heuristicas para tentar identificar o armador, testando APIs em ordem de probabilidade (maersk, then hapag, etc) e caso o container seja encontrado em alguma delas, atualizar o processo com o armador identificado e os dados retornados. Risco: Processo com containers de 2 armadores diferentes, mas isso hoje é tratado como impossível. Revisar.

# Refine

# TODO
Remover coluna operation_type do banco depois de confirmar que sempre é importacao e transbordo nao é um tipo de operacao, mas um estado do container.
Adicionar booking_number no processo (domain).
Pensar se mantemos unknown ou null para os campos (carrier e operationType) que nao sao obrigatorios, e se sim, padronizar isso em todo o codigo (domain, application, ui). Null gasta menos espaço no banco...

Gerar eventos de transbordo quando o NAVIO A CHEGA, E NAVIO B SAI COM O MESMO CONTAINER (MAERSK, falta checar como outras api reportam isso). Isso vai gerar um alerta para o sistema, para que o operador possa tomar as medidas necessarias, tambem vai atualizar o processo para os importadores terem visibilidade do que esta acontecendo. 

# Pedidos do cliente (alguns precisam de mais detalhes)
Adicionar campo mercadoria (description of goods) no processo.

# Debito tecnico
CopyButton e ShipmentView duplicado clipboard utils
ShipmentView, Dashboard, refresh, [id] route, estao com parsings e enrichment extensos que deveriam ser feitos na camada de dados/adapters e testáveis
Mappers duplicados, F1, UI, etc. api collections deprecated? Avaliar se ja resolvido ou se simplesmente falso.
Aparentemente o check se o container já existe é naive, nao checa o erro de fato e assume que qualquer erro é por container existente. Melhorar isso, se ainda estiver assim.
CreateProcessDialog exige reimplementacao de logica de submit, duplicacao para permitir edit, etc. em todos os lugares que usam. Refatorar para um hook ou componente separado.