# Bugs
Criando novo processo: adiciona um container ja existente, edita para um nao existente. Adiciona outro container ja existente, REMOVE com a lixeira, readiciona so que nao existente. Resultado: soft-lock mensagem "container ja existente" e nao da para resolver pq o campo foi deletado.
Nao da pra remover BL do processo no update (será que nao da pra remover nada? será que é qualquer tipo de update? testar)
Bugs visuais nos botoes sync no dashboard, precisa de refresh para ver atualizando
Nao da pra selecionar container acima e abaixo do botao copy, onClick so pega na esquerda
No dashboard, os alertas sempre ficam, ATENCAO (agora) na SEVERIDADE DOMINANTE, mesmo quando o alerta ja faz 8h ou mais
Quando todos os alertas de transbordo ja foram reconhecidos, um sync causa os mesmos alertas nascerem novamente (outra instance, mesmo transhipment), era para ele perceber que ja avisou esse transbordo e nao criar outro alerta, e criar outro apenas se houver um novo transbordo (novo navio que nunca foi avisado PARA AQUELE CONTAINER (alertas de transbordo sao por container+navio, entao se aquele navio ja apareceu em alerta do processo, mas nao do container, ainda assim cria alerta. Tambem se atentar para casos raros como Navio A -> Navio B -> Navio A -> Navio B. Nao filtrar só por container+navio, mas talvez por voyage id ou algo parecido))

# Ideas
Assim que o processo for criado e ele redirecionado, o usuario poderia ver algo como "ultima edicao há 1s, 2s, 3s etc" para ter o feedback imediato de que a criacao foi bem sucedida. As vezes o usuario nao tem certeza se trocou de processo, principalmente se o processo novo for parecido com o anterior, e isso daria um feedback visual imediato.
Plano futuro: deixar templates de email prontos para serem preenchidos para alertas específicos, como transbordo, atraso, etc. para facilitar a comunicação com os clientes, terminal, etc.
Se armador desconhecido, ao tentar o refresh, usar heuristicas para tentar identificar o armador, testando APIs em ordem de probabilidade (maersk, then hapag, etc) e caso o container seja encontrado em alguma delas, atualizar o processo com o armador identificado e os dados retornados. Risco: Processo com containers de 2 armadores diferentes, mas isso hoje é tratado como impossível. Revisar.
No Status, em vez de "Discharged", "Loaded", etc. poderia ter "Discharged (3/7)", "Loaded (5/10)", etc. para dar uma ideia de quantos eventos ainda falta para o "Arrived at destination" acontecer, e dar uma ideia melhor do progresso do container, lembrando que no X/Y X é o ultimo ACTUAL e Y é o último EXPECTED e pode mudar. Talvez seja melhor criar outro campo na UI (progresso?) para permitir futuros filtros por status sem poluir com progresso meramente visual.
Fazer efeitos de blur serem transicionados para nao ser abrupto (searchoverlay)
Exibir barra de busca global na pagina processo tambem para facilitar a busca por outro processo sem precisar voltar para o dashboard. (talvez colocar na navbar?)
Animacoes ao abrir e fechar dialogs, trocar de pagina, etc.
Paginacao na pagina dashboard e outras listas de processo etc.
Permitir colar multiplos containers e ja adiciona varios.
Permitir colar um markdown ou csv ou formato especifico human-friendly com todos os campos do processo para criar fácil. (Alinhar com a forma que o trello é usado hoje)
Agents fazem heartbeat periodico e UI exibe erro "Nenhum agente capaz de sincronizar o processo/container está online" se nao tiver ninguem e a queue de sync falhar.
Em todos os lugares que tiver "N Alertas", adicionar uma interacao de clique que abre um overlay com os processos/containers que tem esses alertas, para facilitar o acesso a eles.
Permitir que o usuario escolha quais colunas quer ver no dashboard, e salvar isso para a proxima vez. (ex: nao quero ver a coluna de ETA, ou quero ver a coluna de booking number, etc.)
Permitir que o usuario copie valores da tabela no dashboard, como process number, redestinacao, booking number, etc. com um clique, e dar um feedback visual de que o valor foi copiado (ex: tooltip "Copiado!" ou algo do tipo).
No botao "Sincronizar todos os processos" (dashboard), só sincronizar processos que nao foram sincronizados com sucesso nos ultmimos X minutos e nao sao processos archived.

# Refine
src/modules/process/application/errors.ts -> Em vez de mensagens hardcoded, adotar códigos de erro padronizados, parametros para poder usar i18n nos erros.
Usei IDs para containers em vez de container number por achar que havia a possibilidade de um container aparecer em mais de um armador por erro humano em cadastro. Mas pensando bem, talvez seja melhor usar o container numbe como PK, sem IDs. Avaliar possíveis impactos e limitacoes em processos com erro humano que precisa ser representado mesmo "incorretamente" para ser um proceso "legalmente correto" caso containerNumber fosse PK.

# TODO
Quando o usuario colocar armador errado e o fetch der erro, deve exibir na tela um alerta dizendo "Nao foi possivel encontrar o container, por favor cheque o armador e tente novamente". Hoje ele nao tem feedback do que aconteceu, e pode ficar tentando refresh sem saber o que esta errado. Com o tempo podemos colocar um botao nesse alerta "Tentar identificar armador automaticamente", que ai rodaria a heuristica de testar as APIs em ordem de probabilidade para tentar identificar o armador, como descrito na ideia acima.
Remover coluna operation_type do banco depois de confirmar que sempre é importacao e transbordo nao é um tipo de operacao, mas um estado do container.
Adicionar booking_number no processo (domain).
Pensar se mantemos unknown ou null para os campos (carrier e operationType) que nao sao obrigatorios, e se sim, padronizar isso em todo o codigo (domain, application, ui). Null gasta menos espaço no banco...
Unificar e separar termos "Sync" "Refresh" "Edited" "Updated" "Modified", etc. para ter um vocabulário padronizado e evitar confusao. Ex: Sync = acao de tentar atualizar os dados do processo puxando da API, Refresh = acao de atualizar a tela para refletir o estado atual do processo, Edited/Updated/Modified = o processo foi editado manualmente pelo usuario. Padronizar isso em todo o codigo e UI.

Gerar eventos de transbordo quando o NAVIO A CHEGA, E NAVIO B SAI COM O MESMO CONTAINER (MAERSK, falta checar como outras api reportam isso). Isso vai gerar um alerta para o sistema, para que o operador possa tomar as medidas necessarias, tambem vai atualizar o processo para os importadores terem visibilidade do que esta acontecendo. 
Tratar casos que o container é removido do processo, seja por erro ou porque o cliente mudou de ideia. Hoje é impossível adicionar um container que foi removido do processo porque a checagem de container já existente é feita nos containers e nao nos processos, entao o sistema assume que o container ja existe e nao deixa adicionar. Melhorar isso para permitir re-adicionar um container que foi removido, e para ter uma checagem mais robusta de containers realmente existentes vs erros de conexao, etc.

Atualmente, o sistema nao lida bem com promocao de observations EXPECTED para ACTUAL, o que pode acontecer quando um evento esperado acontece de fato. Atualmente o sistema duplica o observation, criando um novo ACTUAL e mantendo o EXPECTED, o que pode gerar confusao e poluir a timeline. Melhorar isso para que quando um evento esperado acontece, ele seja promovido a ACTUAL sem criar um novo registro, ou seja, atualizando o registro existente de EXPECTED para ACTUAL. Isso vai manter a timeline mais limpa e evitar confusao entre eventos duplicados.

Os alertas de transbordo devem especificar o container, navio original e navio novo para facilitar a identificacao do problema e a comunicacao com o cliente, terminal, etc. Se possivel, adicionar no alerta o numero de redestinacao do processo no momento que o transbordo é identificado, para facilitar o acompanhamento do processo e a comunicacao com o cliente.

Os alertas devem usar i18n parametrizado em vez de hardcoded.
Varios textos ainda nao usam i18n ("Vessel change", etc)

# Debito tecnico
CopyButton e ShipmentView duplicado clipboard utils
ShipmentView, Dashboard, refresh, [id] route, estao com parsings e enrichment extensos que deveriam ser feitos na camada de dados/adapters e testáveis
Mappers duplicados, F1, UI, etc. api collections deprecated? Avaliar se ja resolvido ou se simplesmente falso.
Aparentemente o check se o container já existe é naive, nao checa o erro de fato e assume que qualquer erro é por container existente. Melhorar isso, se ainda estiver assim.
CreateProcessDialog exige reimplementacao de logica de submit, duplicacao para permitir edit, etc. em todos os lugares que usam. Refatorar para um hook ou componente separado.
A pasta tools está ficando bloated com scripts, prompts, e o nosso agent, que é software real. Precisamos repensar como estruturar isso. Talvez um submodule para agent e common AI prompts/skills. Mas tools/ é genérico demais e pode ficar bagunçado. Pensar em uma estrutura melhor para organizar isso.
Processes v2 API. Remover a v1 e renomear a v2? Nao sei se é ideal ficar com um monte de versoes.

# Erros VSCode
[INFO 1:48:07 AM] [v1.44.1] Vitest extension is activated because Vitest is installed or there is a Vite/Vitest config file in the workspace.
[INFO 1:48:07 AM] [API] Resolving configs: container-tracker/vitest.config.ts, flowchart/vite.config.ts
[INFO 1:48:08 AM] [API] Running Vitest v3.2.4 (container-tracker/vitest.config.ts) with "/usr/bin/node /home/marucs/.vscode/extensions/vitest.explorer-1.44.1/dist/worker.js"
[INFO 1:48:08 AM] [API] Running Vitest v3.2.4 (flowchart/vite.config.ts) with "/usr/bin/node /home/marucs/.vscode/extensions/vitest.explorer-1.44.1/dist/worker.js"
[Error 1:48:08 AM] There were errors during config load.
[Error 1:48:08 AM] [Error Error] Vitest failed to start: 
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite' imported from /home/marucs/Development/Castro/container-tracker/node_modules/.vite-temp/vite.config.ts.timestamp-1772513288662-bdf61befe0f9c8.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)
    at packageResolve (node:internal/modules/esm/resolve:764:81)
    at moduleResolve (node:internal/modules/esm/resolve:855:18)
    at defaultResolve (node:internal/modules/esm/resolve:988:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:697:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:714:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:743:52)
    at #resolve (node:internal/modules/esm/loader:679:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:599:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:160:33)
Error: Vitest failed to start: 
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite' imported from /home/marucs/Development/Castro/container-tracker/node_modules/.vite-temp/vite.config.ts.timestamp-1772513288662-bdf61befe0f9c8.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)
    at packageResolve (node:internal/modules/esm/resolve:764:81)
    at moduleResolve (node:internal/modules/esm/resolve:855:18)
    at defaultResolve (node:internal/modules/esm/resolve:988:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:697:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:714:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:743:52)
    at #resolve (node:internal/modules/esm/loader:679:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:599:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:160:33)
	at e.s (/home/marucs/.vscode/extensions/vitest.explorer-1.44.1/dist/extension.js:1:60051)
	at e.emit (node:events:519:28)
	at e.o.t.exports.K (/home/marucs/.vscode/extensions/vitest.explorer-1.44.1/dist/wrapper-DYgoE0-C.js:1:38462)
	at e.o.t.exports.emit (node:events:519:28)
	at e.o.t.exports.dataMessage (/home/marucs/.vscode/extensions/vitest.explorer-1.44.1/dist/wrapper-DYgoE0-C.js:1:16483)
	at e.o.t.exports.getData (/home/marucs/.vscode/extensions/vitest.explorer-1.44.1/dist/wrapper-DYgoE0-C.js:1:15380)
	at e.o.t.exports.startLoop (/home/marucs/.vscode/extensions/vitest.explorer-1.44.1/dist/wrapper-DYgoE0-C.js:1:12092)
	at e.o.t.exports._write (/home/marucs/.vscode/extensions/vitest.explorer-1.44.1/dist/wrapper-DYgoE0-C.js:1:11384)
	at writeOrBuffer (node:internal/streams/writable:572:12)
	at _write (node:internal/streams/writable:501:10)
	at Writable.write (node:internal/streams/writable:510:10)
	at Socket.Z (/home/marucs/.vscode/extensions/vitest.explorer-1.44.1/dist/wrapper-DYgoE0-C.js:1:39429)
	at Socket.emit (node:events:519:28)
	at addChunk (node:internal/streams/readable:561:12)
	at readableAddChunkPushByteMode (node:internal/streams/readable:512:3)
	at Readable.push (node:internal/streams/readable:392:5)
	at TCP.onStreamRead (node:internal/stream_base_commons:189:23)
[INFO 1:48:09 AM] [API] Watching vitest.config.ts
[INFO 1:48:09 AM] [VSCODE] Watching container-tracker with pattern **/*
[1:48:14 AM] [VSCODE] Ignoring file: .git/.gitstatus.PfHIfI
[1:48:15 AM] [VSCODE] File deleted: .git/.gitstatus.PfHIfI
[1:48:18 AM] [VSCODE] Ignoring file: tasks/prd-worktrees.md.git