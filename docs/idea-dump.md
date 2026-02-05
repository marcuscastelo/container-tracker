# Ideas

# Refine

# TODO

# Pedidos do cliente (alguns precisam de mais detalhes)
"o campo alerta deve ter um foco especial principalmente em transbordo"
```
Tipo de operação não precisa pois é sempre importação

Tipo e Tamanho do container seria melhor se ele pegasse do proprio site do armador.

Complementar com:

Nome do importador:
Ref. Castro:
Ref. Imp:
Exportador: 

Se possível mandamos o follow da Flush para ele testar o programa, vai ser lindo
```

# Debito tecnico
CopyButton e ShipmentView duplicado clipboard utils
ShipmentView, Dashboard, refresh, [id] route, estao com parsings e enrichment extensos que deveriam ser feitos na camada de dados/adapters e testáveis
Mappers duplicados, F1, UI, etc. api collections deprecated? Avaliar se ja resolvido ou se simplesmente falso.
Aparentemente o check se o container já existe é naive, nao checa o erro de fato e assume que qualquer erro é por container existente. Melhorar isso, se ainda estiver assim.
CreateProcessDialog exige reimplementacao de logica de submit, duplicacao para permitir edit, etc. em todos os lugares que usam. Refatorar para um hook ou componente separado.