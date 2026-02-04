# Ideas
Ctrl K Search containers and processes (shipments) by ID, client, BL, date, origin, destination, status, etc.
Ctrl K Actions such as: New process, Recently viewed, Favorites, etc. (quickly thought examples, not final)
Export to CSV/PDF/XLSX/etc
Ack em alertas de long periods sem movement (ex: 7 days without events) (talvez ack em todos os alertas? e os estruturais como "No ETA defined" tambem seriam ackeáveis?)
Adicionar links na timeline que redirecionam para o site do carrier caso o usuario queira ver cruzar os dados com a fonte original
Permitir usuário ver alertas dismissed/acked em uma seção separada para auditoria e clicks nao intencionais
When `Container MNBU3094033 already exists in the system`, provide a link to that process/container's page so user can quickly navigate to it

Sistema de UNDO para alertas acked/dismissed, outras acoes importantes (dificil, pensar se vale a pena agora para evitar retrabalho ou deixa para depois)
Em vez de forçar a ISO 6346, apenas exibir um warning na criacao/edicao do processo/ adicao de container e um badge amarelo no container view (evita retrabalho e frustraçao do usuario, mas ainda avisa que o container pode ser invalido)
Metadados de carriers devem ir para o banco, ex: url de busca para double check dos containers (fica na timeline para clicar e ir para o site do carrier, mas pode mudar com o tempo e estando no banco facilita updates futuros)
Em vez de exibir apenas a quantidade de containers no dashboard (table), exibir o primeiro ID e usar uma badge "+N" para indicar que ha mais containers (melhora a usabilidade, facilita identificar o processo correto rapidamente) (pensar se é melhor ficar +1 ou 2 containers nesse badge para evitar ambiguidade, talvez com multiplos nao mostre nenhum e apenas o total, elminando a ideia da badge? Talvez mostrar badge e hover com lista completa?)

Server roda checagem se api bate com schema, se nao bater, notifica dev via email para manutencao do adapter veloz, antes do usuario ser impactado (melhora a confiabilidade do sistema, evita dados corrompidos chegando ao usuario final)
Adicionar telemetria e observabilidade (Sentry? OTel?) para monitorar performance, erros e uso do sistema (ajuda a identificar gargalos e melhorar a experiencia do usuario) (Como fica LGPD/privacidade nesse caso? Pensar em anonimizar dados sensiveis, ou pedir consentimento explicito do usuario)

# TODO
Exibir ícone do armador no ShipmentView e Dashboard (table)
Determinar todos os alertas possíveis e como serão exibidos (cores, ícones, etc)
Determinar todos os eventos e estados possíveis e como serão exibidos (cores, ícones, etc)
Locale i18n para alertas em vez de salvar strings fixas no banco de dados
Separar BL de Booking Number na criação/edição do processo e no schema e DB. Teremos 2 campos opcionais.
Renomear BL para `Bill of Lading (BL)` em toda a UI, documentação e comunicações para maior clareza

# Debito tecnico
CopyButton e ShipmentView duplicado clipboard utils
ShipmentView, Dashboard, refresh, [id] route, estao com parsings e enrichment extensos que deveriam ser feitos na camada de dados/adapters e testáveis
Mappers duplicados, F1, UI, etc. api collections deprecated? Avaliar se ja resolvido ou se simplesmente falso.