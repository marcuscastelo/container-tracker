# Ideas
Ctrl K Search containers and processes (shipments)
Ctrl K Actions such as: New process, Recently viewed, Favorites, etc. (quickly thought examples, not final)
Export to CSV/PDF/XLSX/etc
Ack em alertas de long periods sem movement (ex: 7 days without events) (talvez ack em todos os alertas? e os estruturais como "No ETA defined" tambem seriam ackeáveis?)
Adicionar links na timeline que redirecionam para o site do carrier caso o usuario queira ver cruzar os dados com a fonte original
Permitir usuário ver alertas dismissed/acked em uma seção separada para auditoria e clicks nao intencionais
When `Container MNBU3094033 already exists in the system`, provide a link to that process/container's page so user can quickly navigate to it

Sistema de UNDO para alertas acked/dismissed, outras acoes importantes (dificil, pensar se vale a pena agora para evitar retrabalho ou deixa para depois)
Em vez de forçar a ISO 6346, apenas exibir um warning na criacao/edicao do processo/ adicao de container e um badge amarelo no container view (evita retrabalho e frustraçao do usuario, mas ainda avisa que o container pode ser invalido)

# TODO
Exibir armador no ShipmentView e Dashboard (table)
Determinar todos os alertas possíveis e como serão exibidos (cores, ícones, etc)
Determinar todos os eventos e estados possíveis e como serão exibidos (cores, ícones, etc)
Locale i18n para alertas em vez de salvar strings fixas no banco de dados