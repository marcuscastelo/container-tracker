# Ideas
Assim que o processo for criado e ele redirecionado, o usuario poderia ver algo como "ultima edicao há 1s, 2s, 3s etc" para ter o feedback imediato de que a criacao foi bem sucedida. As vezes o usuario nao tem certeza se trocou de processo, principalmente se o processo novo for parecido com o anterior, e isso daria um feedback visual imediato.

# Refine

# TODO
Remover coluna operation_type do banco depois de confirmar que sempre é importacao e transbordo nao é um tipo de operacao, mas um estado do container.
Adicionar booking_number no processo (domain).
Pensar se mantemos unknown ou null para os campos (carrier e operationType) que nao sao obrigatorios, e se sim, padronizar isso em todo o codigo (domain, application, ui). Null gasta menos espaço no banco...

# Pedidos do cliente (alguns precisam de mais detalhes)
Adicionar campo mercadoria (description of goods) no processo.

# Debito tecnico
CopyButton e ShipmentView duplicado clipboard utils
ShipmentView, Dashboard, refresh, [id] route, estao com parsings e enrichment extensos que deveriam ser feitos na camada de dados/adapters e testáveis
Mappers duplicados, F1, UI, etc. api collections deprecated? Avaliar se ja resolvido ou se simplesmente falso.
Aparentemente o check se o container já existe é naive, nao checa o erro de fato e assume que qualquer erro é por container existente. Melhorar isso, se ainda estiver assim.
CreateProcessDialog exige reimplementacao de logica de submit, duplicacao para permitir edit, etc. em todos os lugares que usam. Refatorar para um hook ou componente separado.